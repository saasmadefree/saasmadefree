import { describe, it, expect } from 'vitest';
import { compileValidators } from '../scripts/lib/load-data.mjs';
import { validateAll } from '../scripts/lib/validate-rules.mjs';

const validators = compileValidators('schema');
const TODAY = '2026-07-30';

function makeTool(slug, over = {}) {
  return {
    slug, name: slug, domains: [`${slug}.com`], category: 'docs-and-wiki',
    pricing: { amount: 10, currency: 'USD', plan: 'Pro', basis: 'monthly per user',
      source: 'https://example.com/pricing', checkedOn: '2026-07-01', confidence: 'high' },
    verdict: 'kinda', verdictConfidence: 'medium', moatType: 'collaboration',
    diyTimeEstimate: 'weekend', requirements: ['hosting'],
    relatedSlugs: ['b', 'c', 'd'], markets: ['en'], pagePriority: 5, verifiedOneShot: false,
    ...over,
  };
}

function makeI18n(over = {}) {
  return {
    tagline: 't', verdictSummary: 'v', coreLoopDIY: 'c', whatYouLose: ['x'],
    whyPeopleStillPay: 'w', prompt: 'p',
    faq: [{ q: '1', a: '1' }, { q: '2', a: '2' }, { q: '3', a: '3' }, { q: '4', a: '4' }],
    ...over,
  };
}

function makeData(over = {}) {
  const tools = new Map([
    ['a', makeTool('a')], ['b', makeTool('b')], ['c', makeTool('c')], ['d', makeTool('d')],
  ]);
  for (const slug of ['a', 'b', 'c', 'd']) {
    tools.get(slug).relatedSlugs = ['a', 'b', 'c', 'd'].filter((s) => s !== slug).slice(0, 3);
  }
  const i18n = new Map(['a', 'b', 'c', 'd'].map((s) => [`en/${s}`, makeI18n()]));
  const ui = new Map([['en', {
    requirements: { hosting: 'Hosting' },
    runHints: { clipboard: 'Paste it' },
  }]]);
  const agents = [{
    id: 'clipboard-only', name: 'Autre agent', kind: 'clipboard', template: null,
    homepage: 'https://example.com', maxLength: null, status: 'verified',
    verifiedOn: TODAY, runHint: 'clipboard', docs: null,
  }];
  return { tools, i18n, ui, agents, categories: { 'docs-and-wiki': {} }, ...over };
}

describe('validateAll', () => {
  it('ne signale rien sur un jeu de données correct', () => {
    expect(validateAll(makeData(), validators, TODAY)).toEqual([]);
  });

  it('signale un relatedSlug inexistant', () => {
    const data = makeData();
    data.tools.get('a').relatedSlugs = ['b', 'c', 'fantome'];
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('fantome');
  });

  it('signale un domaine présent dans deux fiches', () => {
    const data = makeData();
    data.tools.get('b').domains = ['a.com'];
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('a.com');
  });

  it('signale un domaine dupliqué même avec un préfixe www', () => {
    const data = makeData();
    data.tools.get('b').domains = ['www.a.com'];
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('a.com');
  });

  it('signale une langue déclarée sans fichier i18n', () => {
    const data = makeData();
    data.tools.get('a').markets = ['en', 'fr'];
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('data/i18n/fr/tools/a.json');
  });

  it('signale un prix vérifié il y a plus de 180 jours', () => {
    const data = makeData();
    data.tools.get('a').pricing.checkedOn = '2025-12-01';
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('180');
  });

  it('signale une variable de template hors liste blanche', () => {
    const data = makeData();
    data.agents[0].kind = 'url';
    data.agents[0].template = 'https://x.test/?q={prompt}&key={apikey}';
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('apikey');
  });

  it('signale un code requirements sans traduction', () => {
    const data = makeData();
    data.tools.get('a').requirements = ['database'];
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('database');
  });

  it('signale un runHint sans traduction', () => {
    const data = makeData();
    data.agents[0].runHint = 'inconnu';
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('inconnu');
  });

  it('signale un agent de type url sans template', () => {
    const data = makeData();
    data.agents[0].kind = 'url';
    data.agents[0].template = null;
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('template');
  });
});
