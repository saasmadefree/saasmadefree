import { describe, it, expect } from 'vitest';
import { render404Page } from '../scripts/lib/site-page-404.mjs';

// Fabrique réaliste (locale de secours 'en', celle utilisée par build-site.mjs
// pour render404Page) : uniquement des clés qui existent dans
// data/i18n/en/ui.json — le test verrouille le gabarit, pas les traductions.
// Le tampon "SANS OBJET" est la valeur fr, prise ici volontairement pour
// vérifier que le gabarit affiche bien la valeur fournie sans la traduire lui-même.
const ui = {
  site: {
    brand: 'SaaS Made Free',
    skipToContent: 'Skip to content',
    directoryLabel: 'Directory',
    languageSwitcherLabel: 'Language',
    footer: { source: 'Source', stats: 'Stats', privacy: 'Privacy', credit: 'Credit' },
    notFound: {
      titleTag: 'Page not found — SaaS Made Free',
      metaDescription: 'This page does not exist.',
      heading: 'This page does not exist',
      body: 'The tool may have been removed from the catalogue, or the address is wrong.',
      stamp: 'SANS OBJET',
    },
  },
};

describe('render404Page — SANS OBJET', () => {
  it('tamponne la page et renvoie vers les registres', () => {
    const html = render404Page({ ui, enPath: '/en/', langs: ['en', 'fr'] });
    expect(html).toContain('class="badge no badge-lg"');   // le tampon réutilise le composant verdict "no"
    expect(html).toContain('SANS OBJET');                  // (valeur de la locale testée)
    expect(html).toContain('<meta name="robots" content="noindex">');
  });

  it('ne tamponne rien si notFound.stamp est absent (défense en profondeur)', () => {
    const uiNoStamp = { site: { ...ui.site, notFound: { ...ui.site.notFound, stamp: undefined } } };
    const html = render404Page({ ui: uiNoStamp, enPath: '/en/', langs: ['en', 'fr'] });
    expect(html).not.toContain('class="badge no badge-lg"');
    expect(html).not.toContain('undefined');
  });
});
