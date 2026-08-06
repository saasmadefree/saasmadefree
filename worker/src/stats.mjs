// Enregistrement des événements du beacon (spec §3) et, plus loin dans ce
// fichier au fil des tâches, lecture agrégée, façade crawlers et cron.
import { AI_REFERRER_LABELS, REFERRER_LABELS, AI_BOTS, matchAiBot } from './ai-bots.mjs';
import { SLUGS } from './slugs.generated.mjs';
import { AGENT_IDS, SITE_LANGS } from './agents.generated.mjs';
import { dayKey } from './hash.mjs';

const BEACON_TYPES = new Set(['view', 'copy', 'open_agent']);
// Un chemin de page du site : la racine, ou /<lang>[/…] en kebab minuscule.
// Borne la longueur pour que la table hits ne stocke jamais de déchet long.
const PATH_RE = /^\/(?:[a-z]{2}(?:\/[a-z0-9\-/]{0,140})?)?$/;

export function validateBeacon(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
  if (!BEACON_TYPES.has(body.type)) return null;
  if (body.type === 'view') {
    const { path, lang, ref } = body;
    if (typeof path !== 'string' || !PATH_RE.test(path)) return null;
    if (!SITE_LANGS.has(lang)) return null;
    if (typeof ref !== 'string' || !REFERRER_LABELS.has(ref)) return null;
    return { type: 'view', path, lang, ref };
  }
  const { slug, agent } = body;
  if (typeof slug !== 'string' || !SLUGS.has(slug)) return null;
  if (typeof agent !== 'string' || (agent !== 'clipboard' && !AGENT_IDS.has(agent))) return null;
  return { type: body.type, slug, agent };
}

const UPSERT_EVENT =
  `INSERT INTO events (day, kind, subject, n) VALUES (?, ?, ?, 1)
   ON CONFLICT(day, kind, subject) DO UPDATE SET n = n + 1`;

export async function recordBeacon(env, body, ipHash, day) {
  const beacon = validateBeacon(body);
  if (!beacon) return false;
  const stmts = [];
  if (beacon.type === 'view') {
    stmts.push(env.DB.prepare(
      `INSERT INTO hits (day, path, lang, n) VALUES (?, ?, ?, 1)
       ON CONFLICT(day, path) DO UPDATE SET n = n + 1`
    ).bind(day, beacon.path, beacon.lang));
    stmts.push(env.DB.prepare(
      'INSERT OR IGNORE INTO uniques (day, ip_hash) VALUES (?, ?)'
    ).bind(day, ipHash));
    if (beacon.ref !== 'none') {
      const kind = AI_REFERRER_LABELS.has(beacon.ref) ? 'ai_referral' : 'referral';
      stmts.push(env.DB.prepare(UPSERT_EVENT).bind(day, kind, beacon.ref));
    }
  } else {
    stmts.push(env.DB.prepare(UPSERT_EVENT).bind(day, beacon.type, `${beacon.slug}|${beacon.agent}`));
  }
  await env.DB.batch(stmts);
  return true;
}

const DAY_MS = 86_400_000;

function daysBack(now, n) {
  return new Date(now.getTime() - n * DAY_MS).toISOString().slice(0, 10);
}

// Une seule passe env.DB.batch() : la lecture publique est cachée 60 s à
// l'edge (voir index.mjs), la D1 ne voit donc au plus qu'un batch par minute.
export async function buildStatsPayload(env, now) {
  const day = daysBack(now, 0);
  const d7 = daysBack(now, 6);
  const d14 = daysBack(now, 13);
  const d30 = daysBack(now, 29);
  const results = await env.DB.batch([
    env.DB.prepare('SELECT COALESCE(SUM(n), 0) AS v FROM hits WHERE day = ?').bind(day),
    env.DB.prepare('SELECT COUNT(*) AS v FROM uniques WHERE day = ?').bind(day),
    env.DB.prepare('SELECT day, SUM(n) AS v FROM hits GROUP BY day ORDER BY v DESC, day DESC LIMIT 1'),
    env.DB.prepare('SELECT day, SUM(n) AS v FROM hits WHERE day >= ? GROUP BY day ORDER BY day').bind(d14),
    env.DB.prepare('SELECT COUNT(*) AS v FROM uniques WHERE day >= ?').bind(d7),
    env.DB.prepare('SELECT path, SUM(n) AS v FROM hits WHERE day >= ? GROUP BY path ORDER BY v DESC LIMIT 10').bind(d7),
    env.DB.prepare('SELECT lang, SUM(n) AS v FROM hits WHERE day >= ? GROUP BY lang ORDER BY v DESC').bind(d7),
    env.DB.prepare(
      `SELECT substr(subject, instr(subject, '|') + 1) AS agent, SUM(n) AS v FROM events
       WHERE kind IN ('copy', 'open_agent') AND day >= ? GROUP BY agent ORDER BY v DESC`
    ).bind(d7),
    env.DB.prepare(
      `SELECT substr(subject, 1, instr(subject, '|') - 1) AS slug, SUM(n) AS v FROM events
       WHERE kind IN ('copy', 'open_agent') AND day >= ? GROUP BY slug ORDER BY v DESC LIMIT 10`
    ).bind(d7),
    env.DB.prepare(
      "SELECT subject, SUM(n) AS v FROM events WHERE kind = 'ai_referral' AND day >= ? GROUP BY subject ORDER BY v DESC"
    ).bind(d7),
    env.DB.prepare(
      "SELECT subject, SUM(n) AS v FROM events WHERE kind = 'ai_referral' AND day >= ? GROUP BY subject ORDER BY v DESC"
    ).bind(d30),
    env.DB.prepare(
      'SELECT bot, source, SUM(n) AS v FROM crawlers WHERE day >= ? GROUP BY bot, source'
    ).bind(d7),
    env.DB.prepare('SELECT bot, MAX(day) AS last FROM crawlers GROUP BY bot'),
    env.DB.prepare('SELECT COUNT(*) AS v FROM votes'),
    env.DB.prepare('SELECT slug, COUNT(*) AS v FROM votes GROUP BY slug ORDER BY v DESC LIMIT 5'),
  ]);
  const [
    todayViews, todayVisitors, peak, views14d, visitors7d, topPages, langs,
    byAgent, topPrompts, ref7, ref30, crawlerCounts, crawlerLastSeen, votesTotal, votesTop,
  ] = results.map((r) => r.results);

  const lastSeenByBot = new Map(crawlerLastSeen.map((r) => [r.bot, r.last]));
  const crawlerMap = new Map();
  for (const row of crawlerCounts) {
    const entry = crawlerMap.get(row.bot) ?? { bot: row.bot, edge: 0, cf: 0 };
    if (row.source === 'edge-worker') entry.edge = row.v;
    if (row.source === 'cloudflare-api') entry.cf = row.v;
    crawlerMap.set(row.bot, entry);
  }
  const botMeta = new Map(AI_BOTS.map((b) => [b.bot, b]));
  const crawlers7d = [...crawlerMap.values()]
    .map((c) => ({
      ...c,
      label: botMeta.get(c.bot)?.label ?? c.bot,
      vendor: botMeta.get(c.bot)?.vendor ?? '',
      lastSeen: lastSeenByBot.get(c.bot) ?? null,
    }))
    .sort((a, b) => (b.edge + b.cf) - (a.edge + a.cf));

  const copiesTotal = byAgent.reduce((sum, r) => sum + r.v, 0);

  return {
    generatedAt: now.toISOString(),
    today: { views: todayViews[0].v, visitors: todayVisitors[0].v },
    peak: peak.length > 0 ? { day: peak[0].day, views: peak[0].v } : null,
    views14d: views14d.map((r) => ({ day: r.day, views: r.v })),
    visitors7d: visitors7d[0].v,
    topPages7d: topPages.map((r) => ({ path: r.path, views: r.v })),
    copies7d: {
      total: copiesTotal,
      byAgent: byAgent.map((r) => ({ agent: r.agent, n: r.v })),
      topPrompts: topPrompts.map((r) => ({ slug: r.slug, n: r.v })),
    },
    aiReferrals: {
      d7: ref7.map((r) => ({ ai: r.subject, n: r.v })),
      d30: ref30.map((r) => ({ ai: r.subject, n: r.v })),
    },
    crawlers7d,
    langs7d: langs.map((r) => ({ lang: r.lang, views: r.v })),
    votes: { total: votesTotal[0].v, top: votesTop.map((r) => ({ slug: r.slug, n: r.v })) },
  };
}

const UNIQUES_RETENTION_DAYS = 45;

export async function purgeUniques(env, now) {
  const cutoff = daysBack(now, UNIQUES_RETENTION_DAYS);
  try {
    await env.DB.prepare('DELETE FROM uniques WHERE day < ?').bind(cutoff).run();
  } catch { /* best-effort, comme pruneRate */ }
}

// Cron quotidien (spec §5) : source `cloudflare-api`, en validation croisée de
// la façade. Sur plan gratuit le filtre se fait par user-agent — même liste
// que la façade (AI_BOTS), donc B ne découvre pas de bots inconnus, il valide
// les volumes vus par l'edge. Idempotent : SET n = excluded.n, pas n + n.
export async function runScheduled(env, now) {
  await purgeUniques(env, now);
  if (!env.CF_API_TOKEN || !env.CF_ZONE_TAG) return;
  try {
    const day = daysBack(now, 1); // la journée UTC pleine précédente
    const or = AI_BOTS.map((b) => `{userAgent_like: "%${b.ua}%"}`).join(', ');
    const query = `{ viewer { zones(filter: {zoneTag: "${env.CF_ZONE_TAG}"}) {
      httpRequestsAdaptiveGroups(limit: 5000, filter: {
        datetime_geq: "${day}T00:00:00Z", datetime_lt: "${daysBack(now, 0)}T00:00:00Z",
        OR: [${or}]
      }) { count dimensions { userAgent } } } } }`;
    const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.CF_API_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) return;
    const payload = await response.json();
    const groups = payload?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
    const totals = new Map();
    for (const group of groups) {
      const bot = matchAiBot(group?.dimensions?.userAgent ?? '');
      if (!bot) continue;
      totals.set(bot.bot, (totals.get(bot.bot) ?? 0) + (group.count ?? 0));
    }
    if (totals.size === 0) return;
    await env.DB.batch([...totals].map(([bot, n]) =>
      env.DB.prepare(
        `INSERT INTO crawlers (day, bot, source, n) VALUES (?, ?, 'cloudflare-api', ?)
         ON CONFLICT(day, bot, source) DO UPDATE SET n = excluded.n`
      ).bind(day, bot, n)
    ));
  } catch { /* fail-quiet : les lignes cloudflare-api seront simplement absentes */ }
}

// Façade des pages HTML de l'apex (spec §4). Les crawlers IA n'exécutent pas
// de JavaScript : c'est ici, et seulement ici, qu'on les voit. Fail-open
// absolu : le comptage vit dans waitUntil derrière un try/catch — un échec
// D1 ou un UA exotique ne doit ni casser ni ralentir la page servie. La
// sous-requête fetch(request) part vers l'origine (Pages) sans re-déclencher
// ce worker : c'est le comportement documenté des routes zone.
export function serveFacade(request, env, ctx) {
  try {
    const bot = matchAiBot(request.headers.get('user-agent') ?? '');
    if (bot) {
      ctx.waitUntil(
        env.DB.prepare(
          `INSERT INTO crawlers (day, bot, source, n) VALUES (?, ?, 'edge-worker', 1)
           ON CONFLICT(day, bot, source) DO UPDATE SET n = n + 1`
        ).bind(dayKey(new Date()), bot.bot).run().catch(() => {})
      );
    }
  } catch { /* fail-open : jamais au détriment de la page */ }
  return fetch(request);
}
