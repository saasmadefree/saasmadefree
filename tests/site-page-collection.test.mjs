import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import {
  renderCollectionPage, collectionTools, collectionPath, COLLECTION_KINDS,
} from '../scripts/lib/site-page-collection.mjs';
import { loadData } from '../scripts/lib/load-data.mjs';
import { sponsorContext, renderSponsorSlots } from '../scripts/lib/site-sponsors.mjs';

// Collections /{lang}/collections/self-hosted et /build-tonight (Task A7,
// spec D5, D7). Chaînes : les vrais ui.json en et fr.
const uiOf = (lang) => JSON.parse(readFileSync(`data/i18n/${lang}/ui.json`, 'utf8'));
const UI = { en: uiOf('en'), fr: uiOf('fr') };
const TODAY = '2026-10-17';
const categories = { newsletter: { label: { en: 'Newsletters & publishing', fr: 'Newsletters et publication' } } };

const stats = (over) => ({ stars: 1000, lastCommit: '2026-10-01', archived: false, checkedOn: '2026-10-15', ...over });
const PROJECTS = new Map([
  ['listmonk', { slug: 'listmonk', name: 'Listmonk', homepage: 'https://listmonk.app', selfHostable: true,
    selfHostableCheckedOn: '2026-10-12', selfHostableSource: 'https://listmonk.app/docs/installation/', stats: stats() }],
  // selfHostable: true par défaut de migration, jamais vérifié : ne compte pas.
  ['unchecked', { slug: 'unchecked', name: 'Unchecked', homepage: 'https://unchecked.example', selfHostable: true, stats: stats() }],
  ['saasonly', { slug: 'saasonly', name: 'SaasOnly', homepage: 'https://saasonly.example', selfHostable: false, stats: stats() }],
  ['ghosted', { slug: 'ghosted', name: 'Ghosted', homepage: 'https://ghosted.example', selfHostable: true, stats: stats({ archived: true }) }],
]);

const view = (slug, over = {}) => ({
  slug, name: slug.charAt(0).toUpperCase() + slug.slice(1), category: 'newsletter', subcategory: null,
  tagline: `Tagline of ${slug}`, path: `/en/tools/${slug}`, verdict: 'yes', pagePriority: 50, markets: ['en', 'fr'],
  pricing: { amount: 20, currency: 'USD', basis: 'flat-monthly', checkedOn: '2026-07-30' }, diyTimeEstimate: 'weekend',
  alternatives: [], ...over,
});
const VIEWS = [
  view('a', { verdict: 'yes', diyTimeEstimate: 'one-sitting', alternatives: [{ project: 'listmonk', fit: 'full' }, { project: 'saasonly', fit: 'full' }], alternativeNames: ['Listmonk', 'SaasOnly'] }),
  view('b', { verdict: 'yes', diyTimeEstimate: 'weekend', alternatives: [{ project: 'saasonly', fit: 'full' }] }),
  view('c', { verdict: 'yes', diyTimeEstimate: 'week', alternatives: [{ project: 'ghosted', fit: 'full' }] }),
  view('d', { verdict: 'kinda', diyTimeEstimate: 'one-sitting', alternatives: [{ project: 'listmonk', fit: 'partial' }] }),
  view('e', { verdict: 'no', diyTimeEstimate: 'more' }),
  view('f', { verdict: 'yes', diyTimeEstimate: 'one-sitting', alternatives: [{ project: 'unknown', fit: 'full' }] }),
  view('g', { verdict: 'no', diyTimeEstimate: 'more', alternatives: [{ project: 'unchecked', fit: 'full' }] }),
];

function render(kind, over = {}) {
  const lang = over.lang ?? 'en';
  const items = over.items ?? collectionTools(kind, VIEWS, { projects: PROJECTS, today: TODAY });
  return renderCollectionPage({
    kind, lang, path: collectionPath(lang, kind), items, categories, voteCounts: null, favicons: {},
    ui: UI[lang], alternates: [{ lang: 'en', path: collectionPath('en', kind) }, { lang: 'fr', path: collectionPath('fr', kind) }],
    xDefaultPath: collectionPath('en', kind), homePath: `/${lang}/`, sponsorSlots: null, buildDate: TODAY, ...over,
  });
}
function dom(html) {
  const win = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  win.document.write(html);
  return win.document;
}
const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const jsonLd = (doc) => [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent));

describe('collections — filtres exacts', () => {
  it('two kinds, at /{lang}/collections/{kind}', () => {
    expect(COLLECTION_KINDS).toEqual(['self-hosted', 'build-tonight']);
    expect(collectionPath('fr', 'build-tonight')).toBe('/fr/collections/build-tonight');
  });

  it('build-tonight = verdict yes AND diyTimeEstimate one-sitting or weekend', () => {
    expect(collectionTools('build-tonight', VIEWS, { projects: PROJECTS, today: TODAY }).map((t) => t.slug)).toEqual(['a', 'b', 'f']);
  });

  it('self-hosted = at least one displayable, checked selfHostable project (archived, SaaS-only, unchecked and unknown do not count)', () => {
    expect(collectionTools('self-hosted', VIEWS, { projects: PROJECTS, today: TODAY }).map((t) => t.slug)).toEqual(['a', 'd']);
  });

  it('self-hosted cards name only the self-hostable alternatives', () => {
    const [a] = collectionTools('self-hosted', VIEWS, { projects: PROJECTS, today: TODAY });
    expect(a.alternativeNames).toEqual(['Listmonk']);
  });

  it('keeps the order it receives (the directory order)', () => {
    const reversed = [...VIEWS].reverse();
    expect(collectionTools('build-tonight', reversed, { projects: PROJECTS, today: TODAY }).map((t) => t.slug)).toEqual(['f', 'b', 'a']);
  });

  it('unknown kind breaks loudly', () => {
    expect(() => collectionTools('stacks', VIEWS, { projects: PROJECTS, today: TODAY })).toThrow(/stacks/);
  });
});

describe('collections — page', () => {
  const html = render('build-tonight');
  const doc = dom(html);

  it('title "{n} SaaS You Can Replace With One Prompt ({year})", n = items, year from buildDate', () => {
    expect(doc.querySelector('title').textContent).toBe('3 SaaS You Can Replace With One Prompt (2026)');
    expect(text(doc.querySelector('h1'))).toBe('3 SaaS You Can Replace With One Prompt (2026)');
    expect(dom(render('build-tonight', { buildDate: '2027-03-01' })).querySelector('title').textContent).toContain('(2027)');
  });

  it('self-hosted title', () => {
    expect(dom(render('self-hosted', { items: VIEWS.slice(0, 3) })).querySelector('title').textContent)
      .toBe('3 SaaS With a Free Self-Hosted Alternative (2026)');
  });

  it('the directory card grid, every item linked, nothing hidden', () => {
    const cards = [...doc.querySelectorAll('#tool-table #tool-rows li.card')];
    expect(cards.map((c) => c.dataset.slug)).toEqual(['a', 'b', 'f']);
    expect(cards[0].querySelector('.card-name a').getAttribute('href')).toBe('/en/tools/a');
    expect(cards.every((c) => !c.hidden)).toBe(true);
  });

  it('breadcrumb directory › collection, BreadcrumbList, CollectionPage + ItemList', () => {
    expect(text(doc.querySelector('nav.crumbs'))).toBe(`Directory / ${UI.en.site.footer.buildTonight}`);
    const blocks = jsonLd(doc);
    const page = blocks.find((b) => b['@type'] === 'CollectionPage');
    expect(page.url).toBe('https://saasmadefree.com/en/collections/build-tonight');
    expect(page.inLanguage).toBe('en');
    const list = blocks.find((b) => b['@type'] === 'ItemList');
    expect(list.itemListElement.map((i) => i.url)).toEqual([
      'https://saasmadefree.com/en/tools/a', 'https://saasmadefree.com/en/tools/b', 'https://saasmadefree.com/en/tools/f',
    ]);
    expect(blocks.some((b) => b['@type'] === 'BreadcrumbList')).toBe(true);
  });

  it('hreflang en and fr, x-default en', () => {
    expect(html).toContain('hreflang="fr" href="https://saasmadefree.com/fr/collections/build-tonight"');
    expect(html).toContain('hreflang="x-default" href="https://saasmadefree.com/en/collections/build-tonight"');
  });

  it('indexable from 3 items: no robots tag', () => {
    expect(doc.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('noindex under 3 items, with fallback title', () => {
    const d = dom(render('self-hosted', { items: VIEWS.slice(0, 2) }));
    expect(d.querySelector('meta[name="robots"]').getAttribute('content')).toBe('noindex,follow');
    expect(d.querySelector('title').textContent).toBe('SaaS With a Free Self-Hosted Alternative (2026)');
  });

  it('empty collection: a plain note, no empty grid', () => {
    const d = dom(render('self-hosted', { items: [] }));
    expect(d.querySelector('#tool-rows')).toBeNull();
    expect(text(d.querySelector('main'))).toContain(UI.en.site.collections.empty);
  });

  it('sold placements kept, never the word « Sponsor »', async () => {
    const data = await loadData(process.cwd());
    const slots = renderSponsorSlots(sponsorContext({
      placements: data.sponsors.placements, today: TODAY, lang: 'en', ui: UI.en, favicons: {}, sponsorHref: '/en/sponsor',
    }));
    const out = render('self-hosted', { sponsorSlots: slots });
    for (const part of ['railLeft', 'railRight', 'tapeBottom', 'fallback']) {
      if (slots[part]) expect(out, part).toContain(slots[part]);
    }
    expect(out.slice(out.indexOf('<main'), out.indexOf('</main>'))).not.toMatch(/sponsor/i);
  });

  it('French page, tutoiement', () => {
    const fr = dom(render('build-tonight', { lang: 'fr' }));
    expect(fr.querySelector('title').textContent).toBe('3 SaaS que tu peux remplacer avec un seul prompt (2026)');
    expect(text(fr.querySelector('main'))).toContain('Copie le prompt');
  });

  it('escapes tool names', () => {
    const out = render('build-tonight', { items: [{ ...VIEWS[0], name: 'A<b>&"' }] });
    expect(out).not.toContain('<b>&"');
  });
});

// Ruling 34 : le pied de page ne lie une collection que si build-site l'a
// déclarée indexable dans la langue (collectionPlan) — et toujours le hub.
describe('Ruling 34 — liens de collection du pied de page', () => {
  const footer = (page) => page.slice(page.indexOf('<footer'), page.indexOf('</footer>'));
  it('self-hosted noindex : aucun lien ; indexable : lié ; build-tonight lié s’il est indexable', () => {
    const off = footer(render('build-tonight', { collectionLinks: ['build-tonight'] }));
    expect(off).not.toContain('/collections/self-hosted');
    expect(off).toContain('/collections/build-tonight');
    expect(off).toContain('/alternatives/"');
    const on = footer(render('build-tonight', { collectionLinks: ['self-hosted', 'build-tonight'] }));
    expect(on).toContain('/collections/self-hosted');
    expect(on).toContain('/collections/build-tonight');
  });
});
