import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  RAIL_SLOTS, TAPE_TOP_SLOTS, TAPE_BOTTOM_SLOTS,
  RAIL_LADDER_USD, TAPE_LADDER_USD,
} from '../scripts/lib/site-sponsors.mjs';

// Le Worker ne doit jamais porter sa propre copie des barèmes : un prix qui
// dérive entre le site et l'encaissement, c'est un acheteur facturé autrement
// que ce qu'on lui a annoncé. Ce test vérifie que le fichier généré dit
// exactement la même chose que la source.
describe('inventaire généré pour le worker', () => {
  const src = readFileSync('worker/src/sponsor-inventory.generated.mjs', 'utf8');

  it('porte l’avertissement de non-édition', () => {
    expect(src).toContain('ne pas modifier à la main');
  });

  it('reproduit exactement les slots et les barèmes de la source', async () => {
    const gen = await import('../worker/src/sponsor-inventory.generated.mjs');
    expect(gen.RAIL_SLOTS).toEqual(RAIL_SLOTS);
    expect(gen.TAPE_TOP_SLOTS).toEqual(TAPE_TOP_SLOTS);
    expect(gen.TAPE_BOTTOM_SLOTS).toEqual(TAPE_BOTTOM_SLOTS);
    expect(gen.RAIL_LADDER_USD).toEqual(RAIL_LADDER_USD);
    expect(gen.TAPE_LADDER_USD).toEqual(TAPE_LADDER_USD);
  });

  it('expose les 28 slots dans ALL_SLOTS, sans doublon', async () => {
    const { ALL_SLOTS } = await import('../worker/src/sponsor-inventory.generated.mjs');
    expect(ALL_SLOTS).toHaveLength(28);
    expect(new Set(ALL_SLOTS).size).toBe(28);
  });
});
