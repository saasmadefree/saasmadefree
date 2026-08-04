// Enregistrement des événements du beacon (spec §3) et, plus loin dans ce
// fichier au fil des tâches, lecture agrégée, façade crawlers et cron.
import { AI_REFERRER_LABELS, REFERRER_LABELS } from './ai-bots.mjs';
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
