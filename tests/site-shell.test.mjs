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
  const withSponsors = (main = '<h1>Hi</h1>') => renderLayout({
    lang: 'en', path: '/en/', title: 'T', description: 'D',
    main, ui: sponsorUi, homeHref: '/en/',
    sponsorSlots: renderSponsorSlots(ctx),
  });

  // Le bandeau du bas doit fermer .shell AVANT de commencer : à l'intérieur,
  // sa pleine largeur passerait sous les rails.
  //
  // L'ancre est structurelle, et c'est le troisième essai. Les deux premiers
  // se réduisaient à un « existe quelque part » :
  //  - '</div>\n</div>' n'apparaît jamais dans le gabarit, donc l'assertion
  //    valait toBeGreaterThan(-1) ;
  //  - "\n</div>\n" (censé être l'unique </div> non indenté) dérive dès que le
  //    `main` injecté — donc n'importe quelle vraie page — contient lui-même
  //    un </div> en début de ligne : l'ancre se déplace À L'INTÉRIEUR de main
  //    et l'assertion redevient vacante. Le gabarit ne tenait que parce que
  //    la fixture avait un main d'une seule ligne.
  // Seule la séquence complète « fin du dernier rail, fermeture de .shell,
  // ouverture du bandeau du bas » ne peut pas se produire ailleurs.
  const SHELL_CLOSE_THEN_BOTTOM_TAPE =
    /<\/aside>\s*<\/div>\s*<div class="sponsor-tape sp-bottom"/;

  it('place les bandeaux hors de .shell, sinon ils passeraient sous les rails', () => {
    const html = withSponsors();
    expect(html.indexOf('sponsor-tape sp-top')).toBeLessThan(html.indexOf('<div class="shell">'));
    expect(html).toMatch(SHELL_CLOSE_THEN_BOTTOM_TAPE);
  });

  // Le point exact sur lequel l'ancre précédente cédait : un `main` réaliste
  // porte des </div> en début de ligne (sections, grilles, encarts).
  it('garde l’ancre valide avec un main qui contient lui-même un </div> non indenté', () => {
    const html = withSponsors('<div class="realistic">\n<p>x</p>\n</div>\n<div class="other">\n</div>');
    expect(html.split('\n</div>\n').length - 1).toBeGreaterThan(1);
    expect(html).toMatch(SHELL_CLOSE_THEN_BOTTOM_TAPE);
    expect(html.match(new RegExp(SHELL_CLOSE_THEN_BOTTOM_TAPE, 'g'))).toHaveLength(1);
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

// Cet invariant a été réécrit lors de l'intégration de la page /stats.
//
// Il vérifiait auparavant qu'une locale non publiée n'a aucun bloc `site`, ce
// qui protégeait le garde-fou `!langUi?.site` de build-site.mjs. Mais /stats
// existe dans les sept langues et leur a donné à toutes un bloc `site` réduit
// à { footer, stats } — le garde-fou passait donc désormais pour n'importe
// quelle locale, et le build cassait plus loin sur une clé indéfinie.
//
// Ce qu'on verrouille maintenant est la propriété qui compte vraiment : seules
// les langues réellement publiées portent un bloc `site` COMPLET, et la
// sentinelle du garde-fou (`site.brand`) est ce qui les distingue.
describe('bloc "site" des locales — complet seulement pour les langues publiées', () => {
  for (const lang of LANGS) {
    const published = PUBLISHED_SITE_LANGS.has(lang);
    it(`${lang}/ui.json ${published ? 'porte' : 'ne porte pas'} un bloc "site" complet`, () => {
      const langUi = JSON.parse(readFileSync(join('data', 'i18n', lang, 'ui.json'), 'utf8'));
      expect(Boolean(langUi.site?.brand)).toBe(published);
    });
  }

  it('une locale non publiée ne porte que les clés partagées par toutes', () => {
    // Les cinq non publiées n'existent dans le ui.json que pour /stats et le
    // pied de page. Toute autre clé y serait morte — et masquerait le fait que
    // la langue n'est pas prête à être servie.
    for (const lang of LANGS) {
      if (PUBLISHED_SITE_LANGS.has(lang)) continue;
      const langUi = JSON.parse(readFileSync(join('data', 'i18n', lang, 'ui.json'), 'utf8'));
      expect(Object.keys(langUi.site ?? {}).sort()).toEqual(['footer', 'stats']);
    }
  });
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

  // Le schéma autorise un `name` de 32 caractères ; la piste minimale d'un
  // rail fait 9rem (≈ 116px de contenu, une quinzaine de caractères). Sans
  // occasion de coupure, un mot unique de 32 caractères débordait de la carte
  // et faisait apparaître une barre de défilement horizontale sur le rail
  // (overflow-y:auto force overflow-x à auto).
  it('coupe un mot unique trop long plutôt que de faire déborder la carte', () => {
    expect(SITE_CSS).toMatch(/\.sp-card\{[^}]*overflow-wrap:anywhere/);
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
