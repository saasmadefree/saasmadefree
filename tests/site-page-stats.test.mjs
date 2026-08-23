import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderStatsPage } from '../scripts/lib/site-page-stats.mjs';
import { escapeHtml } from '../scripts/lib/site-html.mjs';

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
    expect(html).toContain('<script src="/assets/stats.js" defer></script>');
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

  it('donne à stats.js les légendes dont il a besoin (date du record, état vide, départ)', () => {
    const payload = JSON.parse(html.match(/data-stats-i18n="([^"]+)"/)[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
    expect(payload.noData).toBe(t.noData);
    expect(payload.peakCaption).toBe(t.peakCaption);
    expect(payload.allTimeSince).toBe(t.allTimeSince);
  });
});
