// scripts/lib/data-utils.mjs
//
// Petites fonctions pures partagées par le validateur (validate-rules.mjs) et
// le rendu (site-alternatives.mjs, site-page-compare.mjs). Module feuille :
// il n'importe rien, ce qui évite l'import circulaire qu'il y avait entre
// validate-rules et site-alternatives.

/** Clé d'un comparatif, et nom de son fichier de texte : "a-vs-b". */
export function compareKey(a, b) {
  return `${a}-vs-${b}`;
}

/**
 * Écart en jours entre deux dates 'YYYY-MM-DD', calculé en UTC : en heure
 * locale, un passage à l'heure d'été retirerait une heure à l'intervalle et
 * l'arrondi pourrait faire perdre un jour à un seuil.
 */
export function daysBetween(fromIso, toIso) {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86400000);
}

/** Échappe un texte pour l'insérer tel quel dans une RegExp (le point de
 *  « Cal.diy » reste un point). */
export function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
