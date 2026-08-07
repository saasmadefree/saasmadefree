import {
  RAIL_SLOTS, TAPE_TOP_SLOTS, TAPE_BOTTOM_SLOTS,
  RAIL_LADDER_USD, TAPE_LADDER_USD, ALL_SLOTS,
} from './sponsor-inventory.generated.mjs';

// Durées vendues. Trois mois coûte trois fois le prix du jour, sans remise :
// ce qu'on vend n'est pas un rabais, c'est le verrouillage du tarif avant
// qu'il monte.
export const SELLABLE_MONTHS = new Set([1, 3]);

// Une réservation tient le temps d'une session Stripe. Au-delà, le slot
// repart à la vente : sinon un panier abandonné bloquerait l'inventaire.
export const RESERVATION_MINUTES = 30;

const RAIL = new Set(RAIL_SLOTS);
const TOP = new Set(TAPE_TOP_SLOTS);
const BOTTOM = new Set(TAPE_BOTTOM_SLOTS);

export function kindOf(slot) {
  if (RAIL.has(slot)) return 'rail';
  if (TOP.has(slot) || BOTTOM.has(slot)) return 'tape';
  return null;
}

/** Quel compteur d'occupation gouverne ce slot. */
function bucketOf(slot) {
  if (RAIL.has(slot)) return 'rail';
  if (TOP.has(slot)) return 'top';
  if (BOTTOM.has(slot)) return 'bottom';
  return null;
}

export function ladderIndexFor(slot, paidCounts) {
  const bucket = bucketOf(slot);
  if (!bucket) throw new Error(`slot inconnu "${slot}"`);
  return paidCounts[bucket] ?? 0;
}

/**
 * Prix en centimes. Lève plutôt que de rendre une valeur de repli : un prix
 * faux facturé est pire qu'une requête refusée, et l'appelant traduit
 * l'exception en 409/400 explicite.
 *
 * Seuls les slots `paid` entrent dans `paidCounts` — un `reserved` bloque le
 * slot sans renchérir les autres, sinon six checkouts abandonnés suffiraient
 * à manipuler le barème.
 */
export function priceCentsFor(slot, months, paidCounts) {
  const kind = kindOf(slot);
  if (!kind) throw new Error(`slot inconnu "${slot}"`);
  if (!SELLABLE_MONTHS.has(months)) throw new Error(`durée non vendue : ${months}`);
  const ladder = kind === 'rail' ? RAIL_LADDER_USD : TAPE_LADDER_USD;
  const index = ladderIndexFor(slot, paidCounts);
  if (index >= ladder.length) throw new Error(`inventaire plein pour "${slot}"`);
  return ladder[index] * 100 * months;
}

/** Crée les lignes manquantes. Idempotent : appelé au début de chaque route. */
export async function ensureSlots(env) {
  const stmt = env.DB.prepare(
    "INSERT OR IGNORE INTO sponsor_slots (slot, kind, status) VALUES (?, ?, 'open')"
  );
  await env.DB.batch(ALL_SLOTS.map((slot) => stmt.bind(slot, kindOf(slot))));
}

/**
 * Libère les réservations mortes. Purge opportuniste, au même titre que celle
 * de la table `rate` : appelée en tête de route, best-effort, un échec ne doit
 * jamais empêcher une opération légitime.
 */
export async function releaseExpiredReservations(env, now) {
  try {
    await env.DB.prepare(
      `UPDATE sponsor_slots SET status = 'open', session_id = NULL, reserved_until = NULL
       WHERE status = 'reserved' AND reserved_until < ?`
    ).bind(now.toISOString()).run();
  } catch { /* best-effort */ }
}

/** Nombre de slots `paid` par compartiment de barème. */
export async function paidCounts(env) {
  const { results } = await env.DB.prepare(
    "SELECT slot FROM sponsor_slots WHERE status = 'paid'"
  ).all();
  const counts = { rail: 0, top: 0, bottom: 0 };
  for (const row of results) {
    const bucket = bucketOf(row.slot);
    if (bucket) counts[bucket] += 1;
  }
  return counts;
}

/**
 * Charge utile de GET /api/v1/sponsors/slots.
 *
 * Un slot libre porte son prix du jour ; un slot pris porte sa date de fin et
 * aucun prix. Quand l'inventaire est plein, `priceCents` vaut `null` — jamais
 * zéro, qui se ferait passer pour une donnée.
 */
export async function readSlots(env, now) {
  await ensureSlots(env);
  await releaseExpiredReservations(env, now);
  const counts = await paidCounts(env);
  const { results } = await env.DB.prepare(
    'SELECT slot, status, ends_on FROM sponsor_slots'
  ).all();
  const out = {};
  for (const row of results) {
    if (row.status === 'open') {
      let priceCents = null;
      try { priceCents = priceCentsFor(row.slot, 1, counts); } catch { priceCents = null; }
      out[row.slot] = { status: 'open', priceCents, currency: 'USD' };
    } else {
      out[row.slot] = { status: row.status, endsOn: row.ends_on ?? null };
    }
  }
  return out;
}
