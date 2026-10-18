import { describe, it, expect } from 'vitest';
import { TOKENS } from '../scripts/lib/site-styles.mjs';

// Système de design « La table de cuisine, aérée » (docs/superpowers/specs/
// 2026-10-17-design-system.md, §1). Chaque paire encre/fond réellement posée
// par la feuille est vérifiée ici, dans les deux thèmes : WCAG 2.2 AA, 4,5:1
// pour le texte (1.4.3), 3:1 pour les bordures de contrôle et l'anneau de
// focus (1.4.11). `rule` n'est jamais vérifié : il ne sert qu'aux filets
// décoratifs, jamais à la seule limite d'un contrôle.

function luminance(hex) {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

// Texte : les trois encres sur les trois surfaces où elles se posent.
const TEXT_INKS = ['ink', 'ink2', 'tomato'];
const SURFACES = ['bg', 'panel', 'card'];
// Paires dédiées : un fond qui n'accueille qu'une encre précise.
const TEXT_PAIRS = [
  ['btnInk', 'btn'], // le bouton principal (Copier le prompt)
  ['bg', 'ink'], // la pastille de filtre active, inversée
  ['signInk', 'mustard'], // le panneau de verdict
  ['signInk2', 'mustard'], // sa ligne secondaire (date, source)
];
// Composants d'interface (1.4.11) : bordures de champ, de pastille, focus.
const UI_PAIRS = [
  ['field', 'bg'], ['field', 'card'], ['field', 'panel'],
  ['ink2', 'bg'], ['ink2', 'card'],
  ['focus', 'bg'], ['focus', 'panel'], ['focus', 'card'],
  ['signInk', 'mustard'], // l'anneau de focus dans le panneau prend signInk
];

for (const theme of ['light', 'dark']) {
  describe(`contraste AA — thème ${theme}`, () => {
    const t = TOKENS[theme];

    for (const ink of TEXT_INKS) {
      for (const surface of SURFACES) {
        it(`${ink} sur ${surface} ≥ 4.5`, () => {
          expect(ratio(t[ink], t[surface])).toBeGreaterThanOrEqual(4.5);
        });
      }
    }

    for (const [fg, bg] of TEXT_PAIRS) {
      it(`${fg} sur ${bg} ≥ 4.5`, () => {
        expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
      });
    }

    for (const [fg, bg] of UI_PAIRS) {
      it(`${fg} sur ${bg} ≥ 3 (composant d'interface)`, () => {
        expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(3);
      });
    }

    it('chaque token est une couleur hexadécimale à six chiffres', () => {
      for (const [key, hex] of Object.entries(t)) expect(hex, key).toMatch(/^#[0-9a-f]{6}$/);
    });
  });
}

it('les deux thèmes déclarent exactement les mêmes tokens', () => {
  expect(Object.keys(TOKENS.dark).sort()).toEqual(Object.keys(TOKENS.light).sort());
});
