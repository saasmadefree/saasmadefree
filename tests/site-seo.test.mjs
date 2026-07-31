import { describe, it, expect } from 'vitest';
import {
  organizationJsonLd, websiteJsonLd, itemListJsonLd, faqPageJsonLd,
  breadcrumbJsonLd, buildSitemap,
} from '../scripts/lib/site-seo.mjs';

describe('organizationJsonLd', () => {
  it('pointe vers le dépôt public réel, rien d’inventé', () => {
    const data = organizationJsonLd();
    expect(data['@type']).toBe('Organization');
    expect(data.sameAs).toEqual(['https://github.com/saasmadefree/saasmadefree']);
  });
});

describe('websiteJsonLd', () => {
  it('construit une SearchAction dont la cible est vraiment la page de recherche du même chemin', () => {
    const data = websiteJsonLd('/fr/');
    expect(data.url).toBe('https://saasmadefree.com/fr/');
    expect(data.potentialAction.target).toBe('https://saasmadefree.com/fr/?q={search_term_string}');
  });
});

describe('itemListJsonLd', () => {
  it('numérote les positions à partir de 1, dans l’ordre reçu', () => {
    const data = itemListJsonLd([
      { name: 'Notion', path: '/en/tools/notion' },
      { name: 'Obsidian', path: '/en/tools/obsidian' },
    ]);
    expect(data.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(data.itemListElement[0].url).toBe('https://saasmadefree.com/en/tools/notion');
  });
});

describe('faqPageJsonLd', () => {
  it('mappe q/a vers Question/acceptedAnswer', () => {
    const data = faqPageJsonLd([{ q: 'Q1', a: 'A1' }]);
    expect(data.mainEntity[0]).toEqual({
      '@type': 'Question', name: 'Q1', acceptedAnswer: { '@type': 'Answer', text: 'A1' },
    });
  });
});

describe('breadcrumbJsonLd', () => {
  it('construit des URLs absolues à partir de chemins relatifs', () => {
    const data = breadcrumbJsonLd([{ label: 'Directory', href: '/en/' }]);
    expect(data.itemListElement[0].item).toBe('https://saasmadefree.com/en/');
  });
});

describe('buildSitemap', () => {
  it('inclut lastmod seulement pour les pages qui en fournissent un', () => {
    const xml = buildSitemap([{ path: '/en/' }, { path: '/en/tools/notion', lastmod: '2026-07-30' }]);
    expect(xml).toContain('<loc>https://saasmadefree.com/en/</loc>');
    expect(xml).toContain('<lastmod>2026-07-30</lastmod>');
    expect(xml.match(/<lastmod>/g)?.length).toBe(1);
  });
});
