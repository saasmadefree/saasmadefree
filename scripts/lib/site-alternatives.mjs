import { compareKey, daysBetween } from './data-utils.mjs';

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
 * Le complément d'alternativesFor : les projets cités par la fiche mais non
 * affichables (archivés, ou sans commit depuis plus de 365 jours). Ils ne
 * comptent ni dans `n` ni dans le tableau, mais la fiche les nomme encore
 * avec leur état (spec D14 : aucune information perdue, Ruling 19). Ordre
 * de `tool.alternatives`, slug inconnu écarté.
 * @returns {Array<{ project: object, reason: 'archived'|'stale', lastCommit?: string }>}
 */
export function inactiveAlternativesFor(tool, projects, today) {
  const out = [];
  for (const { project: slug } of tool?.alternatives ?? []) {
    const project = projects.get(slug);
    if (!project || isDisplayableProject(project, today)) continue;
    const reason = project.stats.archived === true ? 'archived' : 'stale';
    out.push({ project, reason, ...(project.stats.lastCommit ? { lastCommit: project.stats.lastCommit } : {}) });
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
  const dates = [tool.pricing.checkedOn, ...alts.flatMap(({ project }) => checkedDates(project))];
  // Le format ISO se trie comme du texte : comparaison binaire, sans locale.
  return dates.reduce((max, d) => (d > max ? d : max));
}

// ---- faits vérifiés ou non ---------------------------------------------------
//
// La migration priorArt → projects a écrit `selfHostable: true` et
// `hosted: { exists: false }` sur chaque projet, sans source : ce sont des
// valeurs par défaut, pas des faits (revue finale, finding 2). Elles ne
// s'affichent comme une valeur, et n'alimentent le JSON-LD ou une collection,
// qu'une fois vérifiées par un humain ou par la recherche de la Partie B :
// une date (et la source lue ce jour-là, exigée par le schéma).

/** L'offre hébergée d'un projet est un fait vérifié : elle existe (prix,
 *  source et date obligatoires), ou son absence porte une date. */
export function hostedIsChecked(project) {
  const hosted = project?.hosted;
  if (hosted?.exists === true) return true;
  return hosted?.exists === false && typeof hosted.checkedOn === 'string';
}

/** « Pas d'offre hébergée », vérifié : la seule base d'une offre gratuite
 *  (prix 0) dans le JSON-LD. */
export function noHostedOfferChecked(project) {
  return project?.hosted?.exists === false && hostedIsChecked(project);
}

/** `selfHostable` est un fait vérifié (date et source posées). */
export function selfHostIsChecked(project) {
  return typeof project?.selfHostableCheckedOn === 'string';
}

/** Les dates de relevé qu'une page affiche pour un projet : chiffres GitHub,
 *  offre hébergée, auto-hébergement. */
export function checkedDates(project) {
  return [project.stats?.checkedOn, project.hosted?.checkedOn, project.selfHostableCheckedOn].filter(Boolean);
}

// ---- nature de la licence (Ruling 44) --------------------------------------
//
// Une licence approuvée OSI n'est pas la seule que l'on liste : n8n (licence
// « Sustainable Use »), PLANKA (fair-code) ou Notifuse (BSL 1.1) se lisent et
// s'auto-hébergent, mais ne sont pas open source. `licenseKind`, posé avec sa
// source, le dit. Sans `licenseKind`, la licence vient de l'API GitHub, qui
// ne remonte que des identifiants SPDX : on la tient pour open source.

/** Natures de licence comptées comme « open source » dans un titre : le cœur
 *  d'un projet open-core est sous une licence libre. */
const OPEN_LICENSE_KINDS = new Set(['open-source', 'open-core']);

/** Le projet peut-il être compté dans « N Free & Open Source … » ? Oui sans
 *  `licenseKind` (licence lue sur GitHub), oui pour open-source et
 *  open-core ; non pour source-available et fair-code. */
export function countsAsOpenSource(project) {
  const kind = project?.licenseKind;
  return kind === undefined || OPEN_LICENSE_KINDS.has(kind);
}

/**
 * Variables du titre d'une fiche. `alts` est la sortie d'alternativesFor
 * (déjà filtrée sur les projets affichables). L'année vient de la date de
 * build, jamais d'une constante. `fallback` signale qu'il y a trop peu
 * d'alternatives pour un titre chiffré : c'est son seul effet, la fiche
 * reste indexable. `none` (n = 0) : aucune alternative à auto-héberger, le
 * titre ne promet donc que le « construis le tien » (finding 11).
 * `nOpen` : les seules alternatives comptées dans « N Free & Open Source »
 * (countsAsOpenSource). `notOpen` : assez d'alternatives pour un titre chiffré
 * (n ≥ 3), mais trop peu d'open source (nOpen < 3) pour écrire « Open
 * Source » : la fiche prend alors un titre chiffré sans ces mots (Ruling 44).
 * @param {{ name: string }} tool
 * @param {Array<{ project?: object }>} alts
 * @param {string} buildDate  'YYYY-MM-DD'
 * @returns {{ n: number, nOpen: number, name: string, year: string, fallback: boolean, none: boolean, notOpen: boolean }}
 */
export function toolTitleVars(tool, alts, buildDate) {
  const n = alts.length;
  const nOpen = alts.filter((alt) => countsAsOpenSource(alt?.project)).length;
  const fallback = n < MIN_TITLE_ALTERNATIVES;
  return {
    n, nOpen, name: tool.name, year: buildDate.slice(0, 4),
    fallback, none: n === 0, notOpen: !fallback && nOpen < MIN_TITLE_ALTERNATIVES,
  };
}

/** Nombre de fiches du bloc « People also look for alternatives to… ». */
export const POPULAR_LIMIT = 12;

/**
 * Fiches du bloc « People also look for alternatives to… » en bas d'une
 * fiche (Ruling 26). D'abord les fiches de la MÊME catégorie publiées dans
 * la langue, par `pagePriority` décroissant puis slug ; puis, pour arriver à
 * `limit`, le classement global : `pagePriority` décroissant, nombre
 * d'alternatives affichables décroissant, slug. Dans les deux passes, ni la
 * fiche courante ni ses `relatedSlugs` (déjà liés juste au-dessus), et
 * jamais deux fois la même fiche. Résultat : la liste change d'une
 * catégorie à l'autre au lieu d'être la même sur toutes les fiches.
 * Le nombre d'alternatives est lu sur `alternativeNames`, que
 * buildToolViews (build-site.mjs) calcule déjà avec alternativesFor.
 * Les slugs se comparent en binaire : même ordre sur toutes les machines.
 * @param {Map<string, object>|object[]} tools  vues de fiches (avec `markets`)
 * @param {string} lang
 * @param {number} [limit=12]
 * @param {{ current?: { slug: string, category?: string, relatedSlugs?: string[] } }} [opts]
 * @returns {object[]}
 */
export function popularAlternatives(tools, lang, limit = POPULAR_LIMIT, { current } = {}) {
  const bySlug = (a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
  const priority = (tool) => tool.pagePriority ?? 0;
  const count = (tool) => tool.alternativeNames?.length ?? 0;
  const excluded = new Set([current?.slug, ...(current?.relatedSlugs ?? [])].filter(Boolean));
  const pool = valuesOf(tools).filter((tool) => !excluded.has(tool.slug) && (tool.markets ?? []).includes(lang));

  const sameCategory = current?.category
    ? pool.filter((tool) => tool.category === current.category).sort((a, b) => priority(b) - priority(a) || bySlug(a, b))
    : [];
  const taken = new Set(sameCategory.slice(0, limit).map((tool) => tool.slug));
  const global = pool
    .filter((tool) => !taken.has(tool.slug))
    .sort((a, b) => priority(b) - priority(a) || count(b) - count(a) || bySlug(a, b));
  return [...sameCategory, ...global].slice(0, limit);
}
