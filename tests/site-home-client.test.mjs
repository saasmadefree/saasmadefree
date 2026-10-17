import { describe, it, expect } from 'vitest';
import { Window } from 'happy-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderHomePage } from '../scripts/lib/site-page-home.mjs';
import { renderCategoryPage } from '../scripts/lib/site-page-category.mjs';

// scripts/assets/site.js exécuté pour de vrai, dans un DOM, contre le HTML de
// l'accueil et d'une page de catégorie : la grille de cartes ([data-slug],
// .card-name a), le « Voir plus » par 24, le filtre de verdict, le filtre de
// catégorie, le tri, ?q= et le rafraîchissement des votes. Même banc que
// tests/sponsor-checkout-client.test.mjs : l'IIFE est évaluée avec ses
// globales passées en paramètres, `fetch` et `location` sous contrôle.

const SITE_JS = readFileSync(join('scripts', 'assets', 'site.js'), 'utf8');
const UI = JSON.parse(readFileSync(join('data', 'i18n', 'en', 'ui.json'), 'utf8'));
const categories = {
  analytics: { label: { en: 'Analytics' } },
  design: { label: { en: 'Design' } },
  forms: { label: { en: 'Forms' } },
};
const CATS = Object.keys(categories);
const VERDICTS = ['yes', 'kinda', 'no'];

const toolViews = Array.from({ length: 30 }, (_, i) => ({
  slug: `outil-${i}`,
  name: `Outil ${String.fromCharCode(97 + ((i * 7) % 26))}${i}`,
  category: CATS[i % 3],
  subcategory: null,
  tagline: `Accroche ${i}`,
  path: `/en/tools/outil-${i}`,
  // La fiche 29 se paie une fois : elle n'a pas de prix mensuel à trier.
  pricing: i === 29
    ? { amount: 999, currency: 'USD', basis: 'one-time' }
    : { amount: 10 + i, currency: 'USD', basis: 'flat-monthly' },
  diyTimeEstimate: 'weekend',
  verdict: VERDICTS[i % 3],
  pagePriority: 100 - i,
  alternativeNames: [],
}));

const FIGURES = { toolsPublished: 30, categories: 3, languages: 1, totalMonthlyUsd: 1, replaceableMonthlyUsd: 1, prompts: 30 };

function homeHtml() {
  return renderHomePage({
    lang: 'en', path: '/en/', toolViews, topCategorySlugs: CATS, categories, voteCounts: {},
    favicons: {}, figures: FIGURES, mrrTotal: 0, ui: UI, alternates: [], xDefaultPath: null, sponsorSlots: null,
  });
}

function categoryHtml() {
  return renderCategoryPage({
    lang: 'en', path: '/en/categories/analytics', categorySlug: 'analytics', categories,
    toolViews: toolViews.filter((t) => t.category === 'analytics'), voteCounts: {}, favicons: {},
    ui: UI, alternates: [], xDefaultPath: null, homePath: '/en/', sponsorSlots: null,
  });
}

function mount({ html = homeHtml(), search = '', votes = {} } = {}) {
  const win = new Window({
    url: `https://saasmadefree.com/en/${search}`,
    settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true },
  });
  const doc = win.document;
  doc.write(html);
  doc.close();
  const location = { search, href: `https://saasmadefree.com/en/${search}`, pathname: '/en/' };
  const calls = [];
  const fetchStub = (input) => {
    calls.push(String(input));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(votes) });
  };
  const run = new Function(
    'window', 'document', 'location', 'fetch', 'navigator', 'localStorage',
    'sessionStorage', 'setTimeout', 'URLSearchParams', 'Intl', 'URL', 'console', SITE_JS
  );
  run(win, doc, location, fetchStub, win.navigator, win.localStorage, win.sessionStorage,
    setTimeout, URLSearchParams, Intl, URL, console);

  const cards = () => [...doc.querySelectorAll('#tool-rows [data-slug]')];
  return {
    win, doc, calls,
    cards,
    visible: () => cards().filter((c) => !c.hidden).map((c) => c.dataset.slug),
    more: () => doc.getElementById('show-more'),
    chip: (v) => doc.querySelector(`.verdict-chip[data-verdict="${v}"]`),
    choose: (id, value) => {
      const select = doc.getElementById(id);
      select.value = value;
      select.dispatchEvent(new win.Event('change', { bubbles: true }));
    },
    flush: async () => { for (let i = 0; i < 6; i += 1) await new Promise((r) => setTimeout(r, 0)); },
  };
}

describe('site.js — grille de l’accueil', () => {
  it('montre 24 cartes puis « Voir plus », qui dévoile la suite par 24', () => {
    const page = mount();
    expect(page.visible()).toHaveLength(24);
    expect(page.more().hidden).toBe(false);
    expect(page.more().textContent).toBe('Show more (6 left)');
    page.more().click();
    expect(page.visible()).toHaveLength(30);
    expect(page.more().hidden).toBe(true);
  });

  it('dévoile le filtre de catégorie et le tri, rendus hidden pour qui n’a pas de JavaScript', () => {
    expect(mount().doc.querySelector('.selects').hidden).toBe(false);
  });

  it('filtre par verdict et tient l’état des pastilles', () => {
    const page = mount();
    page.chip('yes').click();
    expect(page.visible()).toHaveLength(10);
    expect(page.cards().filter((c) => !c.hidden).every((c) => c.dataset.verdict === 'yes')).toBe(true);
    expect(page.chip('yes').getAttribute('aria-pressed')).toBe('true');
    expect(page.chip('yes').classList.contains('is-active')).toBe(true);
    expect(page.chip('all').getAttribute('aria-pressed')).toBe('false');
    expect(page.more().hidden).toBe(true);
  });

  it('filtre par catégorie, cumulé avec le verdict, et annonce l’absence de résultat', () => {
    const page = mount();
    page.choose('cat-filter', 'design');
    expect(page.visible()).toHaveLength(10);
    expect(page.cards().filter((c) => !c.hidden).every((c) => c.dataset.category === 'design')).toBe(true);
    // Les fiches « design » sont celles d'indice 1, 4, 7… : verdict « kinda » seulement.
    page.chip('yes').click();
    expect(page.visible()).toEqual([]);
    expect(page.doc.getElementById('no-results').hidden).toBe(false);
    page.chip('kinda').click();
    expect(page.visible()).toHaveLength(10);
    expect(page.doc.getElementById('no-results').hidden).toBe(true);
  });

  it('trie par nom, par prix (les paiements uniques en dernier) et revient aux votes', () => {
    const page = mount();
    page.choose('order', 'name');
    const names = page.cards().map((c) => c.dataset.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    page.choose('order', 'price');
    const order = page.cards().map((c) => c.dataset.slug);
    expect(order[0]).toBe('outil-28');
    expect(order.at(-1)).toBe('outil-29');
    page.choose('order', 'votes');
    expect(page.cards()[0].dataset.slug).toBe('outil-0');
    // Le tri garde la pagination : toujours 24 cartes, les 24 premières.
    expect(page.visible()).toEqual(page.cards().slice(0, 24).map((c) => c.dataset.slug));
  });

  it('?q= filtre la grille au chargement et montre toutes les correspondances', () => {
    const page = mount({ search: '?q=accroche%202' });
    // « accroche 2 », « accroche 20 » … « accroche 29 » : onze fiches.
    expect(page.visible()).toHaveLength(11);
    expect(page.more().hidden).toBe(true);
  });

  it('rafraîchit les votes sur les cartes et reclasse, sans afficher « 0 vote »', async () => {
    const page = mount({ votes: { 'outil-7': 4 } });
    await page.flush();
    expect(page.calls.every((url) => url.startsWith('https://votes.saasmadefree.com/'))).toBe(true);
    const first = page.cards()[0];
    expect(first.dataset.slug).toBe('outil-7');
    expect(first.querySelector('[data-vote-cell]').textContent).toBe('4 votes');
    const zero = page.cards()[1].querySelector('[data-vote-cell]');
    expect(zero.querySelector('.visually-hidden').textContent).toBe('0 votes');
    expect(zero.textContent).toBe('0 votes');
    expect(page.visible()).toHaveLength(24);
  });

  it('le volet de recherche lit les cartes : nom, verdict, catégorie et prix', () => {
    const page = mount();
    const input = page.doc.getElementById('q');
    input.value = toolViews[3].name.toLowerCase();
    input.dispatchEvent(new page.win.Event('input', { bubbles: true }));
    const option = page.doc.querySelector('#search-panel [role="option"]');
    expect(option.querySelector('.search-option-name').textContent).toBe(toolViews[3].name);
    expect(option.querySelector('.badge')).not.toBeNull();
    expect(option.querySelector('.search-option-meta').textContent).toContain('Analytics');
    expect(page.doc.getElementById('search-panel').hidden).toBe(false);
  });
});

describe('site.js — page de catégorie', () => {
  it('sans « Voir plus » sur la page, toutes les cartes restent visibles', () => {
    const page = mount({ html: categoryHtml() });
    expect(page.cards()).toHaveLength(10);
    expect(page.visible()).toHaveLength(10);
  });
});
