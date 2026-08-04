import { dayKey, hashIp } from './hash.mjs';
import { SLUGS } from './slugs.generated.mjs';
import { recordBeacon, buildStatsPayload, serveFacade, runScheduled } from './stats.mjs';

const RATE_LIMIT_PER_MINUTE = 30;
const RATE_RETENTION_MINUTES = 2;

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

function json(body, status, env, cacheControl = 'no-store') {
  // Fetch interdit un corps sur les statuts "null body" (101/204/205/304) :
  // le préflight OPTIONS répond en 204, donc il ne doit jamais recevoir de
  // corps sous peine de lever un TypeError à l'exécution dans workerd.
  const responseBody = NULL_BODY_STATUSES.has(status) ? null : JSON.stringify(body);
  return new Response(responseBody, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': env.ALLOWED_ORIGIN ?? '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'cache-control': cacheControl,
    },
  });
}

function minuteKey(date) {
  return date.toISOString().slice(0, 16);
}

// La table `rate` n'a pas de purge native : chaque couple (ip_hash, minute)
// distinct insère une ligne, et rien ne la supprime jamais. Une fois sa
// minute passée, une ligne ne peut plus être relue par le limiteur (qui ne
// consulte que la minute en cours) : elle est purgeable sans risque. On la
// purge ici de façon opportuniste, à chaque vote, avec une seule instruction.
// Best-effort : un échec de purge ne doit jamais empêcher un vote légitime
// d'être comptabilisé, donc on avale toute erreur.
async function pruneRate(env, now) {
  const cutoff = minuteKey(new Date(now.getTime() - RATE_RETENTION_MINUTES * 60_000));
  try {
    await env.DB.prepare('DELETE FROM rate WHERE minute < ?').bind(cutoff).run();
  } catch {
    // Nettoyage best-effort : on ignore volontairement l'échec.
  }
}

async function overRateLimit(env, ipHash, now) {
  await pruneRate(env, now);
  const minute = minuteKey(now);
  const row = await env.DB.prepare(
    `INSERT INTO rate (ip_hash, minute, n) VALUES (?, ?, 1)
     ON CONFLICT(ip_hash, minute) DO UPDATE SET n = n + 1
     RETURNING n`
  ).bind(ipHash, minute).first();
  return (row?.n ?? 0) > RATE_LIMIT_PER_MINUTE;
}

async function countFor(env, slug) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS c FROM votes WHERE slug = ?')
    .bind(slug).first();
  return row?.c ?? 0;
}

async function handle(request, env) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') return json({}, 204, env);

  // Un VOTE_SALT absent ou vide s'interpole dans hashIp comme la chaîne
  // littérale "undefined" (template literal) : rien ne lève, le worker
  // continue à fonctionner, les votes continuent à être comptés — et chaque
  // ip_hash stocké devient cassable par force brute sur tout l'espace IPv4 en
  // s'appuyant sur `day`, déjà présent dans la même ligne. Personne n'est
  // prévenu. On échoue bruyamment ici plutôt que de laisser cette régression
  // silencieuse produire des lignes irréversiblement compromises.
  if (!env.VOTE_SALT) {
    return json({ error: 'misconfigured' }, 500, env);
  }

  // Lecture publique des stats (spec §8) : une seule forme, cacheable 60 s à
  // l'edge — c'est le « refreshed every minute » de la page /stats.
  if (url.pathname === '/api/v1/stats' && request.method === 'GET') {
    return json(await buildStatsPayload(env, new Date()), 200, env, 'public, max-age=60');
  }

  // Beacon d'audience (spec §3) : toujours 204, y compris sur entrée invalide
  // ou erreur D1 — un compteur d'audience n'a pas le droit d'avoir un avis
  // visible. Le rate limiting réutilise la table `rate` des votes.
  if (url.pathname === '/api/v1/stats/beacon') {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, env);
    let body = null;
    try { body = await request.json(); } catch { /* corps illisible : ignoré */ }
    const now = new Date();
    const day = dayKey(now);
    const ip = request.headers.get('cf-connecting-ip') ?? '0.0.0.0';
    const ipHash = await hashIp(ip, env.VOTE_SALT, day);
    // Le try/catch englobe aussi overRateLimit (et donc la purge de `rate`) :
    // le contrat fail-open ("toujours 204") ne souffre aucune exception, y
    // compris si le limiteur lui-même échoue (table `rate` absente, panne
    // D1) — contrairement à la route de vote, où un tel échec peut rester
    // visible en 500.
    try {
      if (!(await overRateLimit(env, ipHash, now))) {
        await recordBeacon(env, body, ipHash, day);
      }
    } catch { /* fail-open */ }
    return json({}, 204, env);
  }

  const isCountsRoute = url.pathname === '/api/v1/votes' || url.pathname === '/feed/v1/votes.json';
  if (isCountsRoute && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT slug, COUNT(*) AS c FROM votes GROUP BY slug'
    ).all();
    const counts = {};
    for (const row of results) counts[row.slug] = row.c;
    return json(counts, 200, env, 'public, max-age=3600');
  }

  if (url.pathname !== '/api/v1/vote') return json({ error: 'not_found' }, 404, env);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, env);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, env);
  }

  const slug = body?.slug;
  if (typeof slug !== 'string' || !SLUGS.has(slug)) {
    return json({ error: 'unknown_slug' }, 400, env);
  }

  const now = new Date();
  const day = dayKey(now);
  const ip = request.headers.get('cf-connecting-ip') ?? '0.0.0.0';
  const ipHash = await hashIp(ip, env.VOTE_SALT, day);

  if (await overRateLimit(env, ipHash, now)) {
    return json({ error: 'rate_limited', count: await countFor(env, slug), counted: false }, 429, env);
  }

  const inserted = await env.DB.prepare(
    'INSERT OR IGNORE INTO votes (ip_hash, slug, day) VALUES (?, ?, ?) RETURNING slug'
  ).bind(ipHash, slug, day).first();

  return json({ count: await countFor(env, slug), counted: inserted !== null }, 200, env);
}

export default {
  // Filet de sécurité : tout appel D1 non protégé plus haut (l'upsert de
  // `rate`, l'insert de `votes`, les deux `COUNT(*)`) peut lever. Sans ce
  // filet, l'exception traverserait `fetch()` et Cloudflare renverrait sa
  // propre réponse d'erreur par défaut — qui ne passe pas par `json()` et
  // n'a donc aucun en-tête CORS. Le navigateur bloquerait alors la réponse
  // avant même que l'appelant ne voie le code de statut, et un vote valide
  // disparaîtrait sans que personne ne soit prévenu. Le `await` est
  // nécessaire : sans lui, une promesse rejetée serait renvoyée telle
  // quelle au lieu d'être levée, et ce `catch` ne s'exécuterait jamais.
  async fetch(request, env, ctx) {
    try {
      // Les routes zone de l'apex (pages HTML du site) passent par la façade
      // crawlers — avant tout contrôle de configuration : la façade n'utilise
      // ni VOTE_SALT ni la moindre donnée personnelle, et doit servir les
      // pages même si le worker est mal configuré.
      if (new URL(request.url).hostname === 'saasmadefree.com') {
        return await serveFacade(request, env, ctx);
      }
      return await handle(request, env);
    } catch {
      return json({ error: 'internal_error' }, 500, env);
    }
  },

  async scheduled(controller, env, ctx) {
    // Fail-quiet : un cron qui lève serait re-tenté par la plateforme sans
    // que personne ne le voie ; on préfère journaliser l'absence de données.
    try { await runScheduled(env, new Date()); } catch { /* rien */ }
  },
};
