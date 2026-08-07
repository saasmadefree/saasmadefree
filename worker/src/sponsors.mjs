import {
  RAIL_SLOTS, TAPE_TOP_SLOTS, TAPE_BOTTOM_SLOTS,
  RAIL_LADDER_USD, TAPE_LADDER_USD, ALL_SLOTS,
} from './sponsor-inventory.generated.mjs';
import { dayKey } from './hash.mjs';

// Durées vendues. Trois mois coûte trois fois le prix du jour, sans remise :
// ce qu'on vend n'est pas un rabais, c'est le verrouillage du tarif avant
// qu'il monte.
export const SELLABLE_MONTHS = new Set([1, 3]);

// Durée de vie demandée à Stripe pour une session de paiement (`expires_at`).
// Stripe impose un plancher de 30 minutes et le valide contre SA propre
// horloge, au moment où il traite la requête : demander pile 30 minutes serait
// refusé pour quelques centaines de millisecondes de latence réseau. On
// demande 32, la première valeur qui tient sans compter sur la chance.
export const CHECKOUT_MINUTES = 32;

// Une réservation tient le temps d'une session Stripe, et un peu plus. Au-delà,
// le slot repart à la vente : sinon un panier abandonné bloquerait
// l'inventaire. L'écart avec CHECKOUT_MINUTES n'est pas décoratif : la session
// ne doit JAMAIS survivre à la réservation, sinon un lien de paiement encore
// valide pointe sur un slot déjà relâché, et l'acheteur paie pour rien.
export const RESERVATION_MINUTES = CHECKOUT_MINUTES + 3;

// Plafond de réservations simultanées par visiteur. Réserver ne coûte rien et
// n'exige aucun compte : sans plafond, ~28 requêtes suffisent à rendre tout
// l'inventaire indisponible sans payer un centime, indéfiniment. Deux couvrent
// largement un acheteur légitime (un achat en cours, une hésitation) ; trois
// n'arrivent pas.
export const MAX_HOLDS_PER_VISITOR = 2;

// Langues RÉELLEMENT PUBLIÉES par le build. Ce n'est pas `LANGS`
// (scripts/lib/load-data.mjs), qui énumère les langues possibles : le site ne
// génère `dist/<lang>/sponsor/` que pour les langues qui ont du contenu
// (`siteLanguages()`, dérivé des `markets` des outils). Une langue listée ici
// mais non publiée renverrait l'acheteur sur une 404 juste après l'avoir
// débité — exactement ce qu'on corrige.
//
// Liste courte et volontairement écrite à la main : la dérive est interdite
// par tests/sponsor-checkout-urls.test.mjs, qui la compare aux langues que le
// build produit vraiment. Le jour où une langue s'ajoute, ce test devient
// rouge et nomme la correction à faire.
export const SITE_LANGS = new Set(['en', 'fr']);
export const DEFAULT_LANG = 'en';

/**
 * URLs de retour de la session Stripe.
 *
 * Le site est entièrement préfixé par langue (`dist/<lang>/sponsor/`) et n'a
 * aucune page `/sponsor` à la racine : y renvoyer l'acheteur après paiement lui
 * servirait une 404, ce qui se lit comme un paiement échoué. Une langue
 * inconnue — ou hostile — retombe sur l'anglais plutôt que de fabriquer une
 * URL morte ou de laisser un tiers choisir la destination.
 */
export function checkoutUrls(origin, lang) {
  const safe = SITE_LANGS.has(lang) ? lang : DEFAULT_LANG;
  const page = `${origin}/${safe}/sponsor`;
  return { successUrl: `${page}?paid=1`, cancelUrl: page };
}

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
    // `reserved_until IS NULL` fait partie de la garde : une ligne `reserved`
    // sans échéance est aujourd'hui inatteignable (reserveSlot en pose
    // toujours une), mais rien ne l'empêche demain — un import, une reprise
    // manuelle — et elle resterait alors bloquée à jamais, puisqu'une
    // comparaison SQL avec NULL n'est jamais vraie.
    await env.DB.prepare(
      `UPDATE sponsor_slots SET status = 'open', session_id = NULL, reserved_until = NULL
       WHERE status = 'reserved' AND (reserved_until IS NULL OR reserved_until < ?)`
    ).bind(now.toISOString()).run();
  } catch { /* best-effort */ }
}

/**
 * Identifiant d'une réservation. Il porte le hachage d'IP du visiteur, ce qui
 * permet de compter ses réservations en cours sans ajouter de colonne ni de
 * migration. Il vit dans `session_id` jusqu'au paiement : le webhook le
 * retrouve dans les métadonnées de la session Stripe, et c'est lui — pas
 * l'identifiant Stripe — qui identifie la réservation à honorer.
 */
export function holdIdFor(ipHash) {
  return `h:${ipHash}:${crypto.randomUUID()}`;
}

/** Hachage d'IP porté par un identifiant de réservation, sinon null. */
export function holderOf(sessionId) {
  if (typeof sessionId !== 'string') return null;
  const parts = sessionId.split(':');
  return parts.length === 3 && parts[0] === 'h' && parts[1] !== '' ? parts[1] : null;
}

/**
 * Slots actuellement tenus par ce visiteur : `{ count, slots }`. On relit les
 * lignes `reserved` (28 au maximum) et on trie en mémoire — à cette taille, un
 * comptage SQL n'achèterait rien qu'une requête moins lisible.
 *
 * Rendre l'ensemble des slots, et pas seulement leur nombre, sert au plafond :
 * il ne doit pas se déclencher quand le visiteur redemande un emplacement
 * qu'il détient déjà, sinon il fermerait la porte devant la reprise et
 * rendrait un 429 sur son propre slot.
 *
 * À appeler APRÈS releaseExpiredReservations, sinon des réservations mortes
 * compteraient contre un acheteur légitime.
 */
export async function holdsOf(env, ipHash) {
  const { results } = await env.DB.prepare(
    "SELECT slot, session_id FROM sponsor_slots WHERE status = 'reserved'"
  ).all();
  const slots = new Set();
  for (const row of results) {
    if (holderOf(row.session_id) === ipHash) slots.add(row.slot);
  }
  return { count: slots.size, slots };
}

/**
 * Réserve un slot. Le `WHERE` est la garde de concurrence : D1 sérialise
 * l'instruction, donc deux acheteurs simultanés sur L1 ne peuvent pas gagner
 * tous les deux, sans transaction explicite. Zéro ligne modifiée = le slot
 * vient d'être pris.
 *
 * Deux cas passent, et deux seulement :
 * - le slot est libre ;
 * - il est réservé par CE MÊME visiteur, reconnu au hachage d'IP porté par
 *   l'identifiant de réservation. Sans cette branche, revenir en arrière
 *   depuis Stripe (`cancel_url`) puis recliquer le même emplacement rendrait
 *   un `slot_taken` sur sa propre réservation, pendant 35 minutes — et
 *   quelques hésitations suffiraient à se fermer tout l'inventaire via le
 *   plafond de réservations.
 *
 * La comparaison se fait sur le préfixe `h:<hachage>:` en SQL, dans la même
 * instruction : la sortir en lecture préalable rouvrirait la fenêtre de course
 * que cette garde existe précisément pour fermer. `substr`/`length` plutôt que
 * `LIKE` pour qu'aucun caractère de la valeur ne puisse être interprété comme
 * un motif.
 */
export async function reserveSlot(env, slot, sessionId, now) {
  const until = new Date(now.getTime() + RESERVATION_MINUTES * 60_000).toISOString();
  // `null` quand l'identifiant n'est pas de la forme attendue : la branche de
  // reprise est alors désactivée, et seule un slot libre passe.
  const holder = holderOf(sessionId);
  const prefix = holder === null ? null : `h:${holder}:`;
  const res = await env.DB.prepare(
    `UPDATE sponsor_slots SET status = 'reserved', session_id = ?, reserved_until = ?
      WHERE slot = ?
        AND (status = 'open'
             OR (? IS NOT NULL
                 AND status = 'reserved'
                 AND substr(session_id, 1, length(?)) = ?))`
  ).bind(sessionId, until, slot, prefix, prefix, prefix).run();
  return (res.meta?.changes ?? 0) > 0;
}

/**
 * Relibère une réservation qu'on vient de poser. Appelée quand la création de
 * la session Stripe échoue : sans elle, un incident chez Stripe bloquerait le
 * slot le temps d'une réservation entière (RESERVATION_MINUTES) pour rien.
 * `session_id = ?` garantit qu'on ne libère que sa propre réservation, jamais
 * celle d'un autre acheteur.
 */
export async function releaseSlot(env, slot, sessionId) {
  const res = await env.DB.prepare(
    `UPDATE sponsor_slots SET status = 'open', session_id = NULL, reserved_until = NULL
     WHERE slot = ? AND status = 'reserved' AND session_id = ?`
  ).bind(slot, sessionId).run();
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
 * - `status = 'reserved'` et la ligne appartient au payeur — soit exactement la
 *   réservation qui a ouvert la session (`session_id = holdId`), soit une
 *   réservation du MÊME détenteur. Cette seconde branche est indispensable
 *   depuis qu'un visiteur peut reprendre sa propre réservation : reprendre
 *   remplace l'identifiant dans la ligne, mais n'expire pas la session Stripe
 *   déjà créée (`cancel_url` ne l'expire pas, elle vit ses CHECKOUT_MINUTES).
 *   Sans elle, payer par l'ancien onglet donnait un encaissement sans
 *   emplacement — même slot, même visiteur, aucune ambiguïté à lever ;
 * - un slot déjà `paid` ne bouge pas — ni par rejeu du même événement, ni par
 *   un événement portant sur un slot vendu entre-temps à quelqu'un d'autre.
 *   Un vrai double paiement du même visiteur reste donc `unassigned` pour la
 *   seconde session, ce qui est le comportement voulu.
 *
 * Une fois attribué, le slot porte l'identifiant de la session Stripe : c'est
 * lui qui relie la ligne à la commande encaissée.
 *
 * Rend `true` si le slot a été attribué.
 */
export async function markSlotPaid(env, slot, holdId, sessionId, months, now) {
  const startsOn = dayKey(now);
  const endsOn = dayKey(addMonths(now, months));
  // Même comparaison exacte que dans reserveSlot : `hashIp` rend toujours 64
  // caractères hexadécimaux, donc le préfixe fait exactement 67 caractères et
  // aucun hachage ne peut être le préfixe strict d'un autre.
  const holder = holderOf(holdId);
  const prefix = holder === null ? null : `h:${holder}:`;
  const res = await env.DB.prepare(
    `UPDATE sponsor_slots
        SET status = 'paid', session_id = ?, reserved_until = NULL,
            starts_on = ?, ends_on = ?
      WHERE slot = ?
        AND (status = 'open'
             OR (status = 'reserved'
                 AND (session_id = ?
                      OR (? IS NOT NULL
                          AND substr(session_id, 1, length(?)) = ?))))`
  ).bind(sessionId, startsOn, endsOn, slot, holdId, prefix, prefix, prefix).run();
  return (res.meta?.changes ?? 0) > 0;
}

// Verdicts d'attribution. Ils pilotent deux choses que le webhook ne doit pas
// confondre : le statut écrit dans la commande, et le code HTTP rendu à Stripe.
export const SLOT_ASSIGNED = 'assigned';
export const SLOT_CONFLICT = 'conflict';
export const SLOT_RETRY = 'retry';

/**
 * Attribue le slot à une session payée, et surtout : dit POURQUOI ça a échoué
 * quand ça échoue. `markSlotPaid` peut légitimement ne toucher aucune ligne, et
 * traiter ce cas comme un succès produirait l'anomalie la plus coûteuse du
 * système — de l'argent encaissé, une commande marquée `paid`, aucun
 * emplacement attribué, et aucun signal.
 *
 * - `SLOT_ASSIGNED` : attribué, ou déjà attribué à cette même session (rejeu
 *   d'un événement déjà honoré — Stripe rejoue, ça doit converger) ;
 * - `SLOT_CONFLICT` : quelqu'un d'autre le détient valablement. Réessayer ne
 *   le libérera pas ; c'est un remboursement qu'un humain doit trancher ;
 * - `SLOT_RETRY` : personne ne le détient valablement (réservation morte pas
 *   encore balayée). Le prochain essai de Stripe passera par la branche
 *   `open` — ça se répare tout seul, à condition de répondre un statut
 *   réessayable.
 */
export async function assignPaidSlot(env, { slot, holdId, sessionId, months, now }) {
  if (await markSlotPaid(env, slot, holdId, sessionId, months, now)) return SLOT_ASSIGNED;

  const row = await env.DB.prepare(
    'SELECT status, session_id, reserved_until FROM sponsor_slots WHERE slot = ?'
  ).bind(slot).first();

  if (row?.status === 'paid' && row.session_id === sessionId) return SLOT_ASSIGNED;
  if (row?.status === 'paid') return SLOT_CONFLICT;
  // Une réservation échue ne « détient » plus rien : elle sera balayée, et
  // l'essai suivant gagnera. Seule une réservation encore vivante est un vrai
  // conflit.
  if (row?.status === 'reserved' && row.reserved_until && row.reserved_until > now.toISOString()) {
    return SLOT_CONFLICT;
  }
  return SLOT_RETRY;
}

/**
 * Enregistre la commande. Idempotent par la clé primaire `session_id` : Stripe
 * rejoue ses événements, un rejeu ne doit pas créer une seconde commande.
 *
 * `status` vaut `paid` quand l'emplacement a bien été attribué, `unassigned`
 * sinon — pour qu'un `WHERE status = 'unassigned'` retrouve en une requête tout
 * ce qui a été encaissé sans être honoré. Un rejeu qui aboutit là où le premier
 * essai avait échoué corrige le statut : `INSERT OR IGNORE` ne met pas à jour
 * la ligne existante. La correction ne va que dans un sens, jamais de `paid`
 * vers `unassigned`.
 */
export async function recordOrder(env, order) {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO sponsor_orders
       (session_id, slot, months, amount_cents, currency, email, name, domain,
        tagline, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    order.sessionId, order.slot, order.months, order.amountCents, order.currency,
    order.email, order.name, order.domain, order.tagline, order.status, order.createdAt
  ).run();

  if (order.status === 'paid') {
    await env.DB.prepare(
      "UPDATE sponsor_orders SET status = 'paid' WHERE session_id = ? AND status = 'unassigned'"
    ).bind(order.sessionId).run();
  }
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
