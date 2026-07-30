import { describe, it, expect } from 'vitest';
import { normalizeHost, matchHost } from '../extension/lib/domain-match.mjs';

const index = {
  'notion.so': { slug: 'notion', verdict: 'kinda' },
  'notion.com': { slug: 'notion', verdict: 'kinda' },
  'calendly.com': { slug: 'calendly', verdict: 'kinda' },
};

describe('normalizeHost', () => {
  it('passe en minuscules', () => expect(normalizeHost('Notion.SO')).toBe('notion.so'));
  it('retire le port', () => expect(normalizeHost('notion.so:443')).toBe('notion.so'));
  it('retire le www', () => expect(normalizeHost('www.notion.so')).toBe('notion.so'));
  it('retire le point final', () => expect(normalizeHost('notion.so.')).toBe('notion.so'));
  it('renvoie null sur une entrée vide', () => expect(normalizeHost('')).toBeNull());
  it('renvoie null sur une entrée non textuelle', () => expect(normalizeHost(null)).toBeNull());
});

describe('matchHost', () => {
  it('trouve une correspondance exacte', () => {
    expect(matchHost('notion.so', index).slug).toBe('notion');
  });

  it('trouve depuis un sous-domaine applicatif', () => {
    expect(matchHost('app.notion.so', index).slug).toBe('notion');
  });

  it('trouve depuis un sous-domaine profond', () => {
    expect(matchHost('eu.app.notion.so', index).slug).toBe('notion');
  });

  it('trouve malgré le www et le port', () => {
    expect(matchHost('WWW.Calendly.com:443', index).slug).toBe('calendly');
  });

  it('ne trouve rien sur un domaine inconnu', () => {
    expect(matchHost('example.com', index)).toBeNull();
  });

  it('ne se fait pas piéger par un domaine sosie', () => {
    expect(matchHost('notion.so.attaquant.com', index)).toBeNull();
  });

  it('ne se fait pas piéger par un préfixe collé', () => {
    expect(matchHost('fakenotion.so', index)).toBeNull();
  });

  it('renvoie null sur une entrée vide', () => {
    expect(matchHost('', index)).toBeNull();
  });

  it('renvoie null si index est null', () => {
    expect(matchHost('notion.so', null)).toBeNull();
  });

  it('renvoie null si index est undefined', () => {
    expect(matchHost('notion.so', undefined)).toBeNull();
  });

  it('renvoie null si index n\'est pas un objet', () => {
    expect(matchHost('notion.so', 'not an object')).toBeNull();
  });
});
