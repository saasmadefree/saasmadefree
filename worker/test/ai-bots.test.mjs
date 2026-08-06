import { describe, it, expect } from 'vitest';
import { AI_BOTS, matchAiBot, AI_REFERRER_LABELS, REFERRER_LABELS } from '../src/ai-bots.mjs';

describe('matchAiBot', () => {
  it('reconnaît GPTBot dans un user-agent réel', () => {
    const ua = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot';
    expect(matchAiBot(ua)).toMatchObject({ bot: 'gptbot', vendor: 'OpenAI' });
  });

  it('est insensible à la casse', () => {
    expect(matchAiBot('mozilla/5.0 (compatible; claudebot/1.0)')).toMatchObject({ bot: 'claudebot' });
  });

  it('distingue PerplexityBot de Perplexity-User', () => {
    expect(matchAiBot('Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)').bot).toBe('perplexitybot');
    expect(matchAiBot('Mozilla/5.0 (compatible; Perplexity-User/1.0)').bot).toBe('perplexity-user');
  });

  it('ne matche pas un navigateur humain', () => {
    expect(matchAiBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36')).toBeNull();
  });

  it('ne matche pas ChatGPT-User comme GPTBot', () => {
    expect(matchAiBot('Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)').bot).toBe('chatgpt-user');
  });

  it('tolère null, vide et non-string', () => {
    expect(matchAiBot(null)).toBeNull();
    expect(matchAiBot('')).toBeNull();
    expect(matchAiBot(42)).toBeNull();
  });

  it('a des identifiants de bot uniques et en kebab-case', () => {
    const ids = AI_BOTS.map((b) => b.bot);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('labels de provenance', () => {
  it('les labels IA sont un sous-ensemble des labels valides', () => {
    for (const label of AI_REFERRER_LABELS) expect(REFERRER_LABELS.has(label)).toBe(true);
  });
  it("contient 'none' et 'other'", () => {
    expect(REFERRER_LABELS.has('none')).toBe(true);
    expect(REFERRER_LABELS.has('other')).toBe(true);
  });
});
