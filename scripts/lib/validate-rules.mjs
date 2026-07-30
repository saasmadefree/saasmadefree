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
  return [...String(template).matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]);
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
        errors.push(`data/i18n/${lang}/${slug}.json manquant (déclaré dans markets)`);
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
    if (!validators.toolI18n(entry)) {
      for (const e of validators.toolI18n.errors) {
        errors.push(`data/i18n/${key}.json ${e.instancePath || '/'} ${e.message}`);
      }
    }
    const slug = key.split('/')[1];
    if (!tools.has(slug)) {
      errors.push(`data/i18n/${key}.json : aucune fiche data/tools/${slug}.json`);
    }
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

  return errors;
}
