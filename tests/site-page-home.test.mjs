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
  replaceableMonthlyUsd: 8123.5, prompts: 529, promptLanguages: ['en', 'fr'],
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
      [h.figurePrompts.replace('{langs}', 'en + fr'), n(529)], [h.figureTotalPrice, usd(11760.18)], [h.replaceableSpendLabel, usd(8123.5)],
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
    // Ruling 14 (spec D14 amendée) : l'accueil montre CHAQUE placement vendu ;
    // les places libres sont regroupées en UN lien vers /sponsor, par zone.
    const row = between('<aside class="sp-fallback"', '</aside>');
    const tape = between('<div class="sponsor-tape', '<script');
    for (const p of PLACEMENTS) {
      const zone = p.slot.startsWith('B') ? tape : row;
      expect(zone, p.name).toContain(`data-slot="${p.slot}"`);
      expect(zone, p.name).toContain(`>${p.name}</span>`);
      expect(zone).toContain(`utm_campaign=sponsor_${p.slot}`);
    }
    // Aucune carte de place libre, un seul lien groupé par zone, avec le décompte.
    const sold = UI.en.site.sponsor;
    for (const [zone, free] of [[row, 8], [tape, 9]]) {
      expect(zone).not.toContain(escapeHtml(sold.openLabel));
      expect(zone).not.toContain('class="sp-card open"');
      expect(zone).not.toContain('sp-tape-item open');
      expect(zone.match(/href="\/en\/sponsor"/g)).toHaveLength(1);
      expect(zone).toContain(`>${escapeHtml(sold.slotsAvailableOther.replace('{count}', free))}</a>`);
      // Le mot reste banni (Ruling 15) : ni en texte, ni en nom accessible.
      expect(zone.replace(/<[^>]+>/g, ' ')).not.toMatch(/sponsor/i);
      expect(zone).not.toContain('aria-label');
    }
    // Pas de doublon de la piste défilante sur l'accueil.
    expect(tape.split('data-slot="B01"').length - 1).toBe(1);
    // La rangée vit sous le héros, avant la recherche ; plus de rails.
    expect(html.indexOf('class="hero"')).toBeLessThan(html.indexOf('class="sp-fallback"'));
    expect(html.indexOf('class="sp-fallback"')).toBeLessThan(html.indexOf('id="q"'));
    expect(html).not.toContain('sp-rail');
    expect(html).toContain('<div class="shell">');
    expect(html.match(/class="sp-fallback"/g)).toHaveLength(1);
  });

  it('un emplacement payé sans créa commitée compte comme vendu, et aucun lien quand tout est pris', () => {
    // Même occupation que le reste du site (mergeOccupancy) : un slot `paid`
    // ou `reserved` dans la charge utile est pris, même sans placement.
    const full = (slots) => Object.fromEntries(slots.map((slot) => [slot, { status: 'paid' }]));
    const ctx = sponsorContext({
      placements: PLACEMENTS, today: '2026-10-17', lang: 'en', ui: UI.en, favicons: {}, sponsorHref: '/en/sponsor',
      liveSlots: full([...RAIL_SLOTS, ...TAPE_BOTTOM_SLOTS]),
    });
    const page = renderHome('en', { sponsorSlots: renderSponsorSlots(ctx) });
    const row = between('<aside class="sp-fallback"', '</aside>', page);
    const tape = between('<div class="sponsor-tape', '<script', page);
    expect(row).not.toContain('class="sp-more"');
    expect(tape).not.toContain('class="sp-more"');
    for (const slot of RAIL_SLOTS) expect(row.split(`data-slot="${slot}"`).length - 1, slot).toBe(1);
    for (const slot of TAPE_BOTTOM_SLOTS) expect(tape.split(`data-slot="${slot}"`).length - 1, slot).toBe(1);
    expect(row).toContain(`class="sp-card taken" data-slot="L2"`);
    // Une seule place libre : le libellé passe au singulier, en français aussi.
    const one = sponsorContext({
      placements: [], today: '2026-10-17', lang: 'fr', ui: UI.fr, favicons: {}, sponsorHref: '/fr/sponsor',
      liveSlots: full(RAIL_SLOTS.slice(1)),
    });
    const fr = renderHome('fr', { sponsorSlots: renderSponsorSlots(one) });
    expect(between('class="sp-fallback"', '</aside>', fr))
      .toContain(`>${escapeHtml(UI.fr.site.sponsor.slotsAvailableOne.replace('{count}', 1))}</a>`);
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
    // Les pastilles de verdict ne font rien sans JavaScript : cachées aussi
    // (finding 9). La légende, elle, reste lisible avec ses parts.
    expect(win.document.querySelector('.filters').hidden).toBe(true);
    expect(win.document.querySelector('.legend').hidden).toBe(false);
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
    // Un champ sans <label> n'a pas de nom : l'étiquette reste, masquée à l'œil.
    expect(html).toContain('<label for="q" class="visually-hidden">');
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
    for (const slug of CATS) expect(browse).toContain(`href="/en/categories/${slug}"`);
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

describe('accueil — revue finale (findings 5, 6, 7, 10)', () => {
  // D14 : les parts des verdicts (13 % / 54 % / 33 % sur le vrai catalogue)
  // reviennent dans la légende, calculées depuis la grille, jamais recopiées.
  it('la légende donne, par verdict, le nombre de fiches et sa part du catalogue', () => {
    const pct = new Intl.NumberFormat('en', { style: 'percent' });
    const legend = between('class="legend"', '</ul>');
    for (const v of VERDICTS) {
      const share = UI.en.site.home.legendShareTemplate.replace('{count}', '10').replace('{share}', pct.format(1 / 3));
      expect(legend).toMatch(new RegExp(`<li id="legend-${v}">.*${share.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    }
    // Une autre grille, d'autres parts : rien n'est écrit en dur.
    const skewed = renderHome('en', { toolViews: [toolViews[1], toolViews[2], ...toolViews.filter((t) => t.verdict === 'yes')] });
    const legendSkewed = between('class="legend"', '</ul>', skewed);
    expect(legendSkewed).toContain(UI.en.site.home.legendShareTemplate.replace('{count}', '10').replace('{share}', '83%'));
    expect(legendSkewed).toContain(UI.en.site.home.legendShareTemplate.replace('{count}', '1').replace('{share}', '8%'));
    // En français, le pourcentage à la française.
    expect(between('class="legend"', '</ul>', renderHome('fr'))).toContain('10 (33\u00a0%)');
  });

  it('le chiffre des prompts dit qu’il additionne les langues (en + fr)', () => {
    expect(html).toContain('<span>Prompts written (en + fr)</span> <strong>529</strong>');
    expect(renderHome('fr')).toContain('<span>Prompts écrits (en + fr)</span>');
  });

  it('la grille est nommée par le titre de l’annuaire, pas par la note de classement', () => {
    expect(html).toContain(`<ul class="tool-grid" id="tool-rows" aria-label="${escapeHtml(UI.en.site.home.listHeading)}">`);
  });

  it('une région live polie annonce le nombre de résultats, vide au chargement', () => {
    const status = between('id="grid-status"', '</p>');
    expect(status).toContain('role="status"');
    expect(status).toContain('aria-live="polite"');
    expect(status).toContain(`data-one="${escapeHtml(UI.en.site.home.resultCountOne)}"`);
    expect(status).toContain(`data-other="${escapeHtml(UI.en.site.home.resultCountOther)}"`);
    expect(status).toMatch(/>$/);
  });
});

describe('accueil — pastilles sans saut de mise en page (finding 9)', () => {
  it('avec la classe js, la place des pastilles est réservée avant que site.js les dévoile', async () => {
    const { SITE_CSS } = await import('../scripts/lib/site-styles.mjs');
    expect(SITE_CSS).toContain('.js .filters[hidden]{display:flex!important;visibility:hidden}');
  });
});

// Ruling 34 : le pied de page ne lie une collection que si build-site l'a
// déclarée indexable dans la langue (collectionPlan) — et toujours le hub.
describe('Ruling 34 — liens de collection du pied de page', () => {
  const footer = (page) => page.slice(page.indexOf('<footer'), page.indexOf('</footer>'));
  it('self-hosted noindex : aucun lien ; indexable : lié ; build-tonight lié s’il est indexable', () => {
    const off = footer(renderHome('en', { collectionLinks: ['build-tonight'] }));
    expect(off).not.toContain('/collections/self-hosted');
    expect(off).toContain('/collections/build-tonight');
    expect(off).toContain('/alternatives/"');
    const on = footer(renderHome('en', { collectionLinks: ['self-hosted', 'build-tonight'] }));
    expect(on).toContain('/collections/self-hosted');
    expect(on).toContain('/collections/build-tonight');
  });
});
