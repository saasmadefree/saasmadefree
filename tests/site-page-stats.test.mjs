import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderStatsPage } from '../scripts/lib/site-page-stats.mjs';
import { escapeHtml } from '../scripts/lib/site-html.mjs';
import { assetUrl } from '../scripts/lib/site-assets.mjs';

const uiEn = JSON.parse(readFileSync('data/i18n/en/ui.json', 'utf8'));
const uiFr = JSON.parse(readFileSync('data/i18n/fr/ui.json', 'utf8'));

function render(ui = uiEn, lang = 'en') {
  return renderStatsPage({
    lang,
    path: `/${lang}/stats/`,
    ui,
    alternates: [{ lang: 'en', path: '/en/stats/' }, { lang: 'fr', path: '/fr/stats/' }],
    xDefaultPath: '/en/stats/',
    homePath: `/${lang}/`,
    toolCount: 529,
    verdictCounts: { yes: 70, kinda: 283, no: 176 },
  });
}

describe('renderStatsPage', () => {
  it('rend une page complète avec titre localisé et canonical', () => {
    const html = render(uiFr, 'fr');
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain(uiFr.site.stats.title);
    expect(html).toContain('<link rel="canonical" href="https://saasmadefree.com/fr/stats/">');
  });

  it('porte les chiffres build-time du catalogue (jamais recopiés à la main)', () => {
    const html = render();
    expect(html).toContain('529');
    expect(html).toContain('70');
    expect(html).toContain('283');
    expect(html).toContain('176');
  });

  it("expose l'API et charge stats.js", () => {
    const html = render();
    expect(html).toContain('data-stats-api="https://votes.saasmadefree.com/api/v1/stats"');
    expect(html).toContain(`<script src="${assetUrl('stats.js')}" defer></script>`);
  });

  it('contient tous les hooks DOM que stats.js utilise', () => {
    const html = render();
    const statsJs = readFileSync('scripts/assets/stats.js', 'utf8');
    const ids = [...statsJs.matchAll(/getElementById\('([a-z0-9-]+)'\)/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of new Set(ids)) {
      expect(html, `id manquant dans la page : ${id}`).toContain(`id="${id}"`);
    }
  });

  it("le canvas a un libellé accessible", () => {
    const html = render();
    expect(html).toMatch(/<canvas[^>]+aria-label=/);
  });
});

// Refonte du 23.08.2026 — la grille de canivibecodeit.com/stats dans le
// vocabulaire de l'accueil : libellé condensé en capitales, gros chiffre,
// légende courte. Les notes de méthode quittent les tuiles pour un seul bloc
// en bas de page, les états vides tiennent sur une ligne.
describe('renderStatsPage — grille allégée', () => {
  const html = render(uiFr, 'fr');
  const t = uiFr.site.stats;

  it('ouvre sur le titre et une ligne mono, sans le paragraphe d’intro en tête', () => {
    const head = html.match(/<header class="stats-head">(.*?)<\/header>/s)[1];
    expect(head).toContain(`<h1>${t.title}</h1>`);
    expect(head).toContain(t.tagline);
    expect(head).not.toContain(t.intro);
  });

  it('rend chaque tuile en libellé / chiffre / légende, sans note dedans', () => {
    const tiles = [...html.matchAll(/<div class="stat-tile[^"]*">(.*?)<\/div>/gs)].map((m) => m[1]);
    expect(tiles.length).toBe(12); // 4 sept jours + 4 depuis l'origine + 4 catalogue
    for (const tile of tiles) {
      expect(tile).toMatch(/<span class="stat-label">/);
      expect(tile).toMatch(/<span class="stat-value"/);
      expect(tile).toMatch(/<span class="stat-caption"/);
      expect(tile).not.toContain('stat-note');
    }
  });

  it('annonce la rangée « depuis le premier jour » par un bandeau avec la date en crochet', () => {
    expect(html).toMatch(/<div class="stats-band">.*?<span>Depuis le premier jour<\/span>.*?<span id="stats-since"><\/span>/s);
  });

  it('regroupe les notes de méthode en un seul bloc en bas de page', () => {
    const notes = html.match(/<section class="stats-notes"[^>]*>(.*?)<\/section>/s)[1];
    for (const key of ['intro', 'allTimeVisitorDaysNote', 'byCountryNote', 'crawlersNote', 'aiVisitorsNote']) {
      expect(notes, key).toContain(`<p>${escapeHtml(t[key])}</p>`);
    }
    // Et nulle part ailleurs : une note reste une note, pas un sous-titre.
    expect(html.split(escapeHtml(t.crawlersNote)).length).toBe(2);
  });

  it('colore les tuiles de verdict avec le libellé à côté, jamais la couleur seule', () => {
    for (const v of ['yes', 'kinda', 'no']) {
      expect(html).toMatch(new RegExp(`<span class="stat-dot ${v}" aria-hidden="true"></span>\\s*${uiFr.site.verdicts[v].label}`));
    }
    expect(html).toContain('class="verdict-stack"');
  });

  it('met pays et langues à côté des pages vues, votes à côté des visiteurs IA, crawlers en pleine largeur', () => {
    const cols = [...html.matchAll(/<div class="stats-cols">(.*?)<\/div>\s*(?=<div class="stats-cols">|<section class="stats-sheet")/gs)];
    expect(cols.length).toBe(2);
    expect(cols[0][1]).toContain('id="top-pages"');
    expect(cols[0][1]).toContain('id="by-country"');
    expect(cols[0][1]).toContain('id="views-langs"');
    expect(cols[1][1]).toContain('id="copies-agents"');
    expect(cols[1][1]).toContain('id="ai-referrals"');
    expect(cols[1][1]).toContain('id="top-voted"');
    // Sept lignes à trois colonnes ne tiennent pas dans une demi-largeur.
    expect(html).toMatch(/<section class="stats-sheet">\s*<h2 class="stats-h">[^<]*<\/h2>\s*<div class="crawler-list" id="ai-crawlers">/);
  });

  it('charge Chart.js depuis notre origine, avant stats.js, et pose le canvas dans sa boîte', () => {
    const chart = html.indexOf(`<script src="${assetUrl('chart.umd.js')}" defer></script>`);
    const stats = html.indexOf(`<script src="${assetUrl('stats.js')}" defer></script>`);
    expect(chart).toBeGreaterThan(-1);
    expect(stats).toBeGreaterThan(chart);
    expect(html).toMatch(/<div class="chart-box">\s*<canvas id="views-chart"[^>]*role="img"/);
    expect(html).not.toMatch(/src="https?:\/\//);
  });

  it('donne à stats.js les légendes dont il a besoin (date du record, état vide, départ, unité du graphe)', () => {
    const payload = JSON.parse(html.match(/data-stats-i18n="([^"]+)"/)[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
    expect(payload.noData).toBe(t.noData);
    expect(payload.peakCaption).toBe(t.peakCaption);
    expect(payload.allTimeSince).toBe(t.allTimeSince);
    expect(payload.viewsLabel).toBe(t.viewsLabel);
  });
});

// scripts/assets/stats.js exécuté pour de vrai contre la page rendue, avec une
// réponse d'API sous contrôle (sans Chart.js : le graphe est sauté). Revue
// finale, finding 4 : les noms collés à leur éditeur (« AmazonbotAmazon »),
// pour l'œil comme pour le lecteur d'écran.
describe('stats.js — lignes lisibles', async () => {
  const { Window } = await import('happy-dom');
  const STATS_JS = readFileSync('scripts/assets/stats.js', 'utf8');
  const payload = {
    today: { views: 3 }, peak: { views: 62, day: '2026-08-14' }, visitors7d: 9,
    copies7d: { total: 0, byAgent: [], topPrompts: [] }, views14d: [],
    aiReferrals: { d7: [{ ai: 'ChatGPT', n: 1 }], d30: [{ ai: 'ChatGPT', n: 2 }] },
    crawlers7d: [{ label: 'Amazonbot', vendor: 'Amazon', edge: 0, cf: 392, lastSeen: '2026-10-16' }],
    topPages7d: [], langs7d: [], votes: { total: 0, top: [] },
    countries7d: [{ country: 'US', views: 9 }],
  };

  async function mount() {
    const win = new Window({ url: 'https://saasmadefree.com/en/stats/', settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
    win.document.write(render());
    const run = new Function('window', 'document', 'fetch', 'Intl', 'MutationObserver', 'getComputedStyle', STATS_JS);
    run(win, win.document, () => Promise.resolve({ ok: true, json: () => Promise.resolve(payload) }), Intl,
      win.MutationObserver, win.getComputedStyle.bind(win));
    for (let i = 0; i < 6; i += 1) await new Promise((r) => setTimeout(r, 0));
    return win.document;
  }

  it('un robot et son éditeur sont séparés dans le DOM, pas seulement à l’écran', async () => {
    const doc = await mount();
    const row = doc.querySelector('#ai-crawlers .crawler-row');
    expect(row.textContent).not.toContain('AmazonbotAmazon');
    expect(row.textContent.replace(/\s+/g, ' ')).toMatch(/^Amazonbot Amazon edge 0 · cf 392 \S/);
  });

  it('une pastille de pays sépare le code du chiffre (« US 9 », jamais « US9 »)', async () => {
    const doc = await mount();
    const chip = doc.querySelector('#by-country .stat-chip');
    expect(chip.textContent).toContain('US 9');
  });
});

describe('page /stats — espacement des blocs (finding 4)', () => {
  it('les blocs de .stats-page ne se touchent plus : espacés par les jetons, bandeaux et sections plus loin', async () => {
    const { SITE_CSS } = await import('../scripts/lib/site-styles.mjs');
    expect(SITE_CSS).toMatch(/\.stats-page>\*\+\*\{margin-top:var\(--s5\)\}/);
    expect(SITE_CSS).toMatch(/\.stats-page>\.stats-band,\.stats-page>section:not\(\.stats-sheet\)\{margin-top:var\(--s7\)\}/);
  });
});
