import { describe, it, expect } from 'vitest';
import { buildIndex, buildToolRecord, buildSlugList } from '../scripts/lib/feed.mjs';

const notion = {
  slug: 'notion', name: 'Notion',
  domains: ['notion.so', 'www.notion.com', 'app.notion.so'],
  category: 'docs-and-wiki',
  pricing: { amount: 10, currency: 'USD', plan: 'Plus', basis: 'monthly per user',
    source: 'https://example.com', checkedOn: '2026-07-30', confidence: 'high' },
  verdict: 'kinda', verdictConfidence: 'medium', moatType: 'collaboration',
  diyTimeEstimate: 'weekend', requirements: ['hosting'],
  relatedSlugs: ['a', 'b', 'c'], markets: ['en', 'fr'], pagePriority: 9, verifiedOneShot: false,
};

const i18nEn = {
  tagline: 'All-in-one workspace', verdictSummary: 'Summary', coreLoopDIY: 'Loop',
  whatYouLose: ['multiplayer'], whyPeopleStillPay: 'Habit', prompt: 'Build me…',
  faq: [{ q: '1', a: '1' }, { q: '2', a: '2' }, { q: '3', a: '3' }, { q: '4', a: '4' }],
};

describe('buildIndex', () => {
  const index = buildIndex(new Map([['notion', notion]]));

  it('indexe chaque domaine déclaré', () => {
    expect(index['notion.so'].slug).toBe('notion');
    expect(index['app.notion.so'].slug).toBe('notion');
  });

  it('retire le préfixe www', () => {
    expect(index['notion.com']).toBeDefined();
    expect(index['www.notion.com']).toBeUndefined();
  });

  it('expose le prix et le verdict', () => {
    expect(index['notion.so']).toMatchObject({ verdict: 'kinda', amount: 10, currency: 'USD' });
  });

  it('expose une url par langue de marché', () => {
    expect(index['notion.so'].url).toBe('/en/tools/notion');
  });
});

describe('buildToolRecord', () => {
  const record = buildToolRecord(notion, i18nEn, 'en');

  it('fusionne les faits et l’éditorial', () => {
    expect(record.name).toBe('Notion');
    expect(record.tagline).toBe('All-in-one workspace');
    expect(record.verdict).toBe('kinda');
  });

  it('expose l’url du prompt en texte brut', () => {
    expect(record.promptUrl).toBe('/feed/v1/en/prompts/notion.txt');
  });

  it('n’expose pas les champs internes de pilotage', () => {
    expect(record.pagePriority).toBeUndefined();
    expect(record.markets).toBeUndefined();
  });
});

describe('buildSlugList', () => {
  it('renvoie les slugs triés', () => {
    const tools = new Map([['zulip', {}], ['airtable', {}], ['notion', {}]]);
    expect(buildSlugList(tools)).toEqual(['airtable', 'notion', 'zulip']);
  });
});
