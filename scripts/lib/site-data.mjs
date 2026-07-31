import { LANGS } from './load-data.mjs';
import { MONTHLY_BASES } from './site-format.mjs';

export const SITE_ORIGIN = 'https://saasmadefree.com';
export const VOTE_ENDPOINT = 'https://votes.saasmadefree.com/api/v1/vote';
export const VOTES_FEED_URL = 'https://votes.saasmadefree.com/feed/v1/votes.json';

// Le build essaie une seule fois de récupérer les compteurs réels au moment
// de générer les pages, pour que le tri "par votes" et l'affichage initial
// (avant que le JS client ne rafraîchisse) reflètent des chiffres vrais.
// Si le réseau n'est pas disponible (bac à sable CI, offline), on ne doit
// jamais inventer un chiffre : on renvoie null et les pages retombent sur
// pagePriority sans afficher le moindre badge de vote — voir la règle
// d'honnêteté du projet.
export async function fetchVoteCounts(timeoutMs = 6000) {
  if (typeof fetch !== 'function') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(VOTES_FEED_URL, { signal: controller.signal });
    if (!res.ok) return null;
    const body = await res.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    return body;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Langues pour lesquelles au moins une fiche déclare des pages (ordre canonique LANGS). */
export function siteLanguages(tools) {
  const present = new Set();
  for (const tool of tools.values()) {
    for (const lang of tool.markets) present.add(lang);
  }
  return LANGS.filter((lang) => present.has(lang));
}

export function toolsForLang(tools, lang) {
  return [...tools.values()].filter((tool) => tool.markets.includes(lang));
}

/** Tri : nombre de votes décroissant quand on le connaît, sinon pagePriority. */
export function sortTools(list, voteCounts) {
  return [...list].sort((a, b) => {
    if (voteCounts) {
      const diff = (voteCounts[b.slug] ?? 0) - (voteCounts[a.slug] ?? 0);
      if (diff !== 0) return diff;
    }
    return b.pagePriority - a.pagePriority;
  });
}

/** Catégories réellement présentes pour une langue donnée, triées par slug. */
export function categoriesForLang(tools, lang) {
  const present = new Set();
  for (const tool of toolsForLang(tools, lang)) present.add(tool.category);
  return [...present].sort();
}

/**
 * Les `limit` catégories les plus peuplées pour une langue donnée, triées
 * par nombre d'outils décroissant (slug en repli pour un ordre stable en cas
 * d'égalité). Recalculé à chaque build à partir des données réelles — jamais
 * une liste écrite en dur — pour que l'accueil reste correct pendant que le
 * catalogue grossit ou que des catégories sont fusionnées. La liste complète
 * reste disponible sur /{lang}/categories/, générée séparément à partir de
 * `categoriesForLang`.
 */
export function topCategoriesByCount(tools, lang, limit = 12) {
  const counts = new Map();
  for (const tool of toolsForLang(tools, lang)) {
    counts.set(tool.category, (counts.get(tool.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([slugA, countA], [slugB, countB]) => countB - countA || slugA.localeCompare(slugB))
    .slice(0, limit)
    .map(([slug]) => slug);
}

export function categoryLabel(categories, slug, lang) {
  const meta = categories[slug];
  const label = meta?.label?.[lang] ?? meta?.label?.en;
  if (label) return label;
  // Repli honnête : on n'invente pas de traduction, on humanise le slug tel qu'il existe.
  return slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function categoryEmoji(categories, slug) {
  return categories[slug]?.emoji ?? null;
}

/** Langues pour lesquelles une catégorie donnée a au moins un outil publié. */
export function langsForCategory(tools, categorySlug) {
  const present = new Set();
  for (const tool of tools.values()) {
    if (tool.category === categorySlug) {
      for (const lang of tool.markets) present.add(lang);
    }
  }
  return LANGS.filter((lang) => present.has(lang));
}

/**
 * Les cinq chiffres du bandeau "figures" de l'accueil — voir la règle
 * d'honnêteté du projet : chacun doit être substantiable par ce dépôt, pas
 * une estimation. `totalMonthlyUsd` ne somme que les fiches en USD dont
 * `pricing.basis` est vraiment mensuel (voir MONTHLY_BASES) : le catalogue
 * contient une poignée de fiches en EUR et une en paiement unique, qu'on ne
 * peut pas additionner honnêtement dans un même total sans fausser le sens
 * du chiffre.
 */
export function catalogueFigures(tools, langs, promptCount) {
  const categories = new Set();
  let totalMonthlyUsd = 0;
  for (const tool of tools.values()) {
    categories.add(tool.category);
    if (tool.pricing.currency === 'USD' && MONTHLY_BASES.has(tool.pricing.basis)) {
      totalMonthlyUsd += tool.pricing.amount;
    }
  }
  return {
    toolsPublished: tools.size,
    categories: categories.size,
    languages: langs.length,
    totalMonthlyUsd,
    prompts: promptCount,
  };
}

/**
 * La "dépense mensuelle détruite" affichée dans le bandeau-ticker : le prix
 * mensuel de chaque outil multiplié par son nombre de votes, sommé — jamais
 * inventé. Renvoie `null` quand le service de vote n'a pas répondu au build
 * (voir fetchVoteCounts) : l'appelant doit alors afficher le bandeau sans le
 * chiffre plutôt que d'y mettre un zéro qui se ferait passer pour une donnée.
 * Comme catalogueFigures, ne somme que les fiches en USD à base mensuelle.
 */
export function mrrDestroyed(tools, voteCounts) {
  if (!voteCounts) return null;
  let total = 0;
  for (const tool of tools.values()) {
    if (tool.pricing.currency !== 'USD' || !MONTHLY_BASES.has(tool.pricing.basis)) continue;
    const count = Object.prototype.hasOwnProperty.call(voteCounts, tool.slug) ? voteCounts[tool.slug] : 0;
    total += tool.pricing.amount * count;
  }
  return total;
}
