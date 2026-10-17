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

  it('porte la classe .crumbs du système de design', () => {
    expect(renderBreadcrumb([{ label: 'Directory', href: '/en/' }])).toContain('<nav class="crumbs" aria-label="Breadcrumb">');
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

  it('n’ouvre plus sur un bandeau de service', () => {
    // Retiré le 20.08.2026 avec le reste du dossier : un titre de service
    // inventé, qui ne portait aucun fait. La coquille ouvre désormais
    // directement sur la marque.
    expect(html).not.toContain('class="service-band"');
    expect(html).not.toContain('Subscription Review Service');
  });

  it('rend la cartouche de références quand refCells est fourni', () => {
    expect(html).toContain('class="ref-strip"');
    expect(html).toContain('04.08.2026');
  });

  it('garde les crochets JS : theme-toggle, lang-switch, script de thème inline', () => {
    expect(html).toContain('id="theme-toggle"');
    expect(html).toContain('localStorage.getItem("theme")');
  });

  // Allégé le 23.08.2026 : « Annuaire » doublonnait la marque (même cible,
  // à trois centimètres) et « Code source » doublonnait le bouton GitHub
  // d'à côté et le lien du pied de page. Il reste Proposer / Sponsor / Stats.
  it('ne répète ni le lien Annuaire ni le lien Code source dans la navigation', () => {
    const nav = html.match(/<ul class="nav-links">(.*?)<\/ul>/s)[1];
    expect(nav).not.toContain('>Directory<');
    expect(nav).not.toContain('>Source<');
    expect(nav).toContain('>Submit a tool<');
    expect(nav).toContain('>Sponsor<');
    expect(nav).toContain('>Stats<');
  });

  it('la marque est un seul lien, pastille comprise', () => {
    expect(html).toMatch(/<a class="brand" href="\/en\/"><span class="brand-mark" aria-hidden="true">S<\/span>SaaS Made Free<\/a>/);
  });

  it('pose la promesse du pied de page quand la locale la porte', () => {
    const withPromise = renderLayout({
      lang: 'en', path: '/en/', title: 't', description: 'd', main: '<h1>x</h1>', homeHref: '/en/',
      ui: { site: { ...dossierUi.site, footer: { ...dossierUi.site.footer, promise: 'This page loads nothing from anyone else.' } } },
    });
    expect(withPromise).toMatch(/<footer class="site-footer">\s*<p>This page loads nothing from anyone else\.<\/p>/);
    expect(html).not.toContain('<footer class="site-footer">\n        <p>');
  });

  it('émet <meta name="robots"> seulement quand robots est fourni', () => {
    expect(html).not.toContain('name="robots"');
    const noindex = renderLayout({
      lang: 'en', path: '/en/', title: 't', description: 'd', main: '<h1>x</h1>', ui: dossierUi,
      homeHref: '/en/', robots: 'noindex,follow',
    });
    expect(noindex).toContain('<meta name="robots" content="noindex,follow">');
  });

  it('réduit le bouton GitHub à son icône, le nom restant porté par aria-label', () => {
    const btn = html.match(/<a class="github-btn"[^>]*>.*?<\/a>/s)[0];
    expect(btn).toContain('aria-label="GitHub"');
    expect(btn).toContain('<svg');
    expect(btn).toContain('aria-hidden="true"');
    // Ni le libellé ni la flèche ↗ en texte visible.
    expect(btn.replace(/<[^>]+>/g, '').trim()).toBe('');
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
