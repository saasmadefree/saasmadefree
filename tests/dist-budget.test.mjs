import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { listFiles, MAX_DIST_FILES } from '../scripts/lib/dist-audit.mjs';

// Test-garde de la spec D12 : Cloudflare refuse un déploiement de plus de
// 20 000 fichiers en offre Free. Sauté tant qu'aucun build n'a tourné ; en
// CI, le job `data-and-code` lance `npm run build` avant `npx vitest run`.
// Le dépasser est une décision d'hébergement à prendre avec l'utilisateur,
// jamais un contournement silencieux.
describe.skipIf(!existsSync('dist'))('dist/ — nombre de fichiers (spec D12)', () => {
  it(`au plus ${MAX_DIST_FILES} fichiers`, () => {
    const count = listFiles('dist').length;
    expect(
      count,
      `dist/ contient ${count} fichiers. Limite Cloudflare 20 000 fichiers (Free) : décision d'hébergement requise, voir spec D12`,
    ).toBeLessThanOrEqual(MAX_DIST_FILES);
  });
});

// Poids de l'accueil (Task A8). La spec D14 impose TOUTES les fiches dans la
// grille de l'accueil : on ne coupe ni les cartes ni la page. Mesuré le
// 17/10/2026, 530 cartes, après le retrait des attributs qui recopiaient un
// texte visible et du JSON-LD indenté : en 519 229 o (avant : 736 135 o),
// fr 541 716 o (avant : 768 808 o). Budget = mesure + 10 %, soit environ 60
// fiches de marge (≈ 840 o par carte). Le dépasser n'autorise pas à retirer
// une carte : il faut alléger la carte, ou relever ce budget en connaissance
// de cause.
const HOME_BUDGET_BYTES = { en: 571_152, fr: 595_888 };

describe.skipIf(!existsSync('dist'))('dist/ — poids de l’accueil', () => {
  const homes = existsSync('dist')
    ? readdirSync('dist', { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join('dist', e.name, 'index.html')) && /^[a-z]{2}$/.test(e.name))
      .map((e) => e.name)
    : [];

  it('chaque accueil publié a un budget', () => {
    const missing = homes.filter((lang) => !(lang in HOME_BUDGET_BYTES));
    expect(missing, `Accueil sans budget de poids : ${missing.join(', ')} — mesurer dist/<lang>/index.html et ajouter mesure + 10 % à HOME_BUDGET_BYTES`).toEqual([]);
  });

  for (const lang of Object.keys(HOME_BUDGET_BYTES)) {
    it(`dist/${lang}/index.html tient dans ${HOME_BUDGET_BYTES[lang]} octets`, () => {
      const file = join('dist', lang, 'index.html');
      if (!existsSync(file)) return;
      const size = statSync(file).size;
      expect(
        size,
        `dist/${lang}/index.html pèse ${size} octets, au-delà du budget de ${HOME_BUDGET_BYTES[lang]} (mesure du 17/10/2026 + 10 %). `
        + 'Ne pas retirer de cartes (spec D14) : alléger le balisage de la carte (site-table.mjs) ou relever le budget en connaissance de cause.',
      ).toBeLessThanOrEqual(HOME_BUDGET_BYTES[lang]);
    });
  }
});
