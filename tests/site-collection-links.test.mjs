import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderLayout } from '../scripts/lib/site-html.mjs';
import { render404Page } from '../scripts/lib/site-page-404.mjs';
import { renderRootPage } from '../scripts/lib/site-page-root.mjs';
import { renderStatsPage } from '../scripts/lib/site-page-stats.mjs';
import { renderCategoriesIndexPage } from '../scripts/lib/site-page-categories-index.mjs';
import { renderSponsorPage } from '../scripts/lib/site-page-sponsor.mjs';
import { sponsorContext } from '../scripts/lib/site-sponsors.mjs';
import { collectionPlan, COLLECTION_KINDS } from '../scripts/lib/site-page-collection.mjs';

// Ruling 34 : un lien vers une collection n'existe que si la page de cette
// collection est générée ET indexable dans la langue. La décision est prise
// une fois par collectionPlan ; build-site la donne à la porte D7 de la page
// (noindex, sitemap, hreflang) et à `collectionLinks` de chaque gabarit.
const UI = JSON.parse(readFileSync('data/i18n/en/ui.json', 'utf8'));
const TODAY = '2026-10-17';
const footerOf = (html) => html.slice(html.indexOf('<footer'), html.indexOf('</footer>'));

const stats = { stars: 1000, lastCommit: '2026-10-01', createdAt: '2019-01-01', archived: false, checkedOn: '2026-10-15' };
const project = (slug, over = {}) => ({ slug, name: slug, homepage: `https://${slug}.example`, selfHostable: true, stats, ...over });
const view = (slug, project) => ({
  slug, name: slug, category: 'c', verdict: 'yes', diyTimeEstimate: 'weekend', pagePriority: 1,
  alternatives: [{ project, fit: 'full' }],
});
const VIEWS = ['a', 'b', 'c'].map((slug) => view(slug, `p-${slug}`));

describe('collectionPlan — une décision par langue', () => {
  it('auto-hébergement jamais vérifié : self-hosted noindex, build-tonight indexable', () => {
    const projects = new Map(VIEWS.map((v) => [`p-${v.slug}`, project(`p-${v.slug}`)]));
    const plan = collectionPlan(['en', 'fr'], () => VIEWS, { projects, today: TODAY });
    expect(plan.get('en').indexable).toEqual(['build-tonight']);
    expect(plan.get('en').items['self-hosted']).toEqual([]);
    expect(plan.get('fr').indexable).toEqual(['build-tonight']);
  });

  it('projets avec selfHostableCheckedOn : self-hosted devient indexable', () => {
    const checked = { selfHostableCheckedOn: '2026-10-12', selfHostableSource: 'https://x.example/docs' };
    const projects = new Map(VIEWS.map((v) => [`p-${v.slug}`, project(`p-${v.slug}`, checked)]));
    const plan = collectionPlan(['en'], () => VIEWS, { projects, today: TODAY });
    expect(plan.get('en').indexable).toEqual(COLLECTION_KINDS);
    expect(plan.get('en').items['self-hosted'].map((t) => t.slug)).toEqual(['a', 'b', 'c']);
  });
});

describe('renderLayout — collectionLinks', () => {
  const layout = (collectionLinks) => footerOf(renderLayout({
    lang: 'en', path: '/en/', title: 't', description: 'd', main: '<h1>x</h1>', ui: UI, homeHref: '/en/', collectionLinks,
  }));

  it('sans décision, aucune collection liée (jamais un lien vers une page noindex) ; le hub reste', () => {
    const f = layout(undefined);
    expect(f).not.toContain('/collections/');
    expect(f).toContain('<a href="/en/alternatives/">');
  });

  it('ne lie que les collections indexables, dans l’ordre du pied de page', () => {
    expect(layout(['build-tonight'])).not.toContain('/collections/self-hosted');
    expect(layout(['build-tonight'])).toContain('<a href="/en/collections/build-tonight">');
    const both = layout(['self-hosted', 'build-tonight']);
    expect(both.indexOf('/collections/self-hosted')).toBeGreaterThan(-1);
    expect(both.indexOf('/collections/self-hosted')).toBeLessThan(both.indexOf('/collections/build-tonight'));
  });
});

describe('Ruling 34 — gabarits sans fiche : 404, racine, stats, répertoire des catégories, sponsor', () => {
  const pages = (collectionLinks) => [
    render404Page({ ui: UI, enPath: '/en/', langs: ['en', 'fr'], collectionLinks }),
    renderRootPage({ ui: UI, enPath: '/en/', otherLangs: ['/fr/'], collectionLinks }),
    renderStatsPage({
      lang: 'en', path: '/en/stats/', ui: UI, alternates: [], xDefaultPath: null, homePath: '/en/',
      toolCount: 3, verdictCounts: { yes: 1, kinda: 1, no: 1 }, collectionLinks,
    }),
    renderCategoriesIndexPage({
      lang: 'en', path: '/en/categories/', categorySlugs: ['c'], categories: { c: { label: { en: 'C' } } },
      countsBySlug: { c: 3 }, ui: UI, alternates: [], xDefaultPath: null, homePath: '/en/', sponsorSlots: null, collectionLinks,
    }),
    renderSponsorPage({
      lang: 'en', path: '/en/sponsor', ui: UI, alternates: [], xDefaultPath: null, homePath: '/en/',
      sponsors: sponsorContext({ placements: [], today: TODAY, lang: 'en', ui: UI, favicons: {}, sponsorHref: '/en/sponsor' }),
      sponsorSlots: null, figures: { toolsPublished: 3, categories: 1, languages: 1, totalMonthlyUsd: 1, prompts: 3 }, stats: null,
      collectionLinks,
    }),
  ];

  it('self-hosted noindex : aucune de ces pages ne le lie ; build-tonight reste lié', () => {
    for (const html of pages(['build-tonight'])) {
      expect(footerOf(html)).not.toContain('/collections/self-hosted');
      expect(footerOf(html)).toContain('/en/collections/build-tonight');
    }
  });

  it('self-hosted indexable : chacune le lie', () => {
    for (const html of pages(['self-hosted', 'build-tonight'])) expect(footerOf(html)).toContain('/en/collections/self-hosted');
  });
});

describe('Ruling 34 — build-site passe la même décision à chaque gabarit', () => {
  // Garde structurelle : un gabarit ajouté plus tard sans collectionLinks
  // rendrait un pied de page sans collection, pas un lien mort — mais il
  // faut que chaque appel de build-site la transmette.
  const src = readFileSync('scripts/build-site.mjs', 'utf8');
  it('chaque rendu de page reçoit collectionLinks, et la porte des collections vient de collectionPlan', () => {
    const calls = [...src.matchAll(/(render\w+Page|renderAlternativesHub)\(\{([\s\S]*?)\}\)/g)];
    expect(calls.length).toBeGreaterThanOrEqual(12);
    for (const [, name, args] of calls) expect(args, name).toMatch(/collectionLinks/);
    expect(src).toContain('collectionPlan(');
    expect(src).not.toContain('collectionTools(');
  });
});
