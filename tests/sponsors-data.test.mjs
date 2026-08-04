import { describe, it, expect } from 'vitest';
import { compileValidators } from '../scripts/lib/load-data.mjs';
import { validateAll } from '../scripts/lib/validate-rules.mjs';

const validators = compileValidators('schema');

// Jeu de données minimal : validateAll parcourt aussi outils, i18n et agents,
// qu'on laisse vides pour n'observer que les erreurs sponsors.
function data(placements) {
  return {
    tools: new Map(), i18n: new Map(), agents: [],
    ui: new Map([['en', { site: {} }], ['fr', { site: {} }]]),
    sponsors: { placements },
  };
}

// Variante pour les tests de racine malformée : contrôle direct du contenu
// de `sponsors`, sans passer par la forme `{ placements }` que `data()` impose.
function dataWithSponsorsRoot(sponsorsRoot) {
  return {
    tools: new Map(), i18n: new Map(), agents: [],
    ui: new Map([['en', { site: {} }], ['fr', { site: {} }]]),
    sponsors: sponsorsRoot,
  };
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
});

describe('règles sponsors', () => {
  it('ne signale rien pour un placement valide', () => {
    expect(validateAll(data([OK]), validators, today)).toEqual([]);
  });

  it('refuse deux placements actifs sur le même slot', () => {
    const errors = validateAll(data([OK, { ...OK, name: 'Autre', domain: 'autre.com' }]), validators, today);
    expect(errors.join('\n')).toContain('slot "L1"');
  });

  it('accepte deux placements sur le même slot si leurs périodes ne se croisent pas', () => {
    const passe = { ...OK, startsOn: '2026-06-01', endsOn: '2026-06-30' };
    expect(validateAll(data([OK, passe]), validators, today)).toEqual([]);
  });

  it('refuse endsOn antérieur à startsOn', () => {
    const errors = validateAll(data([{ ...OK, endsOn: '2026-08-01' }]), validators, today);
    expect(errors.join('\n')).toContain('endsOn');
  });

  it('refuse une tagline manquante dans une langue publiée', () => {
    const errors = validateAll(data([{ ...OK, tagline: { en: 'Only english' } }]), validators, today);
    expect(errors.join('\n')).toContain('fr');
  });

  it('considère deux périodes qui se touchent comme un chevauchement (bornes incluses)', () => {
    // Le endsOn de OK et le startsOn du voisin tombent sur le même jour :
    // c'est un chevauchement, pas une passation propre. Verrouille la
    // sémantique inclusive de periodsOverlap contre une future régression
    // silencieuse (ex. un `<=` remplacé par `<` sans test pour le voir).
    const adjacent = { ...OK, startsOn: OK.endsOn, endsOn: '2026-10-04' };
    const errors = validateAll(data([OK, adjacent]), validators, today);
    expect(errors.join('\n')).toContain('slot "L1"');
  });
});

describe('racine sponsors malformée', () => {
  it('refuse une clé "placement" au singulier à la racine (faute de frappe)', () => {
    const errors = validateAll(dataWithSponsorsRoot({ placement: [OK] }), validators, today);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('refuse un champ parasite à la racine de sponsors.json', () => {
    const errors = validateAll(dataWithSponsorsRoot({ placements: [], extraStrayField: 42 }), validators, today);
    expect(errors.length).toBeGreaterThan(0);
  });
});
