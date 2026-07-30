import { describe, it, expect, beforeEach, vi } from 'vitest';

// background.mjs s'exécute comme service worker MV3 : son évaluation
// immédiate (top-level) enregistre des listeners chrome.runtime.* et
// chrome.alarms.*. On stub juste assez de l'API chrome pour que l'import ne
// plante pas, puis on importe le module dynamiquement — un `import` statique
// serait hoisté avant que le stub n'existe.
function makeChromeStub() {
  const store = {};
  return {
    _store: store,
    runtime: {
      onMessage: { addListener: () => {} },
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} },
      getURL: (path) => `chrome-extension://test/${path}`,
    },
    alarms: {
      create: () => {},
      onAlarm: { addListener: () => {} },
    },
    storage: {
      local: {
        async get(keys) {
          if (typeof keys === 'string') return { [keys]: store[keys] };
          if (Array.isArray(keys)) {
            const out = {};
            for (const k of keys) out[k] = store[k];
            return out;
          }
          return { ...store };
        },
        async set(patch) {
          Object.assign(store, patch);
        },
      },
    },
  };
}

const chromeStub = makeChromeStub();
globalThis.chrome = chromeStub;

const { sendVote, flushPendingVotes } = await import('../extension/background.mjs');

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  for (const key of Object.keys(chromeStub._store)) delete chromeStub._store[key];
  vi.restoreAllMocks();
});

// Le bug corrigé ici : l'ancien sendVote mettait en file TOUTE réponse
// non-ok, y compris un 400 unknown_slug définitif (l'outil n'existe plus
// dans data/). flushPendingVotes() s'arrête au premier résultat encore en
// file, donc un seul slug définitivement mort bloquait tous les votes
// suivants, pour toujours. Le correctif ne remet en file que ce qui a une
// vraie chance de réussir plus tard : erreur réseau, 429, 5xx.
describe('sendVote — quoi remettre en file', () => {
  it('met en file sur une erreur réseau', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('offline'));
    const result = await sendVote('notion');
    expect(result).toEqual({ queued: true });
    expect(chromeStub._store.pendingVotes).toEqual(['notion']);
  });

  it('met en file sur un 429 (limite de débit)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(429, { error: 'rate_limited' }));
    const result = await sendVote('notion');
    expect(result).toEqual({ queued: true });
    expect(chromeStub._store.pendingVotes).toEqual(['notion']);
  });

  it('met en file sur un 500 (panne serveur)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(500, { error: 'internal_error' }));
    const result = await sendVote('notion');
    expect(result).toEqual({ queued: true });
    expect(chromeStub._store.pendingVotes).toEqual(['notion']);
  });

  it('ne met PAS en file un 400 unknown_slug (échec définitif)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(400, { error: 'unknown_slug' }));
    const result = await sendVote('outil-supprime');
    expect(result).toEqual({ error: 'unknown_slug' });
    expect(chromeStub._store.pendingVotes ?? []).toEqual([]);
  });

  it('retire un slug de la file existante si un nouvel essai échoue définitivement', async () => {
    chromeStub._store.pendingVotes = ['outil-supprime'];
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(400, { error: 'unknown_slug' }));
    await sendVote('outil-supprime');
    expect(chromeStub._store.pendingVotes).toEqual([]);
  });

  it('ne touche pas la file sur un succès', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(200, { count: 3, counted: true }));
    const result = await sendVote('notion');
    expect(result).toEqual({ count: 3, counted: true });
    expect(chromeStub._store.pendingVotes ?? []).toEqual([]);
  });
});

describe('flushPendingVotes — un slug mort ne doit plus bloquer les suivants', () => {
  it('continue derrière un slug en échec définitif et vide la file', async () => {
    chromeStub._store.pendingVotes = ['outil-supprime', 'notion'];
    globalThis.fetch = vi.fn(async (_url, init) => {
      const { slug } = JSON.parse(init.body);
      if (slug === 'outil-supprime') return jsonResponse(400, { error: 'unknown_slug' });
      return jsonResponse(200, { count: 1, counted: true });
    });

    await flushPendingVotes();

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(chromeStub._store.pendingVotes).toEqual([]);
  });

  it('s\'arrête toujours au premier slug encore hors ligne, sans toucher au reste', async () => {
    chromeStub._store.pendingVotes = ['a', 'b'];
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('offline'));

    await flushPendingVotes();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1); // 'b' jamais tenté
    expect(chromeStub._store.pendingVotes).toEqual(['a', 'b']); // rien retiré
  });
});
