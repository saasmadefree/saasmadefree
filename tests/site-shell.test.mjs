import { describe, it, expect } from 'vitest';
import { renderLayout } from '../scripts/lib/site-html.mjs';
import { SITE_CSS } from '../scripts/lib/site-styles.mjs';
import { sponsorContext, renderSponsorSlots } from '../scripts/lib/site-sponsors.mjs';

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
      label: 'Sponsor', heading: 'Sponsors', openLabel: 'Open', perDays: '/ 30 days',
      bookCta: 'Book', fullLabel: 'Full', railAriaLabel: 'Sponsors', tapeAriaLabel: 'Sponsors',
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
    expect(html.indexOf('sponsor-tape sp-bottom')).toBeGreaterThan(html.indexOf('</div>\n</div>'));
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
