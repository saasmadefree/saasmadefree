import { describe, it, expect } from 'vitest';
import { Window } from 'happy-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadData } from '../scripts/lib/load-data.mjs';
import { renderHomePage } from '../scripts/lib/site-page-home.mjs';
import { renderToolPage } from '../scripts/lib/site-page-tool.mjs';
import { renderSponsorPage } from '../scripts/lib/site-page-sponsor.mjs';
import { sponsorContext, renderSponsorSlots } from '../scripts/lib/site-sponsors.mjs';
import { catalogueFigures } from '../scripts/lib/site-data.mjs';
import { renderNewsletterForm } from '../scripts/lib/site-newsletter.mjs';

// Garde du système de design (Task A0, étape 4) : chaque crochet que
// scripts/assets/site.js cherche dans le DOM existe dans au moins une page
// rendue — l'accueil, une fiche, la page /sponsor. Les sélecteurs sont lus
// dans le fichier lui-même : un crochet ajouté au script sans son balisage,
// ou un balisage renommé sans le script, rend ce test rouge.

const SITE_JS = readFileSync(join('scripts', 'assets', 'site.js'), 'utf8');
const SELECTORS = [...new Set(
  [...SITE_JS.matchAll(/\.(querySelector(?:All)?|getElementById)\('([^']+)'\)/g)]
    .map(([, fn, arg]) => (fn === 'getElementById' ? `#${arg}` : arg))
)];

const data = await loadData(process.cwd());
const lang = 'en';
const ui = data.ui.get(lang);
const today = '2026-10-17';
const sponsors = sponsorContext({
  placements: data.sponsors.placements, today, lang, ui, favicons: {}, sponsorHref: `/${lang}/sponsor`,
});
const sponsorSlots = renderSponsorSlots(sponsors);
const tools = [...data.tools.values()].filter((t) => t.markets.includes(lang));
const tool = tools[0];
const figures = catalogueFigures(data.tools, [lang], data.i18n.size);

const PAGES = {
  home: renderHomePage({
    lang, path: `/${lang}/`,
    toolViews: tools.slice(0, 30).map((t) => ({
      ...t, tagline: data.i18n.get(`${lang}/${t.slug}`).tagline, path: `/${lang}/tools/${t.slug}`,
    })),
    topCategorySlugs: [tool.category], categories: data.categories, voteCounts: {}, favicons: {},
    figures, mrrTotal: 0, ui, alternates: [], xDefaultPath: null, sponsorSlots,
    // Clé factice : sans elle, le formulaire newsletter n'existe pas (spec D13).
    newsletter: renderNewsletterForm({ lang, ui, config: { key: 'sl_test_fixture', segmentId: null }, variant: 'hero' }),
  }),
  tool: renderToolPage({
    lang, path: `/${lang}/tools/${tool.slug}`, tool,
    i18nEntry: data.i18n.get(`${lang}/${tool.slug}`), categories: data.categories, ui, alternates: [],
    xDefaultPath: null, homePath: `/${lang}/`, categoryPath: `/${lang}/categories/${tool.category}`,
    relatedTools: [], voteCount: 0, favicons: {}, agents: data.agents, sponsorSlots, buildDate: today,
    projects: data.projects, projectI18n: data.projectI18n, today,
  }),
  sponsor: renderSponsorPage({
    lang, path: `/${lang}/sponsor`, ui, alternates: [], xDefaultPath: null, homePath: `/${lang}/`,
    sponsors, sponsorSlots, figures, stats: null,
  }),
};

const docs = Object.fromEntries(Object.entries(PAGES).map(([name, html]) => {
  const win = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  win.document.write(html);
  return [name, win.document];
}));

describe('crochets de scripts/assets/site.js', () => {
  it('lit bien ses sélecteurs dans le script', () => {
    expect(SELECTORS).toContain('#tool-rows');
    expect(SELECTORS).toContain('.card-name a');
    expect(SELECTORS.length).toBeGreaterThan(30);
  });

  for (const selector of SELECTORS) {
    it(`${selector} existe dans au moins une page rendue`, () => {
      const found = Object.entries(docs).filter(([, doc]) => doc.querySelector(selector)).map(([name]) => name);
      expect(found, selector).not.toEqual([]);
    });
  }
});
