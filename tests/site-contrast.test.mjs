import { describe, it, expect } from 'vitest';
import { TOKENS } from '../scripts/lib/site-styles.mjs';

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

// Paires du spec §7 : chaque encre porteuse d'information sur chaque papier où
// elle se pose. La trame et les tons de pile sont décoratifs, pas listés.
const INKS = ['ink', 'ink2', 'pen', 'stampYes', 'stampKinda', 'stampNo', 'stampDate'];
const PAPERS = ['paperDesk', 'paperFolder', 'paperSheet', 'paperBright', 'paperCartouche', 'hl'];

for (const theme of ['light', 'dark']) {
  describe(`contraste AA — thème ${theme}`, () => {
    for (const ink of INKS) {
      for (const paper of PAPERS) {
        it(`${ink} sur ${paper} ≥ 4.5`, () => {
          const t = TOKENS[theme];
          expect(ratio(t[ink], t[paper])).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
    // Garde-fou d'effondrement de palette : les trois encres ne doivent pas
    // converger vers des couleurs voisines quand on ajuste le thème sombre.
    // Distance RGB euclidienne, PAS un ratio de luminance — vert et rouge
    // peuvent être distincts à luminance identique (la paire la plus serrée
    // du clair normatif, ambre/rouge, est à ≈63). La discrimination pour les
    // lecteurs daltoniens n'est pas portée par ce test : elle est garantie
    // par les libellés (le verdict n'est jamais la couleur seule, spec §7).
    it('les trois encres de verdict ne s’effondrent pas l’une sur l’autre (ΔRGB ≥ 50)', () => {
      const t = TOKENS[theme];
      const rgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(1).slice(i, i + 2), 16));
      const dist = (a, b) => Math.hypot(...rgb(t[a]).map((v, i) => v - rgb(t[b])[i]));
      for (const [a, b] of [['stampYes', 'stampKinda'], ['stampYes', 'stampNo'], ['stampKinda', 'stampNo']]) {
        expect(dist(a, b)).toBeGreaterThanOrEqual(50);
      }
    });
  });
}
