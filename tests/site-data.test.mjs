import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  siteLanguages, toolsForLang, sortTools, categoriesForLang, categoryLabel,
  categoryEmoji, langsForCategory, fetchVoteCounts, VOTES_FEED_URL,
} from '../scripts/lib/site-data.mjs';

function tool(slug, over = {}) {
  return { slug, name: slug, category: 'cat1', markets: ['en'], pagePriority: 5, ...over };
}

describe('siteLanguages', () => {
  it("ne renvoie que les langues déclarées par au moins une fiche, dans l'ordre canonique", () => {
    const tools = new Map([
      ['a', tool('a', { markets: ['fr'] })],
      ['b', tool('b', { markets: ['en'] })],
    ]);
    expect(siteLanguages(tools)).toEqual(['en', 'fr']);
  });

  it('ne plante pas sur un catalogue vide', () => {
    expect(siteLanguages(new Map())).toEqual([]);
  });
});

describe('toolsForLang', () => {
  it('filtre sur markets, une fiche anglais-seul est absente du sous-ensemble fr', () => {
    const tools = new Map([
      ['a', tool('a', { markets: ['en', 'fr'] })],
      ['b', tool('b', { markets: ['en'] })],
    ]);
    expect(toolsForLang(tools, 'en').map((t) => t.slug)).toEqual(['a', 'b']);
    expect(toolsForLang(tools, 'fr').map((t) => t.slug)).toEqual(['a']);
  });
});

describe('sortTools', () => {
  const list = [
    tool('low-priority-many-votes', { pagePriority: 1 }),
    tool('high-priority-no-votes', { pagePriority: 9 }),
    tool('mid', { pagePriority: 5 }),
  ];

  it('trie par nombre de votes décroissant quand les compteurs sont connus', () => {
    const votes = { 'low-priority-many-votes': 10, mid: 3, 'high-priority-no-votes': 0 };
    const sorted = sortTools(list, votes).map((t) => t.slug);
    expect(sorted).toEqual(['low-priority-many-votes', 'mid', 'high-priority-no-votes']);
  });

  it('retombe sur pagePriority pour les ex-æquo de votes', () => {
    const votes = { 'low-priority-many-votes': 1, mid: 1, 'high-priority-no-votes': 1 };
    const sorted = sortTools(list, votes).map((t) => t.slug);
    expect(sorted).toEqual(['high-priority-no-votes', 'mid', 'low-priority-many-votes']);
  });

  it('traite un slug absent de la réponse comme un vrai zéro, pas comme une donnée inconnue', () => {
    const votes = { mid: 1 }; // les deux autres sont absents => 0
    const sorted = sortTools(list, votes).map((t) => t.slug);
    // mid (1 vote) devant les deux à 0, qui se départagent par pagePriority
    expect(sorted).toEqual(['mid', 'high-priority-no-votes', 'low-priority-many-votes']);
  });

  it('retombe entièrement sur pagePriority quand le service de vote est injoignable (null)', () => {
    const sorted = sortTools(list, null).map((t) => t.slug);
    expect(sorted).toEqual(['high-priority-no-votes', 'mid', 'low-priority-many-votes']);
  });

  it('ne modifie pas le tableau reçu en entrée', () => {
    const copy = [...list];
    sortTools(list, null);
    expect(list).toEqual(copy);
  });
});

describe('categoriesForLang / categoryLabel / categoryEmoji', () => {
  const categories = {
    cat1: { emoji: '📄', label: { en: 'Category one', fr: 'Catégorie un' } },
    cat2: { emoji: '📅' }, // pas de label fr ni en : cas de repli
  };

  it('ne renvoie que les catégories réellement présentes pour la langue, triées', () => {
    const tools = new Map([
      ['a', tool('a', { category: 'cat2', markets: ['en'] })],
      ['b', tool('b', { category: 'cat1', markets: ['en'] })],
      ['c', tool('c', { category: 'cat1', markets: ['fr'] })],
    ]);
    expect(categoriesForLang(tools, 'en')).toEqual(['cat1', 'cat2']);
    expect(categoriesForLang(tools, 'fr')).toEqual(['cat1']);
  });

  it('utilise le label traduit quand il existe', () => {
    expect(categoryLabel(categories, 'cat1', 'fr')).toBe('Catégorie un');
    expect(categoryLabel(categories, 'cat1', 'en')).toBe('Category one');
  });

  it("retombe sur le label anglais si la traduction demandée n'existe pas", () => {
    // pas de label du tout pour cat2 => on humanise le slug plutôt que d'inventer une traduction
    expect(categoryLabel(categories, 'cat2', 'fr')).toBe('Cat2');
  });

  it("humanise le slug quand aucun label n'existe, sans inventer de traduction", () => {
    expect(categoryLabel({ 'docs-and-wiki': {} }, 'docs-and-wiki', 'en')).toBe('Docs and wiki');
  });

  it('expose l’emoji quand il existe', () => {
    expect(categoryEmoji(categories, 'cat1')).toBe('📄');
    expect(categoryEmoji(categories, 'unknown')).toBeNull();
  });
});

describe('langsForCategory', () => {
  it("une catégorie n'existant que dans une langue ne renvoie que cette langue", () => {
    const tools = new Map([
      ['a', tool('a', { category: 'cat1', markets: ['en', 'fr'] })],
      ['b', tool('b', { category: 'cat2', markets: ['fr'] })],
    ]);
    expect(langsForCategory(tools, 'cat1')).toEqual(['en', 'fr']);
    expect(langsForCategory(tools, 'cat2')).toEqual(['fr']);
  });
});

describe('fetchVoteCounts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renvoie les compteurs quand le service répond', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      expect(url).toBe(VOTES_FEED_URL);
      return { ok: true, json: async () => ({ notion: 3 }) };
    }));
    expect(await fetchVoteCounts()).toEqual({ notion: 3 });
  });

  it('renvoie null sans lever quand la requête échoue', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await fetchVoteCounts()).toBeNull();
  });

  it('renvoie null sur un statut HTTP non ok, plutôt que des compteurs partiels', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect(await fetchVoteCounts()).toBeNull();
  });

  it("renvoie null si la réponse n'est pas un objet exploitable", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [1, 2, 3] })));
    expect(await fetchVoteCounts()).toBeNull();
  });
});
