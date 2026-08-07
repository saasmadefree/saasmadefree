import { describe, it, expect } from 'vitest';
import { kindOf, ladderIndexFor, priceCentsFor } from '../src/sponsors.mjs';

const none = { rail: 0, top: 0, bottom: 0 };

// Les routes de la tâche 4 traduisent ces trois échecs en statuts HTTP
// différents (400 pour un slot inconnu ou une durée non vendue, 409 pour un
// inventaire plein). Filtrer sur le texte du message serait fragile — il est
// en français et destiné à un humain, une reformulation casserait le routage.
// On assert donc le code machine, jamais le message.
function thrownCode(fn) {
  try {
    fn();
  } catch (err) {
    return err.code;
  }
  return null; // rien levé : le test doit échouer, pas passer par défaut
}

describe('kindOf', () => {
  it('classe les rails et les deux bandeaux', () => {
    expect(kindOf('L1')).toBe('rail');
    expect(kindOf('R4')).toBe('rail');
    expect(kindOf('T01')).toBe('tape');
    expect(kindOf('B10')).toBe('tape');
  });

  it('rend null sur un slot inconnu — jamais un repli silencieux', () => {
    expect(kindOf('L9')).toBe(null);
    expect(kindOf('')).toBe(null);
  });
});

describe('priceCentsFor', () => {
  it('part du bas de chaque barème quand rien n’est vendu', () => {
    expect(priceCentsFor('L1', 1, none)).toBe(14900);
    expect(priceCentsFor('T01', 1, none)).toBe(7500);
  });

  it('compte les rails ensemble et les deux bandeaux séparément', () => {
    expect(priceCentsFor('R1', 1, { rail: 3, top: 0, bottom: 0 })).toBe(42900);
    expect(priceCentsFor('T05', 1, { rail: 0, top: 5, bottom: 0 })).toBe(29900);
    expect(priceCentsFor('B05', 1, { rail: 0, top: 5, bottom: 0 })).toBe(7500);
  });

  it('facture trois mois au triple du prix du jour, sans remise', () => {
    expect(priceCentsFor('L1', 3, none)).toBe(44700);
  });

  it('refuse une durée non vendue, avec le code unsold_duration', () => {
    expect(thrownCode(() => priceCentsFor('L1', 2, none))).toBe('unsold_duration');
    expect(thrownCode(() => priceCentsFor('L1', 0, none))).toBe('unsold_duration');
  });

  it('refuse un inventaire plein plutôt que d’inventer un prix, avec le code inventory_full', () => {
    expect(thrownCode(() => priceCentsFor('L1', 1, { rail: 8, top: 0, bottom: 0 })))
      .toBe('inventory_full');
  });

  it('refuse un slot inconnu avec le code unknown_slot', () => {
    expect(thrownCode(() => priceCentsFor('L9', 1, none))).toBe('unknown_slot');
    expect(thrownCode(() => ladderIndexFor('L9', none))).toBe('unknown_slot');
  });

  it('garde des messages en français, lisibles par un humain', () => {
    try {
      priceCentsFor('L9', 1, none);
      throw new Error('aurait dû lever');
    } catch (err) {
      expect(err.message).toContain('slot inconnu');
    }
  });
});
