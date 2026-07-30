import { dayKey, hashIp } from './hash.mjs';
import { SLUGS } from './slugs.generated.mjs';

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return json({}, 204, env);

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
  },
};
