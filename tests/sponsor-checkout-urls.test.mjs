import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadData } from '../scripts/lib/load-data.mjs';
import { siteLanguages } from '../scripts/lib/site-data.mjs';
import { checkoutUrls, SITE_LANGS, DEFAULT_LANG } from '../worker/src/sponsors.mjs';

// Après paiement, Stripe renvoie l'acheteur sur `success_url`. Si cette URL ne
// correspond à aucune page réellement produite par le build, l'acheteur voit
// une 404 juste après avoir été débité — ce qui se lit comme un paiement
// échoué. Le Worker et le générateur de site sont deux programmes séparés :
// rien d'autre que ce test ne les oblige à s'accorder sur la forme de l'URL.
//
// Le site est entièrement préfixé par langue : `build-site.mjs` écrit
// `dist/<lang>/sponsor/index.html` et publie le chemin canonique
// `/<lang>/sponsor`. Il n'existe aucune page `/sponsor` à la racine.
const ORIGIN = 'https://saasmadefree.com';

const { tools } = await loadData(process.cwd());
const published = siteLanguages(tools);

describe('URLs de retour du checkout sponsor', () => {
  it('couvre exactement les langues que le build publie — ni plus, ni moins', () => {
    // `LANGS` énumère les langues POSSIBLES ; le site ne publie que celles qui
    // ont du contenu. Lister ici une langue non publiée renverrait l'acheteur
    // sur une 404 ; en oublier une le renverrait inutilement sur l'anglais.
    // Quand une langue s'ajoute au catalogue, ce test rougit — et c'est tout
    // ce qui empêche SITE_LANGS de dériver en silence.
    expect(
      [...SITE_LANGS].sort(),
      'SITE_LANGS (worker/src/sponsors.mjs) ne correspond plus aux langues publiées par le build'
    ).toEqual([...published].sort());
    expect(published).toContain(DEFAULT_LANG);
  });

  for (const lang of published) {
    it(`pointe vers /${lang}/sponsor, le chemin que le build publie`, () => {
      const { successUrl, cancelUrl } = checkoutUrls(ORIGIN, lang);
      expect(successUrl).toBe(`${ORIGIN}/${lang}/sponsor?paid=1`);
      expect(cancelUrl).toBe(`${ORIGIN}/${lang}/sponsor`);
    });
  }

  it('retombe sur la langue par défaut plutôt que de fabriquer une URL morte', () => {
    // Y compris pour une langue du dépôt qui n'est pas encore publiée.
    for (const lang of [undefined, null, '', 'xx', 'es', 'EN', '../../evil', 'https://evil.example', 42]) {
      expect(checkoutUrls(ORIGIN, lang).cancelUrl).toBe(`${ORIGIN}/${DEFAULT_LANG}/sponsor`);
    }
  });

  it("n'ajoute jamais de segment hors du site", () => {
    for (const lang of published) {
      const url = new URL(checkoutUrls(ORIGIN, lang).successUrl);
      expect(url.origin).toBe(ORIGIN);
      expect(url.pathname).toBe(`/${lang}/sponsor`);
    }
  });

  // Vérification de bout en bout quand le site a été construit : le fichier
  // servi à cette URL existe pour de bon. Ignorée avant le premier build
  // plutôt que rouge — `npm run build` vient après `vitest` dans le gate.
  it.skipIf(!existsSync('dist'))('chaque URL de retour correspond à une page présente dans dist/', () => {
    for (const lang of published) {
      const { pathname } = new URL(checkoutUrls(ORIGIN, lang).successUrl);
      const file = join('dist', ...pathname.split('/').filter(Boolean), 'index.html');
      expect(existsSync(file), `page manquante pour ${pathname} : ${file}`).toBe(true);
    }
  });
});
