import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileValidators, loadData } from '../scripts/lib/load-data.mjs';
import { validateAll } from '../scripts/lib/validate-rules.mjs';

const validators = compileValidators('schema');

// Jeu de données minimal. `validateAll` valide plusieurs domaines à la fois
// (outils, i18n, agents, stats, sponsors) ; ces tests n'observent que les
// erreurs sponsors, d'où le filtre `sponsorErrors` plus bas. Sans lui, ils
// échoueraient dès qu'une règle sans rapport est ajoutée ailleurs — et pire,
// pourraient passer pour la mauvaise raison en trouvant leur sous-chaîne dans
// le message d'une autre règle.
//
// La fiche factice n'est pas décorative : `publishedLangs` se déduit des
// `markets` des fiches, donc sans elle aucune langue ne compterait comme
// publiée et la règle « tagline manquante » ne se déclencherait jamais.
const FAKE_TOOLS = new Map([['x', { slug: 'x', markets: ['en', 'fr'] }]]);

function baseData(sponsors) {
  return {
    tools: FAKE_TOOLS, i18n: new Map(), agents: [],
    ui: new Map([['en', { site: {} }], ['fr', { site: {} }]]),
    sponsors,
  };
}

function data(placements) {
  return baseData({ placements });
}

// Variante pour les tests de racine malformée : contrôle direct du contenu
// de `sponsors`, sans passer par la forme `{ placements }` que `data()` impose.
function dataWithSponsorsRoot(sponsorsRoot) {
  return baseData(sponsorsRoot);
}

/** Les seules erreurs que ces tests jugent : celles qui nomment data/sponsors.json. */
function sponsorErrors(dataset) {
  return validateAll(dataset, validators, today).filter((e) => e.includes('sponsors.json'));
}

const OK = {
  slot: 'L1', name: 'Postiz', domain: 'postiz.com', url: 'https://postiz.com/',
  tagline: { en: 'Schedule your posts', fr: 'Programme tes posts' },
  startsOn: '2026-08-05', endsOn: '2026-09-04',
};

const today = '2026-08-10';

describe('schéma sponsors', () => {
  it('accepte un placement complet', () => {
    expect(validators.sponsors({ placements: [OK] })).toBe(true);
  });

  it('rejette un identifiant de slot inconnu', () => {
    expect(validators.sponsors({ placements: [{ ...OK, slot: 'L9' }] })).toBe(false);
  });

  it('rejette une URL non https', () => {
    expect(validators.sponsors({ placements: [{ ...OK, url: 'http://postiz.com/' }] })).toBe(false);
  });

  it('rejette un domaine sans point — collision possible avec un slug d\'outil, même charset', () => {
    // "notion" est à la fois un hostname valide (format: "hostname" ne
    // requiert pas de point) et un slug de fiche existant : sans cette
    // contrainte, un sponsor mal saisi écraserait silencieusement l'icône
    // de la fiche sur le disque (les deux boucles de fetchFavicons écrivent
    // dans le même outDir). Un vrai domaine de sponsor a toujours un point ;
    // un slug ne peut jamais en contenir (pattern ^[a-z0-9][a-z0-9-]{0,63}$).
    expect(validators.sponsors({ placements: [{ ...OK, domain: 'notion' }] })).toBe(false);
  });

  // La borne haute de la tagline est ce qui garantit que la carte de rail ne
  // casse pas en allemand (spec §5) : au-delà, le texte déborde de la piste
  // de 9rem. Elle n'était vérifiée par aucun test — donc rien n'empêchait de
  // la relever « juste un peu » en croyant que c'était un chiffre arbitraire.
  const tagline = (n) => ({ en: 'a'.repeat(n), fr: 'b'.repeat(n) });

  it('accepte une tagline de 80 caractères, refuse 81', () => {
    expect(validators.sponsors({ placements: [{ ...OK, tagline: tagline(80) }] })).toBe(true);
    expect(validators.sponsors({ placements: [{ ...OK, tagline: tagline(81) }] })).toBe(false);
  });

  it('refuse une tagline vide — un slot payé sans texte n’est pas un slot rendu', () => {
    expect(validators.sponsors({ placements: [{ ...OK, tagline: { en: '', fr: 'ok' } }] })).toBe(false);
  });

  // Borne citée par le commentaire de .sp-card dans site-styles.mjs : c'est
  // elle qui fixe le pire cas de mot unique que la carte doit savoir couper.
  it('accepte un nom de 32 caractères, refuse 33', () => {
    expect(validators.sponsors({ placements: [{ ...OK, name: 'W'.repeat(32) }] })).toBe(true);
    expect(validators.sponsors({ placements: [{ ...OK, name: 'W'.repeat(33) }] })).toBe(false);
  });
});

describe('règles sponsors', () => {
  it('ne signale rien pour un placement valide', () => {
    expect(sponsorErrors(data([OK]))).toEqual([]);
  });

  it('refuse deux placements actifs sur le même slot', () => {
    const errors = sponsorErrors(data([OK, { ...OK, name: 'Autre', domain: 'autre.com' }]));
    expect(errors.join('\n')).toContain('slot "L1"');
  });

  it('accepte deux placements sur le même slot si leurs périodes ne se croisent pas', () => {
    const passe = { ...OK, startsOn: '2026-06-01', endsOn: '2026-06-30' };
    expect(sponsorErrors(data([OK, passe]))).toEqual([]);
  });

  it('refuse endsOn antérieur à startsOn', () => {
    const errors = sponsorErrors(data([{ ...OK, endsOn: '2026-08-01' }]));
    expect(errors.join('\n')).toContain('endsOn');
  });

  it('refuse une tagline manquante dans une langue publiée', () => {
    const errors = sponsorErrors(data([{ ...OK, tagline: { en: 'Only english' } }]));
    expect(errors.join('\n')).toContain('fr');
  });

  // Spec §5 : un placement expiré ne fait JAMAIS échouer le build. Il est
  // filtré au rendu et son slot repasse en libre. Un site qui casse tout seul
  // un dimanche parce qu'un sponsoring est arrivé à échéance serait un défaut,
  // pas une sécurité. L'avertissement, lui, dit à l'exploitant qu'un slot
  // vient de se libérer.
  describe('placement expiré', () => {
    const expired = { ...OK, startsOn: '2026-06-01', endsOn: '2026-06-30' };

    it('n’est pas une erreur', () => {
      expect(sponsorErrors(data([expired]))).toEqual([]);
    });

    it('émet un avertissement nommant le slot et la date d’échéance', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        sponsorErrors(data([expired]));
        const said = warn.mock.calls.map((args) => args.join(' ')).join('\n');
        expect(said).toContain('L1');
        expect(said).toContain('2026-06-30');
        expect(said.toLowerCase()).toContain('avertissement');
      } finally {
        warn.mockRestore();
      }
    });

    it('ne dit rien pour un placement encore en cours ou à venir', () => {
      const future = { ...OK, startsOn: '2026-09-01', endsOn: '2026-09-30' };
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        validateAll(data([OK, future]), validators, today);
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });
  });

  it('considère deux périodes qui se touchent comme un chevauchement (bornes incluses)', () => {
    // Le endsOn de OK et le startsOn du voisin tombent sur le même jour :
    // c'est un chevauchement, pas une passation propre. Verrouille la
    // sémantique inclusive de periodsOverlap contre une future régression
    // silencieuse (ex. un `<=` remplacé par `<` sans test pour le voir).
    const adjacent = { ...OK, startsOn: OK.endsOn, endsOn: '2026-10-04' };
    const errors = sponsorErrors(data([OK, adjacent]));
    expect(errors.join('\n')).toContain('slot "L1"');
  });
});

// Dépôt minimal : loadData() lit aussi agents.json et categories.json, qui
// n'ont pas de repli ENOENT. Les dossiers tools/ et i18n/ absents donnent déjà
// des listes vides.
async function fixture(sponsorsJson) {
  const root = await mkdtemp(join(tmpdir(), 'smf-loaddata-'));
  await mkdir(join(root, 'data'), { recursive: true });
  await writeFile(join(root, 'data', 'agents.json'), '[]', 'utf8');
  await writeFile(join(root, 'data', 'categories.json'), '[]', 'utf8');
  if (sponsorsJson !== undefined) {
    await writeFile(join(root, 'data', 'sponsors.json'), sponsorsJson, 'utf8');
  }
  return root;
}

// `npm run validate` attrape une racine malformée, mais `npm run build` ne
// lance pas la validation — et le hook de déploiement quotidien prévu pour la
// phase commerce ne passera pas par la CI. Un `placements ?? []` en aval
// transformait donc une erreur de données en silence : le build se terminait
// normalement et publiait tous les emplacements comme libres, alors qu'un
// sponsor a payé.
describe('loadData — racine sponsors.json', () => {
  it('échoue bruyamment sur une clé "placement" au singulier', async () => {
    const root = await fixture(JSON.stringify({ placement: [OK] }));
    await expect(loadData(root)).rejects.toThrow(/data\/sponsors\.json.*placements/s);
  });

  it('nomme les clés réellement lues, pour rendre la faute de frappe évidente', async () => {
    const root = await fixture(JSON.stringify({ placement: [OK] }));
    await expect(loadData(root)).rejects.toThrow(/"placement"/);
  });

  it('échoue aussi quand "placements" n’est pas un tableau', async () => {
    const root = await fixture(JSON.stringify({ placements: { L1: OK } }));
    await expect(loadData(root)).rejects.toThrow(/tableau/);
  });

  it('accepte toujours un dépôt sans data/sponsors.json — le fichier reste optionnel', async () => {
    const root = await fixture(undefined);
    await expect(loadData(root)).resolves.toMatchObject({ sponsors: { placements: [] } });
  });

  it('accepte un fichier vide et bien formé', async () => {
    const root = await fixture(JSON.stringify({ placements: [] }));
    const data = await loadData(root);
    expect(data.sponsors.placements).toEqual([]);
  });
});

describe('racine sponsors malformée', () => {
  it('refuse une clé "placement" au singulier à la racine (faute de frappe)', () => {
    const errors = sponsorErrors(dataWithSponsorsRoot({ placement: [OK] }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('refuse un champ parasite à la racine de sponsors.json', () => {
    const errors = sponsorErrors(dataWithSponsorsRoot({ placements: [], extraStrayField: 42 }));
    expect(errors.length).toBeGreaterThan(0);
  });
});
