import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderStatsPage } from '../scripts/lib/site-page-stats.mjs';

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
