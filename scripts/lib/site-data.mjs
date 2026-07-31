import { LANGS } from './load-data.mjs';

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
