import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { renderAlternativesHub, groupByLetter, hubPath } from '../scripts/lib/site-page-alternatives-hub.mjs';
import { loadData } from '../scripts/lib/load-data.mjs';
import { sponsorContext, renderSponsorSlots } from '../scripts/lib/site-sponsors.mjs';

// Hub /{lang}/alternatives/ : index A–Z de toutes les fiches publiées dans
// la langue, avec leur nombre d'alternatives affichables (Task A7, spec D5).
const uiOf = (lang) => JSON.parse(readFileSync(`data/i18n/${lang}/ui.json`, 'utf8'));
const UI = { en: uiOf('en'), fr: uiOf('fr') };
const TODAY = '2026-10-17';

const view = (slug, name, over = {}) => ({ slug, name, path: `/en/tools/${slug}`, markets: ['en', 'fr'], ...over });
const TOOLS = [
  view('notion', 'Notion'),
  view('1password', '1Password'),
  view('airtable', 'Airtable'),
  view('ecwid', 'Écwid'),
  view('asana', 'asana'),
  view('360learning', '360Learning'),
  view('frenchonly', 'Frenchonly', { markets: ['fr'] }),
];
const COUNTS = { notion: 5, '1password': 1, airtable: 0, ecwid: 2, asana: 3, '360learning': 0 };

function render(over = {}) {
  const lang = over.lang ?? 'en';
  return renderAlternativesHub({
    lang, path: hubPath(lang), tools: TOOLS, counts: COUNTS, ui: UI[lang],
    alternates: [{ lang: 'en', path: '/en/alternatives/' }, { lang: 'fr', path: '/fr/alternatives/' }],
    xDefaultPath: '/en/alternatives/', homePath: `/${lang}/`, sponsorSlots: null, buildDate: TODAY, ...over,
  });
}
function dom(html) {
  const win = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  win.document.write(html);
  return win.document;
}
const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const jsonLd = (doc) => [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent));

describe('hub A–Z — regroupement', () => {
  it('groups tools by first letter, digits under #', () => {
    const groups = groupByLetter(TOOLS, 'en');
    expect(groups.map((g) => g.letter)).toEqual(['#', 'A', 'E', 'N']);
    expect(groups[0].tools.map((t) => t.slug)).toEqual(['1password', '360learning']);
    // Casse et accents ignorés : « asana » sous A, « Écwid » sous E.
    expect(groups[1].tools.map((t) => t.slug)).toEqual(['airtable', 'asana']);
    expect(groups[2].tools.map((t) => t.slug)).toEqual(['ecwid']);
  });

  it('only tools published in the language', () => {
    expect(groupByLetter(TOOLS, 'en').flatMap((g) => g.tools).map((t) => t.slug)).not.toContain('frenchonly');
    expect(groupByLetter(TOOLS, 'fr').flatMap((g) => g.tools).map((t) => t.slug)).toContain('frenchonly');
  });

  it('anchor ids are stable and valid', () => {
    expect(groupByLetter(TOOLS, 'en').map((g) => g.id)).toEqual(['letter-0-9', 'letter-a', 'letter-e', 'letter-n']);
  });
});

describe('hub A–Z — page', () => {
  const html = render();
  const doc = dom(html);

  it('title with n tools and the build year, one h1', () => {
    expect(doc.querySelector('title').textContent).toBe('Free & Open Source Alternatives to 6 SaaS, A to Z (2026)');
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
  });

  it('letter navigation points at every letter section', () => {
    const anchors = [...doc.querySelectorAll('nav.az-nav a')].map((a) => a.getAttribute('href'));
    expect(anchors).toEqual(['#letter-0-9', '#letter-a', '#letter-e', '#letter-n']);
    for (const href of anchors) expect(doc.getElementById(href.slice(1))).not.toBeNull();
  });

  it('one link per tool, with its count of displayable alternatives', () => {
    const rows = [...doc.querySelectorAll('section[aria-labelledby="letter-n"] li a')];
    expect(rows.map((a) => a.getAttribute('href'))).toEqual(['/en/tools/notion']);
    expect(text(rows[0])).toBe('Notion 5 alternatives');
    const one = doc.querySelector('a[href="/en/tools/1password"]');
    expect(text(one)).toBe('1Password 1 alternative');
  });

  it('zero alternatives: says build it yourself, never a bare 0', () => {
    expect(text(doc.querySelector('a[href="/en/tools/airtable"]'))).toBe('Airtable build it yourself');
  });

  it('CollectionPage + ItemList + BreadcrumbList', () => {
    const blocks = jsonLd(doc);
    const page = blocks.find((b) => b['@type'] === 'CollectionPage');
    expect(page.url).toBe('https://saasmadefree.com/en/alternatives/');
    const list = blocks.find((b) => b['@type'] === 'ItemList');
    expect(list.itemListElement).toHaveLength(6);
    expect(list.itemListElement[0].url).toBe('https://saasmadefree.com/en/tools/1password');
    expect(blocks.some((b) => b['@type'] === 'BreadcrumbList')).toBe(true);
  });

  it('hreflang en and fr', () => {
    expect(html).toContain('hreflang="fr" href="https://saasmadefree.com/fr/alternatives/"');
  });

  it('noindex under 3 tools, indexable otherwise', () => {
    expect(doc.querySelector('meta[name="robots"]')).toBeNull();
    const small = dom(render({ tools: TOOLS.slice(0, 2) }));
    expect(small.querySelector('meta[name="robots"]').getAttribute('content')).toBe('noindex,follow');
  });

  it('sold placements kept, never the word « Sponsor »', async () => {
    const data = await loadData(process.cwd());
    const slots = renderSponsorSlots(sponsorContext({
      placements: data.sponsors.placements, today: TODAY, lang: 'en', ui: UI.en, favicons: {}, sponsorHref: '/en/sponsor',
    }));
    const out = render({ sponsorSlots: slots });
    for (const part of ['railLeft', 'railRight', 'tapeBottom', 'fallback']) {
      if (slots[part]) expect(out, part).toContain(slots[part]);
    }
    expect(out.slice(out.indexOf('<main'), out.indexOf('</main>'))).not.toMatch(/sponsor/i);
  });

  it('French page: French plural, tutoiement', () => {
    const fr = dom(render({ lang: 'fr', tools: TOOLS.map((t) => ({ ...t, path: `/fr/tools/${t.slug}` })) }));
    expect(text(fr.querySelector('a[href="/fr/tools/1password"]'))).toBe('1Password 1 alternative');
    expect(text(fr.querySelector('a[href="/fr/tools/airtable"]'))).toBe('Airtable à construire toi-même');
    expect(text(fr.querySelector('main'))).toContain('Choisis une lettre');
  });

  it('escapes names', () => {
    const out = render({ tools: [view('x', 'X<b>&"'), ...TOOLS] });
    expect(out).not.toContain('<b>&"');
  });
});
