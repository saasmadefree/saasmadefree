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
});
