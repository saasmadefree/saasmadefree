import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderLayout } from '../scripts/lib/site-html.mjs';
import { SITE_CSS } from '../scripts/lib/site-styles.mjs';
import { sponsorContext, renderSponsorSlots } from '../scripts/lib/site-sponsors.mjs';
import { LANGS } from '../scripts/lib/load-data.mjs';

const ui = {
  site: {
    brand: 'SaaS Made Free', skipToContent: 'Skip', languageSwitcherLabel: 'Language',
    directoryLabel: 'Directory', nav: {}, footer: { source: 'Source', privacy: 'Privacy' },
  },
};

function layout() {
  return renderLayout({
    lang: 'en', path: '/en/', title: 'T', description: 'D',
    main: '<h1>Hello</h1>', ui, homeHref: '/en/',
  });
}

describe('coquille de mise en page', () => {
  it('emboîte .shell > .col-main > .page', () => {
    const html = layout();
    const shell = html.indexOf('<div class="shell">');
    const col = html.indexOf('<div class="col-main">');
    const page = html.indexOf('<div class="page">');
    expect(shell).toBeGreaterThan(-1);
    expect(col).toBeGreaterThan(shell);
    expect(page).toBeGreaterThan(col);
  });

  it('garde le contenu principal dans la page', () => {
    expect(layout()).toContain('<h1>Hello</h1>');
  });
});

describe('débord pleine largeur', () => {
  // Le débord doit s'ancrer sur .col-main, pas sur la fenêtre : avec des rails,
  // un débord en vw passerait SOUS les rails. Un seul oubli suffit, et rien ne
  // le signalerait à l'œil tant qu'aucun sponsor n'est vendu.
  it("n'utilise plus le débord en unités de fenêtre", () => {
    expect(SITE_CSS).not.toMatch(/width:\s*100vw/);
    expect(SITE_CSS).not.toMatch(/calc\(\s*50%\s*-\s*50vw\s*\)/);
  });

  it('ancre le débord sur le conteneur de requête', () => {
    expect(SITE_CSS).toContain('container-type:inline-size');
    expect(SITE_CSS).toMatch(/width:\s*100cqw/);
  });

  it('déplace le padding horizontal de body vers .page, sinon 100cqw < 100vw', () => {
    expect(SITE_CSS).toMatch(/\.page\{[^}]*padding-inline/);
  });
});

const sponsorUi = {
  site: {
    ...ui.site,
    sponsor: {
      openLabel: 'Open', perDays: '/ 30 days',
      bookCta: 'Book',
    },
  },
};

const ctx = sponsorContext({
  placements: [], today: '2026-08-10', lang: 'en', ui: sponsorUi, sponsorHref: '/en/sponsor',
});

describe('insertion des sponsors dans la coquille', () => {
  const withSponsors = () => renderLayout({
    lang: 'en', path: '/en/', title: 'T', description: 'D',
    main: '<h1>Hi</h1>', ui: sponsorUi, homeHref: '/en/',
    sponsorSlots: renderSponsorSlots(ctx),
  });

  it('place les bandeaux hors de .shell, sinon ils passeraient sous les rails', () => {
    const html = withSponsors();
    expect(html.indexOf('sponsor-tape sp-top')).toBeLessThan(html.indexOf('<div class="shell">'));
    // '</div>\n</div>' n'apparaît jamais dans le gabarit (chaque </div> est
    // suivi d'un </div> indenté, pas en début de ligne) : ancrée dessus,
    // l'assertion se réduisait à toBeGreaterThan(-1) et restait verte même si
    // sp.tapeBottom finissait à l'intérieur de .shell.
    // lastIndexOf('class="sp-rail') n'est pas un meilleur repère : si
    // sp.tapeBottom était déplacé juste après sp.railRight — toujours à
    // l'intérieur de .shell — son index resterait quand même après celui du
    // dernier rail, et l'assertion resterait verte à tort (vérifié en cassant
    // volontairement le gabarit, voir le rapport de tâche).
    // Le seul repère fiable est la fermeture de .shell elle-même : c'est
    // l'unique "</div>" du gabarit qui n'est pas indenté (tous les autres
    // sont imbriqués), donc l'unique occurrence littérale de "\n</div>\n".
    const shellClose = html.indexOf('\n</div>\n', html.indexOf('<div class="shell">'));
    expect(shellClose).toBeGreaterThan(-1);
    expect(html.indexOf('sponsor-tape sp-bottom')).toBeGreaterThan(shellClose);
  });

  it('rend exactement deux rails', () => {
    expect(withSponsors().split('class="sp-rail').length - 1).toBe(2);
  });

  it('place les rails après .col-main dans le DOM pour l’ordre de lecture', () => {
    const html = withSponsors();
    expect(html.indexOf('class="col-main"')).toBeLessThan(html.indexOf('class="sp-rail'));
  });

  it('n’émet aucun balisage sponsor sans contexte', () => {
    expect(layout()).not.toContain('sp-rail');
    expect(layout()).not.toContain('sponsor-tape');
  });
});

// build-site.mjs porte un garde-fou (`if (!langUi?.site) throw …`) qui doit
// échouer bruyamment, avec un message actionnable, le jour où une fiche
// déclare un marché sans que les chaînes du site aient été traduites pour
// cette langue. Un bloc "site" fragmentaire (ex. juste site.sponsor) dans une
// locale non publiée neutraliserait ce garde-fou en silence : le contrôle
// passerait, et le build planterait plus loin sur un ui.site.brand ou
// ui.site.skipToContent indéfini, avec un TypeError opaque au lieu du
// message qui dit quoi faire. C'est exactement la régression introduite puis
// corrigée dans cette tâche — ce test la verrouille pour de bon.
const PUBLISHED_SITE_LANGS = new Set(['en', 'fr']);

describe('bloc "site" des locales — publié en entier, jamais par fragments', () => {
  for (const lang of LANGS) {
    const shouldHaveSite = PUBLISHED_SITE_LANGS.has(lang);
    it(`${lang}/ui.json ${shouldHaveSite ? 'porte' : 'ne porte pas'} de bloc "site"`, () => {
      const raw = readFileSync(join('data', 'i18n', lang, 'ui.json'), 'utf8');
      const langUi = JSON.parse(raw);
      expect(Object.prototype.hasOwnProperty.call(langUi, 'site')).toBe(shouldHaveSite);
    });
  }
});

describe('CSS des sponsors', () => {
  it('utilise sticky et jamais fixed — un rail fixe ne réserverait aucune place', () => {
    expect(SITE_CSS).toMatch(/\.sp-rail\{[^}]*position:sticky/);
    expect(SITE_CSS).not.toMatch(/\.sp-rail\{[^}]*position:fixed/);
  });

  it('pose align-self:start, sans quoi le collage n’a jamais lieu', () => {
    expect(SITE_CSS).toMatch(/\.sp-rail\{[^}]*align-self:start/);
  });

  it('déclare trois pistes de grille au-delà du seuil', () => {
    expect(SITE_CSS).toContain('@media (min-width:84rem)');
    expect(SITE_CSS).toMatch(/grid-template-columns:minmax\(9rem,13rem\)/);
  });

  it('masque le repli quand les rails sont visibles, et l’inverse', () => {
    expect(SITE_CSS).toMatch(/\.sp-rail\{[^}]*display:none/);
  });

  it('coupe le défilement du bandeau en mouvement réduit', () => {
    expect(SITE_CSS).toContain('prefers-reduced-motion');
    expect(SITE_CSS).toMatch(/\.sp-tape-track\{[^}]*flex-wrap:wrap/);
  });

  it('masque la moitié dupliquée en mouvement réduit — sans quoi chaque sponsor apparaît deux fois', () => {
    expect(SITE_CSS).toMatch(/\.sp-tape-item\[inert\]\{[^}]*display:none/);
  });

  // L'état "complet" ne peut pas se produire : un inventaire plein n'a plus
  // aucun slot libre à rendre, donc la branche qui affichait .sp-full était
  // morte. Les deux classes qui n'existent plus dans le balisage n'ont plus à
  // exister dans la feuille non plus.
  it('ne porte plus les classes du balisage supprimé', () => {
    expect(SITE_CSS).not.toContain('.sp-full');
    expect(SITE_CSS).not.toContain('.sp-fallback-h{');
  });
});
