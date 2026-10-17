import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
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
