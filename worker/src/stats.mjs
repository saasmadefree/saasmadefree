// Enregistrement des événements du beacon (spec §3) et, plus loin dans ce
// fichier au fil des tâches, lecture agrégée, façade crawlers et cron.
import { AI_REFERRER_LABELS, REFERRER_LABELS, AI_BOTS } from './ai-bots.mjs';
import { SLUGS } from './slugs.generated.mjs';
import { AGENT_IDS, SITE_LANGS } from './agents.generated.mjs';

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
