import { describe, it, expect } from 'vitest';
import { SITE_CSS, TOKENS } from '../scripts/lib/site-styles.mjs';

// Garde-fous du spec 2026-08-04 (refonte « Le Dossier instruit »), amendés par
// l'addendum 2026-08-11 : budget recalé à 60 Ko (le dossier paie sa matière +
// les sections sponsors/stats conservées), et le bandeau sponsor — obligation
// contractuelle, déjà couvert par prefers-reduced-motion — reste la seule
// chose qui bouge dans un monde par ailleurs imprimé.
describe('SITE_CSS — garde-fous du spec', () => {
  it("la case de verdict active garde l'encre : .chip.is-active pose color:paper à spécificité égale", () => {
    const rule = SITE_CSS.match(/\.verdict-chip\.is-active\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule[0]).toContain('color:var(--ink)');
  });

  it('≤ 60 Ko non minifié', () => {
    expect(Buffer.byteLength(SITE_CSS, 'utf8')).toBeLessThanOrEqual(61440);
  });

  it('trois animations, nommées : bandeau sponsor, titre à trou, badges d’économie', () => {
    // Le monde imprimé du dossier ne bougeait pas ; « Le Verdict » s'autorise
    // exactement trois mouvements, et pas un de plus : la piste sponsor
    // (obligation contractuelle), le nom qui défile dans le titre, et les
    // badges d'économie qui s'envolent. Les trois sont coupés par
    // prefers-reduced-motion. Aucune transition, toujours :
    // une transition se déclenche sur un état, donc partout, sans être nommée.
    expect(SITE_CSS).not.toMatch(/transition\s*:/);
    const names = [...SITE_CSS.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
    expect(names.sort()).toEqual(['hero-fly', 'hero-rot', 'sp-tape-scroll']);
    for (const m of SITE_CSS.matchAll(/animation\s*:\s*([^;}]+)/g)) {
      const value = m[1].trim();
      if (value === 'none') continue;
      expect(names.some((n) => value.includes(n))).toBe(true);
    }
  });

  it('aucun backdrop-filter, aucun ambre banni, aucune requête externe', () => {
    expect(SITE_CSS).not.toContain('backdrop-filter');
    expect(SITE_CSS).not.toContain('#7d5200');
    expect(SITE_CSS).not.toMatch(/url\(\s*['"]?https?:/);
  });

  it('aucun dégradé : le monde du Verdict est plat', () => {
    // Le garde-fou est retourné le 19.08.2026, avec la direction. « Le Dossier
    // instruit » EXIGEAIT de la trame (kraft du bureau, réglure des feuillets,
    // code-barres) et interdisait seulement les dégradés décoratifs. « Le
    // Verdict » ne peint que des aplats : un dégradé, quel qu'il soit, y est
    // forcément décoratif. Zéro est donc la seule valeur juste.
    const grads = SITE_CSS.match(/[a-z-]*gradient\(/g) ?? [];
    expect(grads).toEqual([]);
  });

  it("sur l'aplat de verdict, le mot du verdict prend l'encre de l'aplat", () => {
    // .badge.kinda est ocre. Posé sur .folder-kinda, lui aussi ocre, le mot
    // « Presque » disparaissait purement et simplement — constaté en recette
    // le 19.08.2026. Sur l'aplat, c'est le fond qui porte la couleur du
    // verdict et le mot qui porte l'encre : l'inverse du reste du site.
    // On lit la liste de sélecteurs, pas la chaîne brute : `.folder .badge`
    // vit au milieu d'un groupe, et un test qui l'exigeait juste avant
    // l'accolade cassait au premier regroupement de règles.
    const rules = [...SITE_CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)];
    const carriesOnStamp = rules.some(([, selectors, decl]) =>
      selectors.split(',').some((sel) => sel.trim() === '.folder .badge')
      && decl.includes('color:var(--on-stamp)'));
    expect(carriesOnStamp, '.folder .badge doit prendre color:var(--on-stamp)').toBe(true);
  });

  it("aucune opacité sur du texte posé sur un aplat de verdict", () => {
    // Une opacité empilée sur --on-stamp fait tomber le texte sous 4,5:1, et
    // site-contrast.test.mjs ne peut pas le voir : il ne connaît que les
    // tokens, pas ce que la feuille en fait. La hiérarchie sur l'aplat passe
    // donc par le corps et la graisse, qui ne coûtent aucun contraste.
    const offenders = [...SITE_CSS.matchAll(/\.folder[^{}]*\{([^}]*)\}/g)]
      .filter((m) => /opacity:\s*0?\.\d+/.test(m[1]))
      .map((m) => m[0].slice(0, 100));
    expect(offenders).toEqual([]);
  });

  it('chaque token des deux thèmes est émis en custom property', () => {
    for (const theme of Object.values(TOKENS)) {
      for (const hex of Object.values(theme)) expect(SITE_CSS).toContain(hex);
    }
  });
});
