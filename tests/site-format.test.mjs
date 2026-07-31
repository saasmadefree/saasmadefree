import { describe, it, expect } from 'vitest';
import {
  formatMoney, formatMonthlyPrice, formatDate, interpolate, pluralize,
} from '../scripts/lib/site-format.mjs';

describe('formatMoney', () => {
  it('formate un montant entier sans décimales', () => {
    expect(formatMoney(10, 'USD', 'en')).toBe('$10');
  });

  it('conserve les décimales pour un montant non entier', () => {
    expect(formatMoney(9.5, 'USD', 'en')).toBe('$9.50');
  });

  it('respecte la locale demandée pour le symbole et la position', () => {
    const en = formatMoney(12, 'USD', 'en');
    const fr = formatMoney(12, 'USD', 'fr');
    expect(en.startsWith('$')).toBe(true);
    expect(fr.includes('12')).toBe(true);
  });
});

describe('formatMonthlyPrice', () => {
  it('ajoute le suffixe mensuel localisé quand basis contient "monthly"', () => {
    const pricing = { amount: 12, currency: 'USD', basis: 'monthly per user' };
    expect(formatMonthlyPrice(pricing, 'en')).toMatch(/\/mo$/);
    expect(formatMonthlyPrice(pricing, 'fr')).toMatch(/\/mois$/);
  });

  it("n'invente pas de périodicité mensuelle quand basis ne le dit pas", () => {
    const pricing = { amount: 99, currency: 'USD', basis: 'one-time' };
    const out = formatMonthlyPrice(pricing, 'en');
    expect(out).not.toMatch(/\/mo/);
  });
});

describe('formatDate', () => {
  it('formate une date ISO en toutes lettres, dans la langue demandée', () => {
    expect(formatDate('2026-07-30', 'en')).toBe('July 30, 2026');
    expect(formatDate('2026-07-30', 'fr')).toBe('30 juillet 2026');
  });
});

describe('interpolate', () => {
  it('remplace les jetons {name} par leur valeur', () => {
    expect(interpolate('Hello {name}', { name: 'Notion' })).toBe('Hello Notion');
  });

  it('laisse un jeton sans valeur fournie comme chaîne vide', () => {
    expect(interpolate('Hello {name}', {})).toBe('Hello ');
  });
});

describe('pluralize', () => {
  const singular = '{count} vote';
  const plural = '{count} votes';

  it('anglais : singulier seulement à 1, pluriel pour 0 et au-delà', () => {
    expect(pluralize(0, 'en', singular, plural)).toBe('0 votes');
    expect(pluralize(1, 'en', singular, plural)).toBe('1 vote');
    expect(pluralize(2, 'en', singular, plural)).toBe('2 votes');
  });

  it('français : singulier pour 0 et 1, pluriel à partir de 2', () => {
    expect(pluralize(0, 'fr', singular, plural)).toBe('0 vote');
    expect(pluralize(1, 'fr', singular, plural)).toBe('1 vote');
    expect(pluralize(2, 'fr', singular, plural)).toBe('2 votes');
  });
});
