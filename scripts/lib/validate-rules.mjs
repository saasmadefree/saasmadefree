import { LANGS } from './load-data.mjs';

export const ALLOWED_VARS = new Set(['prompt', 'prompt_url', 'lang', 'slug']);
const MAX_PRICE_AGE_DAYS = 180;

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

  return errors;
}
