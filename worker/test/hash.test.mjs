import { describe, it, expect } from 'vitest';
import { dayKey, hashIp } from '../src/hash.mjs';

describe('dayKey', () => {
  it('renvoie la date UTC au format ISO court', () => {
    expect(dayKey(new Date('2026-07-30T22:30:00Z'))).toBe('2026-07-30');
  });

  it('ne bascule pas de jour selon le fuseau local', () => {
    expect(dayKey(new Date('2026-07-30T23:59:59Z'))).toBe('2026-07-30');
    expect(dayKey(new Date('2026-07-31T00:00:01Z'))).toBe('2026-07-31');
  });
});

describe('hashIp', () => {
  it('produit 64 caractères hexadécimaux', async () => {
    const h = await hashIp('203.0.113.7', 'sel', '2026-07-30');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('est déterministe à entrées identiques', async () => {
    const a = await hashIp('203.0.113.7', 'sel', '2026-07-30');
    const b = await hashIp('203.0.113.7', 'sel', '2026-07-30');
    expect(a).toBe(b);
  });

  it('change de valeur au changement de jour', async () => {
    const a = await hashIp('203.0.113.7', 'sel', '2026-07-30');
    const b = await hashIp('203.0.113.7', 'sel', '2026-07-31');
    expect(a).not.toBe(b);
  });

  it('change de valeur au changement de sel', async () => {
    const a = await hashIp('203.0.113.7', 'sel-a', '2026-07-30');
    const b = await hashIp('203.0.113.7', 'sel-b', '2026-07-30');
    expect(a).not.toBe(b);
  });

  it('distingue deux adresses différentes', async () => {
    const a = await hashIp('203.0.113.7', 'sel', '2026-07-30');
    const b = await hashIp('203.0.113.8', 'sel', '2026-07-30');
    expect(a).not.toBe(b);
  });
});
