import { LANGS } from './load-data.mjs';
import { siteLanguages } from './site-data.mjs';

export const ALLOWED_VARS = new Set(['prompt', 'prompt_url', 'lang', 'slug']);
const MAX_PRICE_AGE_DAYS = 180;

/**
 * Seul canal d'avertissement du module.
 *
 * Un avertissement ne rejoint jamais le tableau d'erreurs : `validateAll`
 * continue de rendre exactement la liste des problèmes bloquants, et
 * `scripts/validate.mjs` sort toujours en 0 quand il n'y a que des
 * avertissements. C'est la distinction que demande la spec §5 pour les
 * placements échus.
 */
function warn(message) {
  console.warn(`avertissement — ${message}`);
}

export function normalizeDomain(domain) {
  let d = String(domain).trim().toLowerCase();
  if (d.endsWith('.')) d = d.slice(0, -1);
  if (d.startsWith('www.')) d = d.slice(4);
  return d;
}

export function extractVars(template) {
  return [...String(template).matchAll(/\{([^}]*)\}/g)].map((m) => m[1]);
}

// Les fiches sont d'abord générées sous forme de gabarit, puis réécrites à la
// main. Rien n'empêchait jusqu'ici un gabarit non réécrit d'être commité : la
// CI passait et le site publiait "TODO" comme si c'était une vraie question de
// FAQ. Un annuaire qui affiche son échafaudage comme du contenu perd la seule
// chose qu'il vend, la fiabilité de ce qu'il affirme.
//
// Volontairement sensible à la casse et borné par \b : "todo list", "Todoist"
// ou "à faire" sont des contenus légitimes ici, "TODO" seul ne l'est jamais.
const PLACEHOLDER_UPPER = /\b(TODO|TBD|FIXME|XXX|PLACEHOLDER)\b/;
const PLACEHOLDER_ANY_CASE = /lorem ipsum|à compléter|a completer/i;

/** Parcourt chaque chaîne d'une entrée i18n et appelle visit(texte, chemin).
 *  Les champs de premier niveau listés dans `skip` sont ignorés. */
function walkStrings(entry, visit, skip = []) {
  const walk = (value, field) => {
    if (typeof value === 'string') {
      visit(value, field);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${field}[${i}]`));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) walk(item, `${field}.${key}`);
    }
  };
  for (const [field, value] of Object.entries(entry)) {
    if (!skip.includes(field)) walk(value, field);
  }
}

function findPlaceholders(entry, path, errors) {
  walkStrings(entry, (value, field) => {
    const hit = PLACEHOLDER_UPPER.exec(value) ?? PLACEHOLDER_ANY_CASE.exec(value);
    if (hit) {
      errors.push(`${path} : ${field} contient un marqueur de gabarit "${hit[0]}"`);
    }
  });
}

// Tournures interdites (spec §7), une liste par langue dans
// data/style/banned-phrases.json. Ce sont des racines, comparées sans tenir
// compte de la casse : "revolutioniz" attrape revolutionize, revolutionizing,
// Revolutionized. L'apostrophe typographique est ramenée à l'apostrophe droite
// pour qu'une seule forme suffise dans la liste.
//
// Le prompt n'est jamais contrôlé : c'est une consigne adressée à un agent de
// code, pas de la prose publiée, et "robust error handling" y est légitime.
const normalizeForPhrases = (text) => text.toLowerCase().replace(/[\u2018\u2019]/g, "'");

function findBannedPhrases(entry, path, stems, errors) {
  if (!stems?.length) return;
  const needles = stems.map((stem) => [stem, normalizeForPhrases(stem)]);
  walkStrings(entry, (value, field) => {
    const text = normalizeForPhrases(value);
    for (const [stem, needle] of needles) {
      if (text.includes(needle)) {
        errors.push(`${path} : ${field} contient une tournure interdite "${stem}" (data/style/banned-phrases.json)`);
      }
    }
  }, ['prompt']);
}

/** Clé d'un comparatif, et nom de son fichier de texte : "a-vs-b". */
export function compareKey(a, b) {
  return `${a}-vs-${b}`;
}

const MIN_PROJECT_WORDS = 120;
const MAX_PROJECT_WORDS = 320;

function validateProjects(data, validators, errors) {
  const projects = data.projects ?? new Map();
  const projectI18n = data.projectI18n ?? new Map();
  const banned = data.bannedPhrases ?? {};

  for (const [slug, project] of projects) {
    const path = `data/projects/${slug}.json`;
    if (!validators.project(project)) {
      for (const e of validators.project.errors) {
        errors.push(`${path} ${e.instancePath || '/'} ${e.message}`);
      }
      continue;
    }
    if (project.slug !== slug) {
      errors.push(`${path} : le champ slug vaut "${project.slug}"`);
    }
    // Un projet sans aucun texte est un brouillon (typiquement créé par la
    // migration priorArt → projects) : il n'est pas publiable, les portes
    // d'indexation s'en chargent, mais il est légal. Dès qu'il est rédigé dans
    // une langue, chaque langue de ses markets doit l'être aussi : sinon la
    // version manquante s'afficherait vide ou dans une autre langue sans que
    // personne l'ait décidé.
    const written = project.markets.filter((lang) => projectI18n.has(`${lang}/${slug}`));
    if (written.length > 0) {
      for (const lang of project.markets) {
        if (!projectI18n.has(`${lang}/${slug}`)) {
          errors.push(`data/i18n/${lang}/projects/${slug}.json manquant (déclaré dans markets)`);
        }
      }
    }
  }

  for (const [key, entry] of projectI18n) {
    const [lang, slug] = key.split('/');
    const path = `data/i18n/${lang}/projects/${slug}.json`;
    if (!validators.projectI18n(entry)) {
      for (const e of validators.projectI18n.errors) {
        errors.push(`${path} ${e.instancePath || '/'} ${e.message}`);
      }
    }
    if (!projects.has(slug)) {
      errors.push(`${path} : aucun projet data/projects/${slug}.json`);
    }
    if (typeof entry.description === 'string') {
      const count = entry.description.trim().split(/\s+/).filter(Boolean).length;
      if (count < MIN_PROJECT_WORDS || count > MAX_PROJECT_WORDS) {
        errors.push(
          `${path} : description compte ${count} mots, attendu entre ${MIN_PROJECT_WORDS} et ${MAX_PROJECT_WORDS}`
        );
      }
    }
    findPlaceholders(entry, path, errors);
    findBannedPhrases(entry, path, banned[lang], errors);
  }
}

function validateCompare(data, validators, errors) {
  const pairs = data.compare ?? [];
  const compareI18n = data.compareI18n ?? new Map();
  const banned = data.bannedPhrases ?? {};
  const projects = data.projects ?? new Map();
  const sideExists = { tool: (slug) => data.tools.has(slug), project: (slug) => projects.has(slug) };
  const sideDir = { tool: 'data/tools', project: 'data/projects' };

  if (!validators.compare(pairs)) {
    for (const e of validators.compare.errors) {
      errors.push(`data/compare.json ${e.instancePath || '/'} ${e.message}`);
    }
    return;
  }

  // a-vs-b et b-vs-a sont la même page pour un lecteur et pour Google : on ne
  // garde qu'une orientation, celle déclarée en premier.
  const declared = new Set();
  const seenUnordered = new Map();
  pairs.forEach((pair, i) => {
    const key = compareKey(pair.a, pair.b);
    const at = `data/compare.json[${i}] (${key})`;
    for (const [side, kind] of [[pair.a, pair.kindA], [pair.b, pair.kindB]]) {
      if (!sideExists[kind](side)) {
        errors.push(`${at} : côté inconnu "${side}" (aucun ${sideDir[kind]}/${side}.json)`);
      }
    }
    if (pair.a === pair.b) {
      errors.push(`${at} : les deux côtés sont identiques`);
    }
    const unordered = [pair.a, pair.b].sort().join('\u0000');
    if (seenUnordered.has(unordered)) {
      errors.push(`${at} : paire en double, déjà déclarée comme "${seenUnordered.get(unordered)}"`);
    } else {
      seenUnordered.set(unordered, key);
    }
    declared.add(key);
  });

  for (const [entryKey, entry] of compareI18n) {
    const [lang, key] = entryKey.split('/');
    const path = `data/i18n/${lang}/compare/${key}.json`;
    if (!validators.compareI18n(entry)) {
      for (const e of validators.compareI18n.errors) {
        errors.push(`${path} ${e.instancePath || '/'} ${e.message}`);
      }
    }
    if (!declared.has(key)) {
      errors.push(`${path} : aucune paire "${key}" dans data/compare.json`);
    }
    findPlaceholders(entry, path, errors);
    findBannedPhrases(entry, path, banned[lang], errors);
  }
}

/**
 * Écart en jours entre deux dates 'YYYY-MM-DD', calculé en UTC : en heure
 * locale, un passage à l'heure d'été retirerait une heure à l'intervalle et
 * l'arrondi pourrait faire perdre un jour à un seuil. Partagé avec
 * site-alternatives.mjs (fraîcheur des stats, activité des projets).
 */
export function daysBetween(fromIso, toIso) {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86400000);
}

/**
 * Deux placements peuvent partager un slot tant que leurs périodes ne se
 * croisent pas : l'historique des sponsors passés reste dans le fichier, et
 * c'est ce qui permet de vérifier après coup ce qui a été affiché et quand.
 * Seul un chevauchement est une erreur.
 */
function periodsOverlap(a, b) {
  return a.startsOn <= b.endsOn && b.startsOn <= a.endsOn;
}

function validateSponsors(sponsors, validators, publishedLangs, today, errors) {
  // `sponsors` absent (clé manquante dans `data`, jamais le cas via
  // loadData() qui retombe déjà sur { placements: [] } en cas d'ENOENT) est
  // traité comme un fichier vide. Au-delà de ça, on valide l'objet tel qu'il
  // a été lu — pas une reconstruction — pour que les garanties du schéma sur
  // la racine (clé "placements" exacte, pas de champ parasite) puissent
  // réellement se déclencher.
  const root = sponsors ?? { placements: [] };
  if (!validators.sponsors(root)) {
    for (const e of validators.sponsors.errors) {
      errors.push(`data/sponsors.json ${e.instancePath || '/'} ${e.message}`);
    }
    return;
  }
  const placements = root.placements;

  placements.forEach((placement, i) => {
    const at = `data/sponsors.json[${i}] (${placement.slot})`;

    if (placement.endsOn <= placement.startsOn) {
      errors.push(`${at} : endsOn "${placement.endsOn}" doit être postérieur à startsOn "${placement.startsOn}"`);
    }

    if (normalizeDomain(placement.domain) !== placement.domain) {
      errors.push(`${at} : domaine à normaliser, écrire "${normalizeDomain(placement.domain)}"`);
    }

    for (const lang of publishedLangs) {
      if (!placement.tagline[lang]) {
        errors.push(`${at} : tagline manquante en "${lang}" — le sponsor disparaîtrait de ce site sans avertissement`);
      }
    }

    // Avertissement, jamais une erreur (spec §5) : un placement échu est
    // simplement filtré au rendu et son slot repasse en libre. Faire échouer
    // le build pour ça casserait le site tout seul un dimanche parce qu'un
    // sponsoring est arrivé à échéance — ce serait un défaut, pas une
    // sécurité. Le signaler reste utile : c'est ce qui dit à l'exploitant
    // qu'une ligne est devenue de l'historique et qu'un slot s'est libéré.
    if (placement.endsOn < today) {
      warn(
        `${at} : placement expiré le ${placement.endsOn} — le slot est repassé en libre. ` +
        'Ce n\'est pas une erreur : la ligne reste dans le fichier comme historique.'
      );
    }
  });

  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      if (placements[i].slot === placements[j].slot && periodsOverlap(placements[i], placements[j])) {
        errors.push(
          `data/sponsors.json : deux placements se chevauchent sur le slot "${placements[i].slot}" ` +
          `(index ${i} et ${j})`
        );
      }
    }
  }
}

/** Chemins feuilles d'un objet de traduction ("site.home.colName"), pour la
 *  parité entre locales. Les tableaux sont des feuilles : on vérifie la
 *  présence de la clé, pas la forme de son contenu (le schéma s'en charge). */
export function collectKeyPaths(obj, prefix) {
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = `${prefix}.${key}`;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...collectKeyPaths(value, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

export function validateAll(data, validators, today) {
  const errors = [];
  const { tools, i18n, ui, agents } = data;
  const projects = data.projects ?? new Map();
  const banned = data.bannedPhrases ?? {};

  for (const [slug, tool] of tools) {
    if (!validators.tool(tool)) {
      for (const e of validators.tool.errors) {
        errors.push(`data/tools/${slug}.json ${e.instancePath || '/'} ${e.message}`);
      }
      continue;
    }
    if (tool.slug !== slug) {
      errors.push(`data/tools/${slug}.json : le champ slug vaut "${tool.slug}"`);
    }
    const seenAlternatives = new Set();
    for (const [i, alt] of (tool.alternatives ?? []).entries()) {
      if (!projects.has(alt.project)) {
        errors.push(
          `data/tools/${slug}.json : alternatives[${i}] pointe sur un projet inconnu "${alt.project}" ` +
          `(aucun data/projects/${alt.project}.json)`
        );
      }
      if (seenAlternatives.has(alt.project)) {
        errors.push(`data/tools/${slug}.json : alternatives cite deux fois le projet "${alt.project}"`);
      }
      seenAlternatives.add(alt.project);
    }
    for (const related of tool.relatedSlugs) {
      if (!tools.has(related)) {
        errors.push(`data/tools/${slug}.json : relatedSlug inconnu "${related}"`);
      }
      if (related === slug) {
        errors.push(`data/tools/${slug}.json : relatedSlug pointe sur lui-même`);
      }
    }
    const age = daysBetween(tool.pricing.checkedOn, today);
    if (age > MAX_PRICE_AGE_DAYS) {
      errors.push(
        `data/tools/${slug}.json : prix vérifié il y a ${age} jours, maximum ${MAX_PRICE_AGE_DAYS}`
      );
    }
    for (const lang of tool.markets) {
      if (!i18n.has(`${lang}/${slug}`)) {
        errors.push(`data/i18n/${lang}/tools/${slug}.json manquant (déclaré dans markets)`);
      }
    }
    for (const req of tool.requirements) {
      for (const lang of LANGS) {
        const table = ui.get(lang);
        if (table && !table.requirements?.[req]) {
          errors.push(`data/i18n/${lang}/ui.json : traduction manquante pour requirements.${req}`);
        }
      }
    }
    for (const lang of LANGS) {
      const table = ui.get(lang);
      if (table && !table.pricingBasis?.[tool.pricing.basis]) {
        errors.push(`data/i18n/${lang}/ui.json : traduction manquante pour pricingBasis.${tool.pricing.basis}`);
      }
    }
  }

  const seenDomains = new Map();
  for (const [slug, tool] of tools) {
    for (const domain of tool.domains ?? []) {
      const key = normalizeDomain(domain);
      if (seenDomains.has(key)) {
        errors.push(
          `domaine "${key}" présent dans data/tools/${seenDomains.get(key)}.json et data/tools/${slug}.json`
        );
      } else {
        seenDomains.set(key, slug);
      }
    }
  }

  for (const [key, entry] of i18n) {
    const [entryLang, entrySlug] = key.split('/');
    const path = `data/i18n/${entryLang}/tools/${entrySlug}.json`;
    if (!validators.toolI18n(entry)) {
      for (const e of validators.toolI18n.errors) {
        errors.push(`${path} ${e.instancePath || '/'} ${e.message}`);
      }
    }
    if (!tools.has(entrySlug)) {
      errors.push(`${path} : aucune fiche data/tools/${entrySlug}.json`);
    }
    // FAQ : 4 entrées sur une fiche d'avant la refonte « alternatives », 6 sur
    // une fiche enrichie. Le marqueur d'enrichissement est alternativesIntro,
    // pas le nombre d'alternatives : une fiche migrée peut citer 3 ou 4
    // projets sans qu'on ait encore rien à écrire dans deux FAQ de plus.
    if (Array.isArray(entry.faq)) {
      const count = entry.faq.length;
      if (entry.alternativesIntro !== undefined && count !== 6) {
        errors.push(`${path} : faq compte ${count} entrées, 6 obligatoires dès que alternativesIntro est rédigé`);
      } else if (count === 5) {
        errors.push(`${path} : faq compte 5 entrées, attendu 4 (fiche pas encore enrichie) ou 6`);
      }
    }
    if (entry.alternativeNotes && typeof entry.alternativeNotes === 'object') {
      const listed = new Set((tools.get(entrySlug)?.alternatives ?? []).map((alt) => alt.project));
      for (const project of Object.keys(entry.alternativeNotes)) {
        if (!listed.has(project)) {
          errors.push(`${path} : alternativeNotes.${project} ne correspond à aucun projet de alternatives`);
        }
      }
    }
    findPlaceholders(entry, path, errors);
    findBannedPhrases(entry, path, banned[entryLang], errors);
  }

  validateProjects(data, validators, errors);
  validateCompare(data, validators, errors);

  const seenAgentIds = new Set();
  for (const agent of agents) {
    if (!validators.agent(agent)) {
      for (const e of validators.agent.errors) {
        errors.push(`data/agents.json[${agent.id}] ${e.instancePath || '/'} ${e.message}`);
      }
      continue;
    }
    if (seenAgentIds.has(agent.id)) {
      errors.push(`data/agents.json : identifiant d'agent en double "${agent.id}"`);
    }
    seenAgentIds.add(agent.id);

    if (agent.kind !== 'clipboard' && !agent.template) {
      errors.push(`data/agents.json[${agent.id}] : template obligatoire pour kind="${agent.kind}"`);
    }
    if (agent.template) {
      for (const name of extractVars(agent.template)) {
        if (!ALLOWED_VARS.has(name)) {
          errors.push(`data/agents.json[${agent.id}] : variable non autorisée "${name}"`);
        }
      }
    }
    for (const lang of LANGS) {
      const table = ui.get(lang);
      if (table && !table.runHints?.[agent.runHint]) {
        errors.push(`data/i18n/${lang}/ui.json : traduction manquante pour runHints.${agent.runHint}`);
      }
    }
  }

  // Langues réellement publiées : celles qu'au moins une fiche déclare dans ses
  // markets — la même source que siteLanguages() côté build (site-data.mjs).
  // Calculée ici en premier : la parité du bloc site ci-dessous et la
  // validation des sponsors plus bas en ont toutes deux besoin.
  //
  // Cette liste se déduisait de la présence d'un bloc "site" dans le ui.json.
  // Ce raccourci est devenu faux le jour où /stats a donné un bloc site.stats
  // aux sept locales : les sept seraient passées pour publiées, et un sponsor
  // aurait dû fournir une tagline en néerlandais pour que le build passe.
  const publishedLangs = siteLanguages(tools);

  // Parité du bloc site.* entre langues publiées : la table en fait
  // référence. Seules les langues publiées portent un bloc "site" complet
  // (voir tests/site-shell.test.mjs, « bloc "site" des locales — complet
  // seulement pour les langues publiées ») ; les cinq autres n'ont que
  // { footer, stats } et sortent volontairement de ce contrôle — les comparer
  // au bloc complet de en signalerait des dizaines de "clés manquantes" qui
  // n'ont jamais existé pour elles. Bidirectionnel, même contrat que
  // site.stats ci-dessous : une clé rendue par un gabarit et absente d'une
  // locale publiée sortirait "undefined" en production (comme requirements.*
  // et runHints.*), et une clé qui traîne sans exister en en serait une clé
  // morte ou une faute de frappe.
  const enSite = ui.get('en')?.site;
  if (enSite) {
    const wanted = collectKeyPaths(enSite, 'site');
    const wantedSet = new Set(wanted);
    for (const lang of publishedLangs) {
      if (lang === 'en') continue;
      const table = ui.get(lang);
      if (!table) continue;
      const present = collectKeyPaths(table.site ?? {}, 'site');
      const presentSet = new Set(present);
      for (const path of wanted) {
        if (!presentSet.has(path)) {
          errors.push(`data/i18n/${lang}/ui.json : clé site manquante "${path}"`);
        }
      }
      for (const path of present) {
        if (!wantedSet.has(path)) {
          errors.push(`data/i18n/${lang}/ui.json : clé ${path} absente de en — clé morte ou faute de frappe`);
        }
      }
    }
  }

  // Verrou des locales réduites : une langue NON publiée ne porte qu'un bloc
  // site partiel { footer, stats } par convention (voir ci-dessus et
  // tests/site-shell.test.mjs, « une locale non publiée ne porte que les
  // clés partagées par toutes »). Rien avant ce contrôle n'empêchait une clé
  // de premier niveau étrangère (ex. un "site.home" fuité par erreur) de s'y
  // glisser en silence : elle ne casserait aucun gabarit tant que la page
  // correspondante n'est pas rendue pour cette langue, et resterait invisible
  // jusqu'à la publication de la locale.
  for (const lang of LANGS) {
    if (publishedLangs.includes(lang)) continue;
    const table = ui.get(lang);
    if (!table?.site) continue;
    for (const key of Object.keys(table.site)) {
      if (key !== 'footer' && key !== 'stats') {
        errors.push(`data/i18n/${lang}/ui.json : clé site.${key} interdite dans une locale non publiée`);
      }
    }
  }

  // Bloc site.stats des langues NON publiées : elles ne portent que
  // { footer, stats } (voir ci-dessus), donc le contrôle de parité qui
  // précède — scopé aux langues publiées — ne les couvre pas. La page /stats
  // existe quand même dans les sept langues, donc chaque locale doit porter
  // exactement les clés stats.* de en — pas une de plus (clé morte), pas une
  // de moins (libellé anglais qui fuit dans une page traduite).
  const enStats = ui.get('en')?.site?.stats;
  if (!enStats) {
    errors.push('data/i18n/en/ui.json : bloc site.stats manquant');
  } else {
    const expected = new Set(Object.keys(enStats));
    for (const lang of LANGS) {
      if (publishedLangs.includes(lang)) continue;
      const table = ui.get(lang);
      if (!table) continue;
      const stats = table.site?.stats ?? {};
      for (const key of expected) {
        if (!(key in stats)) errors.push(`data/i18n/${lang}/ui.json : traduction manquante pour site.stats.${key}`);
      }
      for (const key of Object.keys(stats)) {
        if (!expected.has(key)) errors.push(`data/i18n/${lang}/ui.json : clé site.stats.${key} absente de en — clé morte ou faute de frappe`);
      }
    }
  }
  for (const [lang, table] of ui) {
    if (typeof table?.site?.footer?.stats !== 'string') {
      errors.push(`data/i18n/${lang}/ui.json : traduction manquante pour site.footer.stats`);
    }
  }

  validateSponsors(data.sponsors, validators, publishedLangs, today, errors);

  return errors;
}
