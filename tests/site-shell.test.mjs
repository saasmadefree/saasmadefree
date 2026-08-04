import { describe, it, expect } from 'vitest';
import { renderLayout } from '../scripts/lib/site-html.mjs';
import { SITE_CSS } from '../scripts/lib/site-styles.mjs';

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
