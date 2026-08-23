import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { ASSET_FILES, ASSET_VERSION, assetUrl } from '../scripts/lib/site-assets.mjs';
import { SITE_CSS } from '../scripts/lib/site-styles.mjs';
import { renderLayout } from '../scripts/lib/site-html.mjs';

// Pourquoi des URL versionnées : Pages sert /assets/* avec max-age=14400 et
// les pages HTML avec max-age=0. Un visiteur qui revenait dans les 4 h après
// un déploiement recevait le HTML neuf avec la feuille de style de la veille
// — la page /stats refaite le 23.08.2026 s'est affichée en tuiles empilées
// et graphe d'avant. Avec l'empreinte dans le chemin, une feuille modifiée
// est une URL nouvelle : le HTML (toujours revalidé) ne peut plus pointer
// sur un asset périmé, et l'asset lui-même peut être mis en cache un an.
describe('assets versionnés par empreinte de contenu', () => {
  it('expose les quatre assets du site, avec leur contenu réel', () => {
    expect(Object.keys(ASSET_FILES).sort()).toEqual(['beacon.js', 'site.css', 'site.js', 'stats.js']);
    expect(ASSET_FILES['site.css']).toBe(SITE_CSS);
    expect(ASSET_FILES['stats.js']).toBe(readFileSync('scripts/assets/stats.js', 'utf8'));
  });

  it('dérive une version courte et stable du contenu', () => {
    expect(ASSET_VERSION).toMatch(/^[0-9a-f]{10}$/);
  });

  it('forme des URL sous /assets/v/<version>/ et refuse un nom inconnu', () => {
    expect(assetUrl('site.css')).toBe(`/assets/v/${ASSET_VERSION}/site.css`);
    expect(() => assetUrl('nope.js')).toThrow(/nope\.js/);
  });

  it('le layout charge la feuille et les scripts par leur URL versionnée, jamais par le chemin nu', () => {
    const html = renderLayout({
      lang: 'en', path: '/en/', title: 'T', description: 'D', main: '<h1>x</h1>', homeHref: '/en/',
      ui: { site: { brand: 'B', skipToContent: 'Skip', languageSwitcherLabel: 'L', nav: {}, footer: { source: 'S', privacy: 'P' } } },
    });
    expect(html).toContain(`<link rel="stylesheet" href="${assetUrl('site.css')}">`);
    expect(html).toContain(`<script src="${assetUrl('site.js')}" defer></script>`);
    expect(html).toContain(`<script src="${assetUrl('beacon.js')}" defer></script>`);
    expect(html).not.toMatch(/\/assets\/(site\.css|site\.js|beacon\.js|stats\.js)"/);
  });

  // Ces deux-là ne valent qu'après `npm run build` (voir sponsor-checkout-urls).
  it.skipIf(!existsSync('dist'))('le build écrit les assets sous leur dossier de version et nulle part ailleurs', () => {
    for (const name of Object.keys(ASSET_FILES)) {
      expect(existsSync(`dist/assets/v/${ASSET_VERSION}/${name}`), name).toBe(true);
      expect(existsSync(`dist/assets/${name}`), `${name} nu`).toBe(false);
    }
    expect(readFileSync(`dist/assets/v/${ASSET_VERSION}/site.css`, 'utf8')).toBe(SITE_CSS);
  });

  it.skipIf(!existsSync('dist'))('privacy.html, statique, pointe lui aussi sur la feuille versionnée', () => {
    const html = readFileSync('dist/privacy.html', 'utf8');
    expect(html).toContain(`href="${assetUrl('site.css')}"`);
    expect(html).not.toContain('href="/assets/site.css"');
  });

  it('_headers met le dossier de version en cache un an, immuable', () => {
    const headers = readFileSync('public/_headers', 'utf8');
    expect(headers).toMatch(/\/assets\/v\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
  });
});
