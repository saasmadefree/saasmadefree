import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, buildToolRecord, buildSlugList, buildAgentIdList } from '../scripts/lib/feed.mjs';
import { loadData } from '../scripts/lib/load-data.mjs';

const notion = {
  slug: 'notion', name: 'Notion',
  domains: ['notion.so', 'www.notion.com', 'app.notion.so'],
  category: 'docs-and-wiki',
  pricing: { amount: 10, currency: 'USD', plan: 'Plus', basis: 'per-seat-monthly',
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

describe('buildAgentIdList', () => {
  it('extrait les ids triés', () => {
    const agents = [{ id: 'cursor' }, { id: 'claude-code-web' }];
    expect(buildAgentIdList(agents)).toEqual(['claude-code-web', 'cursor']);
  });
});

// Contrat public du feed v1 : l'extension Chrome lit `priorArt` dans chaque
// enregistrement. La migration priorArt → projects (scripts/migrate-prior-art.mjs)
// retire le champ des données sources ; le feed doit le dériver de
// `alternatives` et sortir octet pour octet ce qu'il sortait avant. Les
// instantanés de tests/fixtures/feed-before-migration/ ont été écrits AVANT la
// migration, avec le code d'alors, et ne doivent jamais être régénérés.
describe('feed keeps priorArt derived from alternatives', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const fixtures = join(root, 'tests', 'fixtures', 'feed-before-migration');
  const cases = readdirSync(fixtures).filter((f) => f.endsWith('.json')).sort();

  it('couvre les trois fiches de référence dans leurs deux langues', () => {
    expect(cases).toEqual([
      '1password.en.json', '1password.fr.json',
      'mailchimp.en.json', 'mailchimp.fr.json',
      'wispr-flow.en.json', 'wispr-flow.fr.json',
    ]);
  });

  it.each(cases)('%s est identique octet pour octet', async (file) => {
    const [slug, lang] = file.replace(/\.json$/, '').split('.');
    const data = await loadData(root);
    const record = buildToolRecord(data.tools.get(slug), data.i18n.get(`${lang}/${slug}`), lang, data.projects);
    expect(JSON.stringify(record, null, 2) + '\n').toBe(readFileSync(join(fixtures, file), 'utf8'));
  });
});
