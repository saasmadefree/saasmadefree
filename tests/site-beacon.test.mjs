import { describe, it, expect } from 'vitest';
import { labelForReferrer, renderBeaconScript, AI_REFERRERS, OTHER_REFERRERS } from '../scripts/lib/site-beacon.mjs';

describe('labelForReferrer', () => {
  const cases = [
    ['https://chatgpt.com/c/abc123', 'chatgpt'],
    ['https://chat.openai.com/', 'chatgpt'],
    ['https://www.perplexity.ai/search?q=x', 'perplexity'],
    ['https://claude.ai/chat/xyz', 'claude'],
    ['https://gemini.google.com/app', 'gemini'],
    ['https://copilot.microsoft.com/', 'copilot'],
    ['https://chat.mistral.ai/chat', 'le-chat'],
    ['https://chat.deepseek.com/', 'deepseek'],
    ['https://grok.com/', 'grok'],
    ['https://www.google.com/search?q=x', 'google'],
    ['https://www.bing.com/search', 'bing'],
    ['https://duckduckgo.com/', 'duckduckgo'],
    ['https://github.com/saasmadefree/saasmadefree', 'github'],
    ['https://old.reddit.com/r/selfhosted', 'reddit'],
    ['https://exemple-inconnu.example/page', 'other'],
    ['https://saasmadefree.com/en/', 'none'], // navigation interne
    ['', 'none'],
    ['pas-une-url', 'none'],
  ];
  for (const [referrer, expected] of cases) {
    it(`${JSON.stringify(referrer)} -> ${expected}`, () => {
      expect(labelForReferrer(referrer)).toBe(expected);
    });
  }
});

// Exécute le script client réel dans un bac à sable minimal : c'est le même
// texte que celui écrit dans dist/assets/beacon.js, pas une réimplémentation.
// `new Function` est volontaire et sûr ici : la chaîne vient exclusivement de
// renderBeaconScript(), générée depuis des constantes du repo sérialisées en
// JSON.stringify — aucune entrée externe n'y est interpolée, jamais.
function runBeacon({ hostname = 'saasmadefree.com', pathname = '/en/', referrer = '' } = {}) {
  const sent = [];
  const copyListeners = [];
  const agentListeners = [];
  const copyBtn = { addEventListener: (ev, fn) => copyListeners.push(fn) };
  const agentBtn = { dataset: { agentId: 'cursor' }, addEventListener: (ev, fn) => agentListeners.push(fn) };
  const location = { hostname, pathname };
  const documentStub = {
    referrer,
    getElementById: (id) => (id === 'copy-prompt' ? copyBtn : null),
    querySelectorAll: (sel) => (sel === '.agent-btn' ? [agentBtn] : []),
  };
  const navigatorStub = { sendBeacon: (url, body) => { sent.push(JSON.parse(body)); return true; } };
  new Function('location', 'document', 'navigator', 'fetch', renderBeaconScript())(
    location, documentStub, navigatorStub, () => Promise.resolve()
  );
  return { sent, copyListeners, agentListeners };
}

describe('renderBeaconScript', () => {
  it('envoie une vue avec le label de provenance', () => {
    const { sent } = runBeacon({ pathname: '/fr/tools/notion', referrer: 'https://chatgpt.com/c/1' });
    expect(sent[0]).toEqual({ type: 'view', path: '/fr/tools/notion', lang: 'fr', ref: 'chatgpt' });
  });

  it("n'envoie rien hors du domaine de production", () => {
    const { sent } = runBeacon({ hostname: 'localhost' });
    expect(sent).toEqual([]);
  });

  it('envoie copy et open_agent au clic, avec le slug de la page', () => {
    const { sent, copyListeners, agentListeners } = runBeacon({ pathname: '/en/tools/obsidian' });
    copyListeners.forEach((fn) => fn());
    agentListeners.forEach((fn) => fn());
    expect(sent).toContainEqual({ type: 'copy', slug: 'obsidian', agent: 'clipboard' });
    expect(sent).toContainEqual({ type: 'open_agent', slug: 'obsidian', agent: 'cursor' });
  });

  it("hors page outil : vue seule, pas d'écouteurs de copie", () => {
    const { sent } = runBeacon({ pathname: '/en/categories/notes' });
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('view');
  });
});
