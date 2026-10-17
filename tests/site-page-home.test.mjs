import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Window } from 'happy-dom';
import { renderHomePage } from '../scripts/lib/site-page-home.mjs';
import { formatMoney } from '../scripts/lib/site-format.mjs';
import { escapeHtml } from '../scripts/lib/site-html.mjs';
import {
  sponsorContext, renderSponsorSlots, RAIL_SLOTS, TAPE_BOTTOM_SLOTS,
} from '../scripts/lib/site-sponsors.mjs';

// L'accueil du système « La table de cuisine, aérée » (maquette
// direction-3-airy-home.html), contrôlé contre la liste D14 « Accueil » : un
// test par information que la page doit continuer d'afficher. Les chaînes
// viennent des vrais ui.json : une clé absente casserait le build, autant la
// voir ici.
const UI = Object.fromEntries(
  ['en', 'fr'].map((lang) => [lang, JSON.parse(readFileSync(join('data', 'i18n', lang, 'ui.json'), 'utf8'))])
);

const categories = {
  analytics: { emoji: '📈', label: { en: 'Analytics', fr: 'Analytics' } },
  design: { label: { en: 'Design', fr: 'Design' } },
  forms: { label: { en: 'Forms', fr: 'Formulaires' } },
};
const CATS = Object.keys(categories);
const VERDICTS = ['yes', 'kinda', 'no'];

// 30 fiches : plus que les 24 que le JavaScript montre d'abord, pour que
// « tout est dans le HTML » se vérifie au-delà de la première page.
const toolViews = Array.from({ length: 30 }, (_, i) => ({
  slug: `outil-${i}`,
  name: `Outil ${i}`,
  category: CATS[i % 3],
  subcategory: null,
  tagline: `Accroche ${i}`,
  path: `/en/tools/outil-${i}`,
  pricing: { amount: 10 + i, currency: 'USD', basis: 'flat-monthly', checkedOn: '2026-07-30' },
  diyTimeEstimate: 'weekend',
  verdict: VERDICTS[i % 3],
  pagePriority: 100 - i,
  alternativeNames: i % 2 === 0 ? [`Libre ${i}`] : [],
}));

const FIGURES = {
  toolsPublished: 530, categories: 51, languages: 2, totalMonthlyUsd: 11760.18,
  replaceableMonthlyUsd: 8123.5, prompts: 529,
};

const LIVE = (slot, name) => ({
  slot, name, domain: `${name.toLowerCase()}.com`, url: `https://${name.toLowerCase()}.com/`,
  tagline: { en: `${name} tagline`, fr: `Accroche ${name}` }, startsOn: '2026-08-01', endsOn: '2026-12-31',
});
const PLACEMENTS = [LIVE('L1', 'Whoscale'), LIVE('R1', 'LinkQuiver'), LIVE('B01', 'Tapeco')];

function renderHome(lang = 'en', over = {}) {
  const ui = UI[lang];
  const ctx = sponsorContext({
    placements: PLACEMENTS, today: '2026-10-17', lang, ui, favicons: {}, sponsorHref: `/${lang}/sponsor`,
  });
  return renderHomePage({
    lang,
    path: `/${lang}/`,
    toolViews,
    topCategorySlugs: CATS,
    categories,
    voteCounts: null,
    favicons: {},
    figures: FIGURES,
    mrrTotal: null,
    ui,
    alternates: [{ lang: 'en', path: '/en/' }, { lang: 'fr', path: '/fr/' }],
    xDefaultPath: '/en/',
    sponsorSlots: renderSponsorSlots(ctx),
    buildDate: '2026-10-17',
    ...over,
  });
}

const html = renderHome();
/** Le morceau de `page` qui va de `from` à la première occurrence de `to` qui le suit. */
const between = (from, to, page = html) => {
  const start = page.indexOf(from);
  expect(start, from).toBeGreaterThan(-1);
  return page.slice(start, to ? page.indexOf(to, start) : undefined);
};

describe('accueil — liste D14', () => {
  it('home lists every published tool card', () => {
    const grid = between('id="tool-rows"', '</ul>');
    expect(grid.match(/<li class="card"/g)).toHaveLength(toolViews.length);
    for (const tool of toolViews) expect(grid, tool.slug).toContain(`<a href="${tool.path}">${tool.name}</a>`);
  });

  it('home keeps catalogue figures, vote MRR line with unavailable fallback, verdict legend, category filter', () => {
    const h = UI.en.site.home;
    const n = (v) => new Intl.NumberFormat('en').format(v);
    const usd = (v) => escapeHtml(formatMoney(v, 'USD', 'en'));
    const figures = between('class="figures"', '</ul>');
    // Les six chiffres du catalogue, chacun avec son libellé.
    for (const [label, value] of [
      [h.figureToolsPublished, n(530)], [h.figureCategories, n(51)], [h.figureLanguages, n(2)],
      [h.figurePrompts, n(529)], [h.figureTotalPrice, usd(11760.18)], [h.replaceableSpendLabel, usd(8123.5)],
    ]) {
      expect(figures, label).toContain(`<span>${escapeHtml(label)}</span> <strong>${value}</strong>`);
    }
    // Service de vote muet au build : un texte simple, jamais un zéro.
    expect(figures).toContain(escapeHtml(h.mrrUnavailable));
    expect(figures).not.toContain(escapeHtml(h.mrrLabel));
    // Total calculable : le libellé, le montant, et la phrase pour lecteur d'écran.
    const withMrr = renderHome('en', { mrrTotal: 3065 });
    expect(withMrr).toContain(escapeHtml(h.mrrLabel));
    expect(withMrr).toContain(usd(3065));
    expect(withMrr).not.toContain(escapeHtml(h.mrrUnavailable));

    // Légende des trois verdicts sous les filtres, et chaque pastille y renvoie.
    const legend = between('class="legend"', '</ul>');
    for (const v of VERDICTS) {
      const { label, desc } = UI.en.site.verdicts[v];
      expect(legend).toContain(`<li id="legend-${v}">`);
      expect(legend).toContain(escapeHtml(label));
      expect(legend).toContain(escapeHtml(desc));
      expect(html).toMatch(new RegExp(`class="verdict-chip" data-verdict="${v}" aria-pressed="false" title="${escapeHtml(desc).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" aria-describedby="legend-${v}"`));
    }
    expect(html.indexOf('class="filters"')).toBeLessThan(html.indexOf('class="legend"'));

    // Filtre par catégorie, à côté du tri : une option par catégorie de la grille.
    const select = between('<select id="cat-filter"', '</select>');
    expect(select).toContain(`<option value="all">${escapeHtml(h.categoryFilterAll)}</option>`);
    for (const slug of CATS) expect(select).toContain(`<option value="${slug}">`);
    expect(html).toContain('<select id="order">');
  });

  it('home renders every active sponsor placement', () => {
    // Les dix emplacements latéraux passent dans la rangée sous le héros, une
    // seule fois chacun ; les dix places du bandeau restent en pied.
    const row = between('class="sp-fallback"', '</aside>');
    for (const slot of RAIL_SLOTS) expect(row.split(`data-slot="${slot}"`).length - 1, slot).toBe(1);
    for (const slot of TAPE_BOTTOM_SLOTS) expect(between('class="sponsor-tape')).toContain(`data-slot="${slot}"`);
    // Chaque placement actif est rendu en carte vendue, avec son lien tracé.
    for (const p of PLACEMENTS) {
      expect(html, p.name).toContain(`>${p.name}</span>`);
      expect(html).toContain(`utm_campaign=sponsor_${p.slot}`);
    }
    // La rangée vit sous le héros, avant la recherche ; plus de rails ni de doublon.
    expect(html.indexOf('class="hero"')).toBeLessThan(html.indexOf('class="sp-fallback"'));
    expect(html.indexOf('class="sp-fallback"')).toBeLessThan(html.indexOf('id="q"'));
    expect(html).not.toContain('sp-rail');
    expect(html).toContain('<div class="shell">');
    expect(html.match(/class="sp-fallback"/g)).toHaveLength(1);
  });

  it('no-JS: all cards visible', () => {
    // Rien n'est masqué dans le HTML : c'est le JavaScript qui en montre 24.
    // Ce qui ne marche qu'avec lui (tri, filtre de catégorie, « Voir plus »)
    // est rendu hidden, jamais un contrôle mort.
    const win = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
    win.document.write(html);
    const cards = [...win.document.querySelectorAll('#tool-rows [data-slug]')];
    expect(cards).toHaveLength(toolViews.length);
    expect(cards.filter((c) => c.hidden)).toEqual([]);
    expect(win.document.getElementById('show-more').hidden).toBe(true);
    expect(win.document.querySelector('.selects').hidden).toBe(true);
    win.close();
  });

  it('garde la promesse « un prompt à donner à Claude, Cursor ou ChatGPT » dans le sous-titre', () => {
    for (const lang of ['en', 'fr']) {
      const sub = renderHome(lang).match(/<p class="sub">([^<]*)<\/p>/)[1];
      expect(sub).toContain('Claude, Cursor');
      expect(sub).toContain('ChatGPT');
      expect(sub).toContain(new Intl.NumberFormat(lang).format(toolViews.length));
    }
  });

  it('recherche avec suggestions au-dessus des filtres', () => {
    expect(html.indexOf('id="q"')).toBeLessThan(html.indexOf('class="controls"'));
    for (const hook of ['id="search-panel"', 'id="search-clear"', 'data-view-all-template=', 'data-no-results=',
      'data-home-path="/en/"', 'role="combobox"']) {
      expect(html).toContain(hook);
    }
  });

  it('filtre par verdict : une pastille par verdict, avec la forme, le mot et le décompte', () => {
    const filters = between('class="filters"', 'class="selects"');
    expect(filters).toContain(`class="verdict-chip is-active" data-verdict="all" aria-pressed="true">${UI.en.site.home.allChip} <span class="c">30</span>`);
    for (const [v, mark] of [['yes', '●'], ['kinda', '◐'], ['no', '○']]) {
      expect(filters).toMatch(new RegExp(`data-verdict="${v}"[^>]*><span class="mark" aria-hidden="true">${mark}</span>${UI.en.site.verdicts[v].label} <span class="c">10</span>`));
    }
  });

  it('toutes les catégories : les plus peuplées, plus le lien vers la liste complète', () => {
    const browse = between('id="h-cats"', '</section>');
    for (const slug of CATS) expect(browse).toContain(`href="/en/categories/${slug}/"`);
    expect(browse).toContain('<span class="l-meta">10 tools</span>');
    expect(browse).toContain(`<a class="more" href="/en/categories/">All 51 categories</a>`);
  });

  it('alternatives populaires : les fiches les mieux classées qui ont une alternative affichable', () => {
    const popular = between('id="h-alts"', '</ul>');
    const links = [...popular.matchAll(/<a href="([^"]+)">/g)].map((m) => m[1]);
    expect(links).toEqual(['/en/tools/outil-0', '/en/tools/outil-2', '/en/tools/outil-4', '/en/tools/outil-6',
      '/en/tools/outil-8', '/en/tools/outil-10', '/en/tools/outil-12', '/en/tools/outil-14']);
    expect(popular).toContain('<span class="l-name">Outil 0 alternatives</span><span class="l-meta">Libre 0</span>');
  });

  it('un seul h1, court, et aucun résidu de l’ancien héros', () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain(`<h1>${escapeHtml(UI.en.site.home.heroTitle)}</h1>`);
    for (const gone of ['hero-rot', 'hero-savings', 'verdict-band', 'recap', 'sign-row', 'paraphe', '📈']) {
      expect(html, gone).not.toContain(gone);
    }
  });

  it('l’emplacement newsletter est vide tant que la Task A9 ne le remplit pas', () => {
    expect(html).not.toContain('<form');
    expect(renderHome('en', { newsletter: '<form class="newsletter"></form>' }))
      .toMatch(/<p class="sub">[^<]*<\/p>\s*<form class="newsletter"><\/form>/);
  });

  it('conserve JSON-LD et alternates', () => {
    expect(html).toContain('application/ld+json');
    expect(html).toContain('hreflang="fr"');
    expect(html).toContain('hreflang="x-default"');
  });

  it('les blocs « accueil » de en et fr portent exactement les mêmes clés', () => {
    expect(Object.keys(UI.fr.site.home).sort()).toEqual(Object.keys(UI.en.site.home).sort());
    expect(Object.keys(UI.fr.site.footer).sort()).toEqual(Object.keys(UI.en.site.footer).sort());
  });
});
