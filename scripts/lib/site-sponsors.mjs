// Emplacements sponsors : inventaire, barème, et sélection des placements
// actifs au jour du build. Seul module du site qui connaît le mot "sponsor" —
// tout le reste (renderLayout, build-site) ne fait que lui passer des données.
//
// Aucun prix n'est calculé par une formule : les deux échelles sont écrites en
// clair parce qu'elles sont publiées telles quelles sur /sponsor, et qu'un
// lecteur doit pouvoir vérifier le prix qu'on lui annonce.

export const RAIL_SLOTS = ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4'];
export const RAIL_LEFT_SLOTS = ['L1', 'L2', 'L3', 'L4'];
export const RAIL_RIGHT_SLOTS = ['R1', 'R2', 'R3', 'R4'];

const tapeSlots = (prefix) =>
  Array.from({ length: 10 }, (_, i) => `${prefix}${String(i + 1).padStart(2, '0')}`);

export const TAPE_TOP_SLOTS = tapeSlots('T');
export const TAPE_BOTTOM_SLOTS = tapeSlots('B');

export const RAIL_LADDER_USD = [149, 219, 299, 429, 619, 879, 1259, 1800];
export const TAPE_LADDER_USD = [75, 99, 129, 169, 229, 299, 399, 519, 689, 900];

/**
 * Placements dont la période couvre `today`, bornes incluses.
 *
 * Les dates sont comparées en chaînes ISO : `"2026-08-10"` se compare
 * lexicographiquement dans le bon ordre, ce qui évite d'instancier des Date et
 * de traîner un fuseau horaire dans un build qui doit être reproductible.
 *
 * @param {Array<object>} placements
 * @param {string} today - date ISO "YYYY-MM-DD"
 * @returns {{ bySlot: Map<string, object>, domains: string[] }}
 */
export function selectSponsors(placements, today) {
  const bySlot = new Map();
  const domains = new Set();
  for (const placement of placements ?? []) {
    if (placement.startsOn > today || placement.endsOn < today) continue;
    bySlot.set(placement.slot, placement);
    domains.add(placement.domain);
  }
  return { bySlot, domains: [...domains] };
}

/**
 * Prix du prochain slot d'un inventaire, en dollars.
 *
 * Rend `null` quand l'inventaire est plein : l'appelant doit alors afficher
 * "complet" plutôt qu'un montant, jamais un zéro qui se ferait passer pour un
 * prix (principe 3 de .impeccable.md).
 *
 * Lève une erreur si `kind` n'est ni 'rail' ni 'tape' : silence sur un `kind`
 * inconnu serait une dégradation silencieuse des prix (ex. rail quoté au prix tape).
 */
export function nextPriceUsd(kind, occupiedCount) {
  if (kind !== 'rail' && kind !== 'tape') {
    throw new Error(`nextPriceUsd: kind doit être 'rail' ou 'tape', reçu ${JSON.stringify(kind)}`);
  }
  if (occupiedCount < 0) {
    return null;
  }
  const ladder = kind === 'rail' ? RAIL_LADDER_USD : TAPE_LADDER_USD;
  return occupiedCount < ladder.length ? ladder[occupiedCount] : null;
}
