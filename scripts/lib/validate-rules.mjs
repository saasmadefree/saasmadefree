import { LANGS } from './load-data.mjs';

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

function findPlaceholders(entry, path, errors) {
  const walk = (value, field) => {
    if (typeof value === 'string') {
      const hit = PLACEHOLDER_UPPER.exec(value) ?? PLACEHOLDER_ANY_CASE.exec(value);
      if (hit) {
        errors.push(`${path} : ${field} contient un marqueur de gabarit "${hit[0]}"`);
      }
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
  for (const [field, value] of Object.entries(entry)) walk(value, field);
}

function daysBetween(fromIso, toIso) {
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

export function validateAll(data, validators, today) {
  const errors = [];
  const { tools, i18n, ui, agents } = data;

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
    findPlaceholders(entry, path, errors);
  }

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

  // Bloc site.stats : la page /stats existe dans chaque langue publiée, donc
  // chaque langue doit porter exactement les clés de en — pas une de plus
  // (clé morte), pas une de moins (libellé anglais qui fuit dans une page fr).
  const enStats = ui.get('en')?.site?.stats;
  if (!enStats) {
    errors.push('data/i18n/en/ui.json : bloc site.stats manquant');
  } else {
    const expected = new Set(Object.keys(enStats));
    for (const [lang, table] of ui) {
      if (lang === 'en') continue;
      const stats = table?.site?.stats ?? {};
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

  // Langues réellement publiées : celles qu'au moins une fiche déclare dans ses
  // markets — la même source que siteLanguages() côté build.
  //
  // Cette liste se déduisait de la présence d'un bloc "site" dans le ui.json.
  // Ce raccourci est devenu faux le jour où /stats a donné un bloc site.stats
  // aux sept locales : les sept seraient passées pour publiées, et un sponsor
  // aurait dû fournir une tagline en néerlandais pour que le build passe.
  const publishedLangs = LANGS.filter(
    (lang) => [...tools.values()].some((tool) => tool.markets?.includes(lang))
  );
  validateSponsors(data.sponsors, validators, publishedLangs, today, errors);

  return errors;
}
