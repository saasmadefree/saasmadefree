import { describe, it, expect } from 'vitest';
import { compileValidators } from '../scripts/lib/load-data.mjs';

const validators = compileValidators('schema');

const validTool = {
  slug: 'notion',
  name: 'Notion',
  domains: ['notion.so', 'notion.com'],
  category: 'docs-and-wiki',
  pricing: {
    amount: 10, currency: 'USD', plan: 'Plus', basis: 'monthly per user',
    source: 'https://www.notion.com/pricing', checkedOn: '2026-07-30', confidence: 'high',
  },
  verdict: 'kinda',
  verdictConfidence: 'medium',
  moatType: 'collaboration',
  diyTimeEstimate: 'weekend',
  requirements: ['anthropic-api-key'],
  priorArt: [{ name: 'AppFlowy', url: 'https://appflowy.io', license: 'AGPL-3.0' }],
  relatedSlugs: ['obsidian', 'coda', 'craft'],
  markets: ['en', 'fr'],
  pagePriority: 5,
  verifiedOneShot: false,
};

describe('tool.schema.json', () => {
  it('accepte une fiche complète et correcte', () => {
    expect(validators.tool(validTool)).toBe(true);
  });

  it('refuse un verdict hors énumération', () => {
    expect(validators.tool({ ...validTool, verdict: 'maybe' })).toBe(false);
  });

  it('refuse un slug avec une majuscule', () => {
    expect(validators.tool({ ...validTool, slug: 'Notion' })).toBe(false);
  });

  it('refuse une liste de domaines vide', () => {
    expect(validators.tool({ ...validTool, domains: [] })).toBe(false);
  });

  it('refuse un champ inconnu', () => {
    expect(validators.tool({ ...validTool, sponsored: true })).toBe(false);
  });

  it('refuse une date checkedOn mal formée', () => {
    const broken = { ...validTool, pricing: { ...validTool.pricing, checkedOn: '30/07/2026' } };
    expect(validators.tool(broken)).toBe(false);
  });
});

describe('agent.schema.json', () => {
  const validAgent = {
    id: 'cursor',
    name: 'Cursor',
    kind: 'deeplink',
    template: 'cursor://anysphere.cursor-deeplink/prompt?text={prompt}',
    homepage: 'https://cursor.com',
    maxLength: 8000,
    status: 'verified',
    verifiedOn: '2026-07-30',
    runHint: 'cursor-deeplink',
    docs: 'https://cursor.com/docs/integrations/deeplinks',
  };

  it('accepte un agent complet', () => {
    expect(validators.agent(validAgent)).toBe(true);
  });

  it('refuse un statut inconnu', () => {
    expect(validators.agent({ ...validAgent, status: 'maybe' })).toBe(false);
  });
});

describe('tool-i18n.schema.json', () => {
  const validI18n = {
    tagline: 'Un espace de travail tout-en-un.',
    verdictSummary: 'Un raisonnement honnête en un paragraphe.',
    coreLoopDIY: 'Ce que la version maison fait vraiment.',
    whatYouLose: ['la collaboration temps réel'],
    whyPeopleStillPay: 'Un paragraphe honnête.',
    notes: 'Une ligne éditoriale.',
    prompt: 'Construis-moi un…',
    faq: [
      { q: 'Q1', a: 'R1' }, { q: 'Q2', a: 'R2' },
      { q: 'Q3', a: 'R3' }, { q: 'Q4', a: 'R4' },
    ],
  };

  it('accepte une fiche traduite complète', () => {
    expect(validators.toolI18n(validI18n)).toBe(true);
  });

  it('refuse une FAQ de trois questions', () => {
    expect(validators.toolI18n({ ...validI18n, faq: validI18n.faq.slice(0, 3) })).toBe(false);
  });
});
