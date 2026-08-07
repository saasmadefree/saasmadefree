import { describe, it, expect } from 'vitest';
import { kindOf, ladderIndexFor, priceCentsFor } from '../src/sponsors.mjs';

const none = { rail: 0, top: 0, bottom: 0 };

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

  it('refuse une durée non vendue', () => {
    expect(() => priceCentsFor('L1', 2, none)).toThrow();
    expect(() => priceCentsFor('L1', 0, none)).toThrow();
  });

  it('refuse un inventaire plein plutôt que d’inventer un prix', () => {
    expect(() => priceCentsFor('L1', 1, { rail: 8, top: 0, bottom: 0 })).toThrow();
  });
});
