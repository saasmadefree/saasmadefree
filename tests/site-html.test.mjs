import { describe, it, expect } from 'vitest';
import {
  escapeHtml, jsonLdScript, languageName, renderBreadcrumb, verdictBadge,
  renderLayout, stamp, dateRing, verdictChecks,
} from '../scripts/lib/site-html.mjs';

describe('escapeHtml', () => {
  it('échappe les cinq caractères sensibles', () => {
    expect(escapeHtml(`<a href="x">it's & "quoted"</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;it&#39;s &amp; &quot;quoted&quot;&lt;/a&gt;'
    );
  });
});

describe('jsonLdScript', () => {
  it("échappe '<' pour qu'une séquence </script> dans les données ne casse jamais le bloc", () => {
    const html = jsonLdScript({ name: '</script><script>alert(1)</script>' });
    expect(html).not.toContain('</script><script>alert');
    expect(html).toContain('\\u003c/script>');
  });

  it('reste un JSON valide une fois désérialisé', () => {
    const data = { a: 1, b: ['x', 'y'] };
    const html = jsonLdScript(data);
    const inner = html.replace('<script type="application/ld+json">\n', '').replace('\n</script>', '');
    expect(JSON.parse(inner)).toEqual(data);
  });
});

describe('languageName', () => {
  it('connaît les sept langues du projet', () => {
    expect(languageName('en')).toBe('English');
    expect(languageName('fr')).toBe('Français');
  });

  it('retombe sur le code lui-même pour une langue inconnue', () => {
    expect(languageName('xx')).toBe('xx');
  });
});

describe('renderBreadcrumb', () => {
  it('rend le dernier élément comme la page courante, sans lien', () => {
    const html = renderBreadcrumb([
      { label: 'Directory', href: '/en/' },
      { label: 'Notion', href: '/en/tools/notion' },
    ]);
    expect(html).toContain('<a href="/en/">Directory</a>');
    expect(html).toContain('<span aria-current="page">Notion</span>');
    expect(html).not.toContain('<a href="/en/tools/notion">Notion</a>');
  });
});

describe('verdictBadge', () => {
  it('porte la classe du verdict et le texte échappé', () => {
    expect(verdictBadge('yes', 'Yes')).toBe('<span class="badge yes">Yes</span>');
  });

  it('accepte un modificateur optionnel pour la variante agrandie', () => {
    expect(verdictBadge('kinda', 'Partly', 'badge-lg')).toBe('<span class="badge kinda badge-lg">Partly</span>');
  });

  it('échappe le texte du label', () => {
    expect(verdictBadge('no', '<script>')).toBe('<span class="badge no">&lt;script&gt;</span>');
  });
});

// `ui` minimal pour le chrome du dossier — inspiré des fabriques voisines
// (tests/site-shell.test.mjs) mais complet sur nav/footer pour ne jamais
// laisser fuir la chaîne "undefined" dans le HTML rendu.
const dossierUi = {
  site: {
    brand: 'SaaS Made Free', skipToContent: 'Skip to content', directoryLabel: 'Directory',
    languageSwitcherLabel: 'Language',
    nav: { submitTool: 'Submit a tool', source: 'Source', github: 'GitHub', sponsor: 'Sponsor' },
    footer: { source: 'Source on GitHub', stats: 'Stats', privacy: 'Privacy', credit: 'Credit' },
    themeToDark: 'Dark mode', themeToLight: 'Light mode',
    dossier: { serviceName: 'Subscription Review Service', registryLabel: 'Registry' },
  },
};

describe('renderLayout — chrome du dossier', () => {
  const html = renderLayout({
    lang: 'en', path: '/en/', title: 't', description: 'd',
    main: '<h1>x</h1>', ui: dossierUi, homeHref: '/en/',
    refCells: [['Registry', '529'], ['Statement drawn up on', '04.08.2026']],
  });

  it('ouvre sur le bandeau de service', () => {
    expect(html).toContain('class="service-band"');
    expect(html).toContain('Subscription Review Service');
  });

  it('rend la cartouche de références quand refCells est fourni', () => {
    expect(html).toContain('class="ref-strip"');
    expect(html).toContain('04.08.2026');
  });

  it('garde les crochets JS : theme-toggle, lang-switch, script de thème inline', () => {
    expect(html).toContain('id="theme-toggle"');
    expect(html).toContain('localStorage.getItem("theme")');
  });
});

describe('renderLayout — locale réduite (site sans dossier)', () => {
  // Une locale non publiée (page /stats en 7 langues) réduit ui.site à
  // {footer, stats} : ni le bandeau ni le monogramme ne doivent supposer que
  // ui.site.dossier existe, sous peine de planter le build ou d'afficher la
  // chaîne "undefined" au lecteur.
  const reducedUi = {
    site: {
      brand: 'SaaS Made Free', skipToContent: 'Skip to content', directoryLabel: 'Directory',
      nav: { source: 'Source', sponsor: 'Sponsor' },
      footer: { source: 'Source on GitHub', stats: 'Stats', privacy: 'Privacy', credit: 'Credit' },
      themeToDark: 'Dark mode', themeToLight: 'Light mode',
      // pas de `dossier`
    },
  };
  const html = renderLayout({
    lang: 'en', path: '/en/', title: 't', description: 'd',
    main: '<h1>x</h1>', ui: reducedUi, homeHref: '/en/',
  });

  it('ne rend pas le bandeau de service', () => {
    expect(html).not.toContain('class="service-band"');
  });

  it('ne laisse jamais fuir la chaîne "undefined"', () => {
    expect(html).not.toContain('undefined');
  });
});

describe('composants tampon', () => {
  it('stamp rend un tampon à lignes', () => {
    expect(stamp('verif', ['Verified on', '30.07.2026']))
      .toBe('<span class="stamp stamp-verif">Verified on<span class="stamp-sub">30.07.2026</span></span>');
  });

  it('dateRing est lisible (texte réel, pas aria-hidden)', () => {
    const html = dateRing('Verified on', '30.07.2026');
    expect(html).toContain('class="date-ring"');
    expect(html).toContain('30.07.2026');
    expect(html).not.toContain('aria-hidden');
  });

  it('verdictChecks montre les trois cases, coche la bonne, et le dit aux lecteurs d’écran', () => {
    const verdicts = { yes: { label: 'Yes' }, kinda: { label: 'Partly' }, no: { label: 'No' } };
    const html = verdictChecks('kinda', verdicts, 'selected');
    expect(html.match(/class="check-item/g)).toHaveLength(3);
    expect(html).toContain('check-item is-checked');
    expect(html).toContain('<span class="visually-hidden"> (selected)</span>');
  });
});
