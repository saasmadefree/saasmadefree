import { compareKey, daysBetween } from './validate-rules.mjs';

// Données de rendu des pages « alternatives » (fiche, projet, comparatif,
// listes) et portes d'indexation du spec D7. Fonctions pures : aucune lecture
// de fichier, aucune horloge. La date du jour (`today`) et la date de build
// arrivent toujours en paramètre, au format 'YYYY-MM-DD', pour qu'un même jeu
// de données produise toujours les mêmes pages.

/** Au-delà, les métriques GitHub d'un projet sont masquées (le projet reste). */
export const STATS_MAX_AGE_DAYS = 45;
/** Au-delà, un projet sans commit est considéré abandonné et n'est plus affiché. */
export const PROJECT_MAX_IDLE_DAYS = 365;
/** Sous ce nombre d'alternatives affichables, la fiche prend le titre de repli. */
export const MIN_TITLE_ALTERNATIVES = 3;
/** Une collection ou une catégorie n'est indexable qu'à partir de ce nombre d'éléments. */
export const MIN_LIST_ITEMS = 3;

// Les fiches arrivent en Map (loadData) ou en tableau (tests, listes déjà
// filtrées) : on itère sur les valeurs dans les deux cas.
function valuesOf(collection) {
  return collection instanceof Map ? [...collection.values()] : [...collection];
}

/**
 * Un projet est affichable s'il n'est pas archivé et s'il a eu un commit
 * dans les 365 derniers jours. Un projet sans dépôt GitHub (`repo: null`,
 * donc sans `stats`) reste affichable : on ne sait rien de son activité, et
 * l'absence de chiffre n'est pas une preuve d'abandon.
 */
export function isDisplayableProject(project, today) {
  const stats = project?.stats;
  if (!stats) return true;
  if (stats.archived === true) return false;
  return daysBetween(stats.lastCommit, today) <= PROJECT_MAX_IDLE_DAYS;
}

/**
 * Les métriques (étoiles, dernier commit) ne s'affichent que si elles ont été
 * relevées il y a 45 jours au plus. Sans `stats`, rien à afficher : false.
 * Règle d'honnêteté : une métrique périmée se masque, elle ne se montre pas
 * comme si elle était actuelle.
 */
export function statsAreFresh(project, today) {
  const stats = project?.stats;
  if (!stats?.checkedOn) return false;
  return daysBetween(stats.checkedOn, today) <= STATS_MAX_AGE_DAYS;
}

/**
 * Alternatives d'une fiche, résolues en objets projet, dans l'ordre éditorial
 * de `tool.alternatives`. Un slug inconnu ou un projet non affichable est
 * écarté.
 * @param {object} tool
 * @param {Map<string, object>} projects  slug → projet (loadData().projects)
 * @param {string} today  'YYYY-MM-DD'
 * @returns {Array<{ project: object, fit: 'full'|'partial'|'niche' }>}
 */
export function alternativesFor(tool, projects, today) {
  const out = [];
  for (const { project: slug, fit } of tool?.alternatives ?? []) {
    const project = projects.get(slug);
    if (project && isDisplayableProject(project, today)) out.push({ project, fit });
  }
  return out;
}

/**
 * Fiches qui citent un projet dans leurs alternatives, de la plus prioritaire
 * à la moins prioritaire (`pagePriority` décroissant, puis slug pour un ordre
 * stable entre deux builds).
 * @param {string} projectSlug
 * @param {Map<string, object>|object[]} tools
 * @returns {object[]}
 */
export function replacedTools(projectSlug, tools) {
  return valuesOf(tools)
    .filter((tool) => (tool.alternatives ?? []).some((alt) => alt.project === projectSlug))
    .sort((a, b) => (b.pagePriority ?? 0) - (a.pagePriority ?? 0)
      || String(a.slug).localeCompare(String(b.slug)));
}

/**
 * Portes d'indexation (spec D7). Une page qui ne passe pas sa porte est
 * générée quand même, en `noindex,follow` et hors sitemap.
 * Pas de porte pour les fiches : une fiche est toujours indexable (Ruling 2),
 * moins de 3 alternatives ne change que son titre (voir toolTitleVars).
 */
export const indexable = {
  /**
   * Projet affichable (ni archivé, ni sans commit depuis plus de 365 j) ET
   * description rédigée dans la langue ET au moins une fiche qui le cite.
   * Une page de projet abandonné ne doit pas être proposée aux moteurs, même
   * rédigée et citée.
   * @param {{ slug: string, stats?: object }} project
   * @param {string} lang
   * @param {{ projectI18n: Map<string, object>, tools: Map<string, object>|object[], today: string }} ctx
   *   projectI18n : clés 'lang/slug' (loadData().projectI18n) ;
   *   tools : toutes les fiches (loadData().tools) ;
   *   today : date du build, 'YYYY-MM-DD'.
   */
  project(project, lang, ctx) {
    // Sans date du jour, daysBetween rend NaN et la porte se ferme en
    // silence : on préfère casser le build tout de suite.
    if (typeof ctx?.today !== 'string') {
      throw new TypeError("indexable.project : ctx.today doit être une date 'YYYY-MM-DD' (chaîne).");
    }
    if (!isDisplayableProject(project, ctx.today)) return false;
    if (!ctx.projectI18n.has(`${lang}/${project.slug}`)) return false;
    return valuesOf(ctx.tools)
      .some((tool) => (tool.alternatives ?? []).some((alt) => alt.project === project.slug));
  },

  /**
   * Texte du comparatif rédigé dans la langue, pour la paire dans son ordre (a, b).
   * @param {{ a: string, b: string }} pair  entrée de loadData().compare
   * @param {string} lang
   * @param {{ compareI18n: Map<string, object> }} ctx  clés 'lang/a-vs-b'
   */
  compare(pair, lang, ctx) {
    return ctx.compareI18n.has(`${lang}/${compareKey(pair.a, pair.b)}`);
  },

  /** Collection ou catégorie : au moins 3 éléments. */
  list(items) {
    return items.length >= MIN_LIST_ITEMS;
  },
};

/**
 * Date de dernière modification réelle d'une fiche : le plus récent des
 * relevés qui la composent, prix de l'outil et chiffres GitHub des projets
 * affichés. Sert au WebPage.dateModified, à la mention « mis à jour le » et
 * au lastmod du sitemap — jamais la date du build, qui changerait chaque jour
 * sans que rien ne change.
 * @param {{ pricing: { checkedOn: string } }} tool
 * @param {Array<{ project: object }>} alts  sortie d'alternativesFor
 * @returns {string} 'YYYY-MM-DD'
 */
export function toolDateModified(tool, alts) {
  const dates = [tool.pricing.checkedOn, ...alts.map(({ project }) => project.stats?.checkedOn).filter(Boolean)];
  // Le format ISO se trie comme du texte : comparaison binaire, sans locale.
  return dates.reduce((max, d) => (d > max ? d : max));
}

/**
 * Variables du titre d'une fiche. `alts` est la sortie d'alternativesFor
 * (déjà filtrée sur les projets affichables). L'année vient de la date de
 * build, jamais d'une constante. `fallback` signale qu'il y a trop peu
 * d'alternatives pour un titre chiffré : c'est son seul effet, la fiche
 * reste indexable.
 * @param {{ name: string }} tool
 * @param {Array} alts
 * @param {string} buildDate  'YYYY-MM-DD'
 * @returns {{ n: number, name: string, year: string, fallback: boolean }}
 */
export function toolTitleVars(tool, alts, buildDate) {
  const n = alts.length;
  return { n, name: tool.name, year: buildDate.slice(0, 4), fallback: n < MIN_TITLE_ALTERNATIVES };
}
