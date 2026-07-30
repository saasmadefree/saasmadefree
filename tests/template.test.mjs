import { describe, it, expect } from 'vitest';
import { renderTemplate, resolveAction, ALLOWED_VARS } from '../extension/lib/template.mjs';

const ctx = {
  prompt: 'Construis une appli & un serveur',
  prompt_url: 'https://saasmadefree.com/feed/v1/fr/prompts/notion.txt',
  lang: 'fr',
  slug: 'notion',
};

describe('renderTemplate', () => {
  it('remplace les variables autorisées', () => {
    expect(renderTemplate('https://x.test/?q={prompt}&l={lang}', ctx))
      .toBe('https://x.test/?q=Construis%20une%20appli%20%26%20un%20serveur&l=fr');
  });

  it("encode l'url de prompt", () => {
    expect(renderTemplate('https://claude.ai/code?prompt_url={prompt_url}', ctx))
      .toContain('https%3A%2F%2Fsaasmadefree.com');
  });

  it('lève sur une variable hors liste blanche', () => {
    expect(() => renderTemplate('https://x.test/?k={apikey}', ctx)).toThrow(/apikey/);
  });

  it('remplace une variable absente par une chaîne vide', () => {
    expect(renderTemplate('https://x.test/?s={slug}', { slug: undefined })).toBe('https://x.test/?s=');
  });

  it('expose exactement quatre variables autorisées', () => {
    expect([...ALLOWED_VARS].sort()).toEqual(['lang', 'prompt', 'prompt_url', 'slug']);
  });

  it('lève sur un jeton en majuscule', () => {
    expect(() => renderTemplate('https://x.test/?q={Prompt}', ctx)).toThrow(/Prompt/);
  });

  it('lève sur un jeton avec chiffre', () => {
    expect(() => renderTemplate('https://x.test/?q={prompt1}', ctx)).toThrow(/prompt1/);
  });

  it('lève sur un jeton avec tiret', () => {
    expect(() => renderTemplate('https://x.test/?q={prompt-url}', ctx)).toThrow(/prompt-url/);
  });

  it('lève sur un jeton avec point', () => {
    expect(() => renderTemplate('https://x.test/?q={prompt.url}', ctx)).toThrow(/prompt\.url/);
  });

  it('lève sur une accolade vide', () => {
    expect(() => renderTemplate('https://x.test/?q={}', ctx)).toThrow();
  });
});

describe('resolveAction', () => {
  const cursor = { id: 'cursor', kind: 'deeplink', status: 'verified', maxLength: 8000,
    template: 'cursor://anysphere.cursor-deeplink/prompt?text={prompt}', homepage: 'https://cursor.com' };

  it('produit un deeplink pour un agent vérifié', () => {
    const action = resolveAction(cursor, ctx);
    expect(action.mode).toBe('deeplink');
    expect(action.url.startsWith('cursor://')).toBe(true);
  });

  it('bascule en presse-papier au-delà de maxLength', () => {
    const action = resolveAction({ ...cursor, maxLength: 10 }, ctx);
    expect(action).toMatchObject({ mode: 'clipboard', reason: 'too-long', url: 'https://cursor.com' });
  });

  it('renvoie not-yet pour un agent non supporté', () => {
    const action = resolveAction({ ...cursor, status: 'not-yet' }, ctx);
    expect(action.mode).toBe('not-yet');
  });

  it("renvoie l'accueil pour un agent de type clipboard", () => {
    const cli = { id: 'cli', kind: 'clipboard', status: 'verified', template: null,
      maxLength: null, homepage: 'https://code.claude.com' };
    expect(resolveAction(cli, ctx)).toMatchObject({ mode: 'clipboard', url: 'https://code.claude.com' });
  });

  it('ignore maxLength quand il vaut null', () => {
    const web = { ...cursor, kind: 'url', maxLength: null,
      template: 'https://claude.ai/code?prompt_url={prompt_url}' };
    expect(resolveAction(web, ctx).mode).toBe('url');
  });

  it("renvoie le presse-papier pour kind='url' sans template", () => {
    const noTemplate = { id: 'test', kind: 'url', status: 'verified', template: null,
      maxLength: null, homepage: 'https://example.com' };
    expect(resolveAction(noTemplate, ctx)).toMatchObject({ mode: 'clipboard', url: 'https://example.com' });
  });
});
