import { describe, it, expect } from 'vitest';
import { SITE_CSS, TOKENS } from '../scripts/lib/site-styles.mjs';

// Garde-fous du spec 2026-08-04 (refonte « Le Dossier instruit »), amendés par
// l'addendum 2026-08-11 : budget recalé à 60 Ko (le dossier paie sa matière +
// les sections sponsors/stats conservées), et le bandeau sponsor — obligation
// contractuelle, déjà couvert par prefers-reduced-motion — reste la seule
// chose qui bouge dans un monde par ailleurs imprimé.
describe('SITE_CSS — garde-fous du spec', () => {
  it('≤ 60 Ko non minifié', () => {
    expect(Buffer.byteLength(SITE_CSS, 'utf8')).toBeLessThanOrEqual(61440);
  });

  it('les seules animations sont celles du bandeau sponsor, aucune transition', () => {
    expect(SITE_CSS).not.toMatch(/transition\s*:/);
    const names = [...SITE_CSS.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => /tape/.test(n))).toBe(true);
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

  it('les gradients sont tous des repeating-linear-gradient de trame', () => {
    const grads = SITE_CSS.match(/[a-z-]*gradient\(/g) ?? [];
    // Le kraft tramé du fond de page est constitutif de la direction : zéro
    // trame serait aussi faux qu'un dégradé décoratif.
    expect(grads.length).toBeGreaterThan(0);
    expect(grads.every((g) => g === 'repeating-linear-gradient(')).toBe(true);
  });

  it('chaque token des deux thèmes est émis en custom property', () => {
    for (const theme of Object.values(TOKENS)) {
      for (const hex of Object.values(theme)) expect(SITE_CSS).toContain(hex);
    }
  });
});
