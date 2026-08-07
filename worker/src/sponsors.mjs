import {
  RAIL_SLOTS, TAPE_TOP_SLOTS, TAPE_BOTTOM_SLOTS,
  RAIL_LADDER_USD, TAPE_LADDER_USD, ALL_SLOTS,
} from './sponsor-inventory.generated.mjs';
import { dayKey } from './hash.mjs';

// Durées vendues. Trois mois coûte trois fois le prix du jour, sans remise :
// ce qu'on vend n'est pas un rabais, c'est le verrouillage du tarif avant
// qu'il monte.
export const SELLABLE_MONTHS = new Set([1, 3]);

// Une réservation tient le temps d'une session Stripe. Au-delà, le slot
// repart à la vente : sinon un panier abandonné bloquerait l'inventaire.
export const RESERVATION_MINUTES = 30;

/**
 * Erreur métier porteuse d'un code machine. Les routes traduisent trois
 * échecs distincts (slot inconnu, durée non vendue, inventaire plein) en
 * statuts HTTP différents : elles doivent s'appuyer sur `code`, jamais sur
 * `message`. Le message reste en français et destiné à un humain — le
 * reformuler ou le traduire ne doit rien casser.
 */
export class SponsorError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SponsorError';
    this.code = code;
  }
}

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
  if (!bucket) throw new SponsorError('unknown_slot', `slot inconnu "${slot}"`);
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
  if (!kind) throw new SponsorError('unknown_slot', `slot inconnu "${slot}"`);
  if (!SELLABLE_MONTHS.has(months)) {
    throw new SponsorError('unsold_duration', `durée non vendue : ${months}`);
  }
  const ladder = kind === 'rail' ? RAIL_LADDER_USD : TAPE_LADDER_USD;
  const index = ladderIndexFor(slot, paidCounts);
  if (index >= ladder.length) {
    throw new SponsorError('inventory_full', `inventaire plein pour "${slot}"`);
  }
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

/**
 * Réserve un slot. `UPDATE … WHERE slot = ? AND status = 'open'` est la
 * garde : D1 sérialise l'instruction, donc deux acheteurs simultanés sur L1 ne
 * peuvent pas gagner tous les deux, sans transaction explicite. Zéro ligne
 * modifiée = le slot vient d'être pris.
 */
export async function reserveSlot(env, slot, sessionId, now) {
  const until = new Date(now.getTime() + RESERVATION_MINUTES * 60_000).toISOString();
  const res = await env.DB.prepare(
    `UPDATE sponsor_slots SET status = 'reserved', session_id = ?, reserved_until = ?
     WHERE slot = ? AND status = 'open'`
  ).bind(sessionId, until, slot).run();
  return (res.meta?.changes ?? 0) > 0;
}

/**
 * Relibère une réservation qu'on vient de poser. Appelée quand la création de
 * la session Stripe échoue : sans elle, un incident chez Stripe bloquerait le
 * slot 30 minutes pour rien. `session_id = ?` garantit qu'on ne libère que sa
 * propre réservation, jamais celle d'un autre acheteur.
 */
export async function releaseSlot(env, slot, sessionId) {
  const res = await env.DB.prepare(
    `UPDATE sponsor_slots SET status = 'open', session_id = NULL, reserved_until = NULL
     WHERE slot = ? AND status = 'reserved' AND session_id = ?`
  ).bind(slot, sessionId).run();
  return (res.meta?.changes ?? 0) > 0;
}

/**
 * Remplace l'identifiant temporaire de réservation par celui de la session
 * Stripe. C'est ce qui permettra au webhook de reconnaître SA réservation :
 * le slot est tenu avant que Stripe n'ait rendu d'identifiant, donc la
 * réservation naît forcément sous un nom provisoire.
 */
export async function attachSession(env, slot, holdId, sessionId) {
  const res = await env.DB.prepare(
    `UPDATE sponsor_slots SET session_id = ?
     WHERE slot = ? AND status = 'reserved' AND session_id = ?`
  ).bind(sessionId, slot, holdId).run();
  return (res.meta?.changes ?? 0) > 0;
}

/**
 * Ajoute des mois à une date, en UTC. Un mois court déborde (31 janvier + 1
 * mois = 3 mars) : le débordement joue toujours en faveur de l'acheteur, qui
 * garde son emplacement quelques jours de plus — jamais l'inverse.
 */
function addMonths(date, months) {
  const out = new Date(date.getTime());
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

/**
 * Conclut la vente : le slot passe `paid` pour `months` mois. Bornes incluses,
 * comme la sélection côté site (`endsOn < today` exclut) et comme l'expiration
 * au cron — sinon un sponsor perdrait sa dernière journée d'un côté et pas de
 * l'autre.
 *
 * La garde `WHERE` est la protection contre le rejeu et le vol :
 * - `status = 'open'` : la réservation avait expiré, l'acheteur qui a payé
 *   récupère quand même son emplacement (la fenêtre de rejeu de Stripe est de
 *   quelques jours, très en deçà du mois minimum vendu — un slot libéré par
 *   l'expiration ne peut donc pas être repris par un vieil événement) ;
 * - `status = 'reserved' AND session_id = ?` : c'est bien notre réservation ;
 * - un slot déjà `paid` ne bouge pas — ni par rejeu du même événement, ni par
 *   un événement portant sur un slot vendu entre-temps à quelqu'un d'autre.
 *
 * Rend `true` si le slot a été attribué.
 */
export async function markSlotPaid(env, slot, sessionId, months, now) {
  const startsOn = dayKey(now);
  const endsOn = dayKey(addMonths(now, months));
  const res = await env.DB.prepare(
    `UPDATE sponsor_slots
        SET status = 'paid', session_id = ?, reserved_until = NULL,
            starts_on = ?, ends_on = ?
      WHERE slot = ?
        AND (status = 'open' OR (status = 'reserved' AND session_id = ?))`
  ).bind(sessionId, startsOn, endsOn, slot, sessionId).run();
  return (res.meta?.changes ?? 0) > 0;
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
