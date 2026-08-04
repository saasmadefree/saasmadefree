import { describe, it, expect } from 'vitest';
import {
  RAIL_SLOTS, TAPE_TOP_SLOTS, TAPE_BOTTOM_SLOTS,
  RAIL_LADDER_USD, TAPE_LADDER_USD,
  selectSponsors, nextPriceUsd,
} from '../scripts/lib/site-sponsors.mjs';

const P = (slot, startsOn, endsOn, domain = 'postiz.com') => ({
  slot, name: 'Postiz', domain, url: `https://${domain}/`,
  tagline: { en: 'Schedule', fr: 'Programme' }, startsOn, endsOn,
});

describe("inventaire", () => {
  it("déclare 8 rails et 2 × 10 places défilantes", () => {
    expect(RAIL_SLOTS).toEqual(['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4']);
    expect(TAPE_TOP_SLOTS).toHaveLength(10);
    expect(TAPE_BOTTOM_SLOTS).toHaveLength(10);
    expect(TAPE_TOP_SLOTS[0]).toBe('T01');
    expect(TAPE_BOTTOM_SLOTS[9]).toBe('B10');
  });

  it("a une marche de prix par slot", () => {
    expect(RAIL_LADDER_USD).toHaveLength(RAIL_SLOTS.length);
    expect(TAPE_LADDER_USD).toHaveLength(TAPE_TOP_SLOTS.length);
  });
});

describe("selectSponsors", () => {
  it("retient un placement dont la période couvre le jour", () => {
    const { bySlot } = selectSponsors([P('L1', '2026-08-01', '2026-08-31')], '2026-08-10');
    expect(bySlot.get('L1').name).toBe('Postiz');
  });

  it("ignore un placement échu", () => {
    const { bySlot } = selectSponsors([P('L1', '2026-06-01', '2026-06-30')], '2026-08-10');
    expect(bySlot.has('L1')).toBe(false);
  });

  it("ignore un placement qui n'a pas commencé", () => {
    const { bySlot } = selectSponsors([P('L1', '2026-09-01', '2026-09-30')], '2026-08-10');
    expect(bySlot.has('L1')).toBe(false);
  });

  it("inclut les bornes de la période", () => {
    const p = [P('L1', '2026-08-10', '2026-08-10')];
    expect(selectSponsors(p, '2026-08-10').bySlot.has('L1')).toBe(true);
  });

  it("déduplique les domaines à télécharger", () => {
    const { domains } = selectSponsors(
      [P('L1', '2026-08-01', '2026-08-31'), P('R1', '2026-08-01', '2026-08-31')],
      '2026-08-10'
    );
    expect(domains).toEqual(['postiz.com']);
  });
});

describe("nextPriceUsd", () => {
  it("part du bas quand tout est libre", () => {
    expect(nextPriceUsd('rail', 0)).toBe(149);
    expect(nextPriceUsd('tape', 0)).toBe(75);
  });

  it("monte d'une marche par slot occupé", () => {
    expect(nextPriceUsd('rail', 3)).toBe(429);
    expect(nextPriceUsd('tape', 5)).toBe(299);
  });

  it("atteint la borne haute sur le dernier slot", () => {
    expect(nextPriceUsd('rail', 7)).toBe(1800);
    expect(nextPriceUsd('tape', 9)).toBe(900);
  });

  it("rend null quand il ne reste rien — jamais un prix inventé", () => {
    expect(nextPriceUsd('rail', 8)).toBe(null);
    expect(nextPriceUsd('tape', 10)).toBe(null);
  });

  it("lève une erreur sur un kind inconnu", () => {
    expect(() => nextPriceUsd('Rail', 0)).toThrow();
    expect(() => nextPriceUsd('unknown', 0)).toThrow();
    expect(() => nextPriceUsd(undefined, 0)).toThrow();
  });

  it("rend null pour un occupiedCount négatif", () => {
    expect(nextPriceUsd('rail', -1)).toBe(null);
    expect(nextPriceUsd('tape', -5)).toBe(null);
  });
});
