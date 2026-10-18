import { normalizeDomain } from './validate-rules.mjs';
import { derivePriorArt } from './prior-art.mjs';

export const FEED_VERSION = 'v1';

export function buildIndex(tools) {
  const index = {};
  for (const tool of tools.values()) {
    const lang = tool.markets.includes('en') ? 'en' : tool.markets[0];
    for (const domain of tool.domains) {
      index[normalizeDomain(domain)] = {
        slug: tool.slug,
        verdict: tool.verdict,
        amount: tool.pricing.amount,
        currency: tool.pricing.currency,
        url: `/${lang}/tools/${tool.slug}`,
      };
    }
  }
  return index;
}

/**
 * Enregistrement v1 d'une fiche. `priorArt` n'existe plus dans les données
 * sources : il est dérivé de `alternatives` et des projets, au format que lit
 * l'extension ({ name, url, license? }). C'est un contrat public : ne pas
 * changer sa forme sans passer à un feed v2.
 */
export function buildToolRecord(tool, i18nEntry, lang, projects) {
  return {
    slug: tool.slug,
    name: tool.name,
    category: tool.category,
    subcategory: tool.subcategory ?? null,
    pricing: tool.pricing,
    verdict: tool.verdict,
    verdictConfidence: tool.verdictConfidence,
    moatType: tool.moatType,
    diyTimeEstimate: tool.diyTimeEstimate,
    requirements: tool.requirements,
    priorArt: derivePriorArt(tool, projects),
    relatedSlugs: tool.relatedSlugs,
    verifiedOneShot: tool.verifiedOneShot,
    lang,
    tagline: i18nEntry.tagline,
    verdictSummary: i18nEntry.verdictSummary,
    coreLoopDIY: i18nEntry.coreLoopDIY,
    whatYouLose: i18nEntry.whatYouLose,
    whyPeopleStillPay: i18nEntry.whyPeopleStillPay,
    notes: i18nEntry.notes ?? null,
    prompt: i18nEntry.prompt,
    promptUrl: `/feed/${FEED_VERSION}/${lang}/prompts/${tool.slug}.txt`,
    faq: i18nEntry.faq,
    url: `/${lang}/tools/${tool.slug}`,
  };
}

export function buildSlugList(tools) {
  return [...tools.keys()].sort();
}

export function buildAgentIdList(agents) {
  return agents.map((agent) => agent.id).sort();
}
