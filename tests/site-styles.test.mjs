import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_CSS, TOKENS, SPACE } from '../scripts/lib/site-styles.mjs';

// Garde-fous du système de design « La table de cuisine, aérée »
// (docs/superpowers/specs/2026-10-17-design-system.md). Ils remplacent ceux du
// « Dossier instruit » / « Verdict » (palette fermée, tampons, trois
// animations nommées, aplats sans dégradé), supprimés avec ce design.

// Budget fixé par la Task A0 : taille réelle de la feuille au 17/10/2026
// (27 129 octets) + 15 %, arrondi. Les tâches suivantes ne le changent pas
// (global-constraints.md) : une page de plus se paie en réutilisant les
// composants, pas en agrandissant la feuille.
const CSS_BUDGET_BYTES = 31_198;

/** Les règles de la feuille, sélecteurs et déclarations séparés. Les @media et
 *  @container ouvrent un bloc sans déclaration : on ne garde que les feuilles. */
const RULES = [...SITE_CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selectors, decl]) => ({ selectors: selectors.trim(), decl }));

describe('SITE_CSS — budget et requêtes', () => {
  it(`tient dans le budget de ${CSS_BUDGET_BYTES} octets`, () => {
    expect(Buffer.byteLength(SITE_CSS, 'utf8')).toBeLessThanOrEqual(CSS_BUDGET_BYTES);
  });

  it('aucun @import, aucune URL absolue : rien ne part vers un tiers', () => {
    expect(SITE_CSS).not.toContain('@import');
    expect(SITE_CSS).not.toMatch(/url\(\s*['"]?(?:https?:)?\/\//);
  });

  it('chaque url() pointe vers une police auto-hébergée qui existe dans public/fonts', () => {
    const urls = [...SITE_CSS.matchAll(/url\(\s*['"]?([^'")]+)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url, url).toMatch(/^\/fonts\/[a-z0-9-]+\.woff2$/);
      expect(existsSync(join('public', url)), url).toBe(true);
    }
  });
});

describe('SITE_CSS — polices', () => {
  const faces = [...SITE_CSS.matchAll(/@font-face\{([^}]*)\}/g)].map((m) => m[1]);

  it('déclare Bricolage Grotesque et Atkinson Hyperlegible Next, en font-display:swap', () => {
    const families = faces.map((f) => f.match(/font-family:"([^"]+)"/)[1]).sort();
    expect(families).toEqual(['Atkinson Hyperlegible Next', 'Bricolage Grotesque']);
    for (const face of faces) expect(face).toContain('font-display:swap');
  });

  it('garde une pile de repli système derrière chaque famille', () => {
    expect(SITE_CSS).toMatch(/--display:"Bricolage Grotesque",[^;]*sans-serif/);
    expect(SITE_CSS).toMatch(/--text:"Atkinson Hyperlegible Next",[^;]*sans-serif/);
    expect(SITE_CSS).toMatch(/--mono:ui-monospace,[^;]*monospace/);
  });
});

describe('SITE_CSS — tokens', () => {
  it('émet chaque token du thème clair sur :root', () => {
    const root = RULES.find((r) => r.selectors === ':root' && r.decl.includes('--bg:'));
    for (const [key, hex] of Object.entries(TOKENS.light)) expect(root.decl).toContain(`--${key}:${hex}`);
  });

  it('émet chaque token du thème sombre deux fois : préférence système et choix explicite', () => {
    const system = SITE_CSS.match(/@media \(prefers-color-scheme:dark\)\{:root:not\(\[data-theme="light"\]\)\{([^}]*)\}/);
    const explicit = SITE_CSS.match(/:root\[data-theme="dark"\]\{([^}]*)\}/);
    expect(system).not.toBeNull();
    expect(explicit).not.toBeNull();
    for (const [key, hex] of Object.entries(TOKENS.dark)) {
      expect(system[1]).toContain(`--${key}:${hex}`);
      expect(explicit[1]).toContain(`--${key}:${hex}`);
    }
  });

  it("n'écrit aucune couleur en dur hors des tokens", () => {
    // Toute couleur passe par une variable : c'est ce qui rend le test de
    // contraste exhaustif. Les seules valeurs hexadécimales de la feuille sont
    // donc celles des trois blocs de tokens.
    const allowed = new Set([...Object.values(TOKENS.light), ...Object.values(TOKENS.dark)]);
    const found = [...SITE_CSS.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
    expect(found.filter((hex) => !allowed.has(hex))).toEqual([]);
  });

  it("émet l'échelle d'espacement s1 à s9", () => {
    expect(Object.keys(SPACE)).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9']);
    for (const [key, value] of Object.entries(SPACE)) expect(SITE_CSS).toContain(`--${key}:${value}`);
  });
});

describe('SITE_CSS — invariants D9', () => {
  it('le focus est toujours visible, avec le token dédié', () => {
    const focus = RULES.find((r) => r.selectors === ':focus-visible');
    expect(focus?.decl).toMatch(/outline:3px solid var\(--focus\)/);
  });

  it("un verdict n'est jamais porté par la couleur seule : chaque verdict a sa forme", () => {
    // Badges (grille, fiche), pastilles de filtre, panneau de verdict, fit des
    // alternatives : la forme ● ◐ ○ est posée par la feuille, et aucune règle
    // ne donne une couleur propre à un verdict.
    for (const [hook, shapes] of [
      ['.badge.yes', '●'], ['.badge.kinda', '◐'], ['.badge.no', '○'],
      ['.fit-tag[data-fit="full"]', '●'], ['.fit-tag[data-fit="partial"]', '◐'], ['.fit-tag[data-fit="niche"]', '○'],
      ['.verdict-badge[data-verdict="yes"]', '●'], ['.verdict-badge[data-verdict="kinda"]', '◐'],
      ['.verdict-badge[data-verdict="no"]', '○'],
    ]) {
      const rule = RULES.find((r) => r.selectors.split(',').some((s) => s.trim().startsWith(hook) && s.includes('::before')));
      expect(rule, hook).toBeDefined();
      expect(rule.decl, hook).toContain(`content:"${shapes}"`);
    }
    const verdictColour = RULES.filter((r) => /(\.(yes|kinda|no)\b|data-(verdict|fit)=)/.test(r.selectors)
      && /(^|;)\s*(color|background(-color)?)\s*:/.test(r.decl));
    expect(verdictColour.map((r) => r.selectors)).toEqual([]);
  });

  it('toute animation est coupée en mouvement réduit', () => {
    const names = [...SITE_CSS.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
    // Une seule chose bouge : le bandeau sponsor du bas, emplacement vendu
    // comme « défilant » (obligation contractuelle).
    expect(names).toEqual(['sp-tape-scroll']);
    const reduced = SITE_CSS.slice(SITE_CSS.indexOf('@media (prefers-reduced-motion:reduce)'));
    expect(reduced).toMatch(/\.sp-tape-track\{[^}]*animation:none/);
  });

  it('les transitions ne vivent que hors mouvement réduit', () => {
    // Un seul bloc les déclare ; retiré, il ne reste aucune transition.
    const block = SITE_CSS.match(/@media \(prefers-reduced-motion:no-preference\)\{(?:[^{}]*\{[^{}]*\})*\}/);
    expect(block).not.toBeNull();
    expect(block[0]).toContain('transition:');
    expect(SITE_CSS.replace(block[0], '')).not.toContain('transition');
  });

  it('déclare les composants que les tâches A4 à A7 consomment', () => {
    for (const cls of ['.page-head', '.verdict-badge', '.fact-grid', '.alt-table', '.table-scroll',
      '.alt-card', '.fit-tag', '.prompt-block', '.faq', '.link-cloud', '.crumbs']) {
      expect(RULES.some((r) => r.selectors.split(',').some((s) => s.trim().startsWith(cls))), cls).toBe(true);
    }
  });

  it('hidden l’emporte toujours : un contrôle masqué sans JavaScript ne réapparaît pas par un display', () => {
    expect(RULES.find((r) => r.selectors === '[hidden]')?.decl).toBe('display:none!important');
  });

  it('le tableau défile dans son cadre, jamais la page', () => {
    expect(SITE_CSS).toMatch(/\.table-scroll\{[^}]*overflow-x:auto/);
  });
});

// Recette A8 : à 320 px, le <canvas> de /stats garde sa largeur par défaut
// (300 px) dans une boîte de 238 px tant que Chart.js ne l'a pas
// redimensionné, et pour toujours sans JavaScript : la page défilait de
// 21 px en largeur. Un canvas ne dépasse jamais son conteneur.
describe('SITE_CSS — aucun média plus large que son conteneur', () => {
  it('img et canvas sont plafonnés à 100 %', () => {
    expect(SITE_CSS).toMatch(/(^|\})img,canvas\{max-width:100%/m);
  });
});
