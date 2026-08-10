import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchFavicons, PLACEHOLDER_PATH } from '../scripts/lib/site-favicons.mjs';

function tool(slug, domain) {
  return { slug, name: slug, domains: [domain] };
}

const dirs = [];
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'smf-favicons-'));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  while (dirs.length > 0) {
    await rm(dirs.pop(), { recursive: true, force: true });
  }
});

function pngResponse(bytes = 4) {
  return {
    ok: true,
    headers: { get: () => 'image/png' },
    arrayBuffer: async () => new Uint8Array(bytes).fill(1).buffer,
  };
}

describe('fetchFavicons', () => {
  it('récupère une icône par outil et écrit toujours le repli partagé', async () => {
    const root = await tempDir();
    const tools = new Map([['a', tool('a', 'a.com')]]);
    let calls = 0;
    const { bySlug, stats } = await fetchFavicons(tools, {
      cacheDir: join(root, 'cache'),
      outDir: join(root, 'out'),
      fetchImpl: async () => { calls += 1; return pngResponse(); },
    });
    expect(calls).toBe(1);
    expect(bySlug.a).toBe('/assets/favicons/a.png');
    expect(stats).toEqual({ total: 1, cached: 0, fetched: 1, placeholder: 0 });
    await expect(readFile(join(root, 'out', 'a.png'))).resolves.toBeInstanceOf(Buffer);
    await expect(readFile(join(root, 'out', '_placeholder.svg'), 'utf8')).resolves.toContain('<svg');
  });

  it('réutilise le cache sans refaire de requête réseau', async () => {
    const root = await tempDir();
    const cacheDir = join(root, 'cache');
    await mkdir(cacheDir, { recursive: true });
    await writeFile(join(cacheDir, 'a.com.png'), Buffer.from([9, 9, 9]));
    const tools = new Map([['a', tool('a', 'a.com')]]);
    let calls = 0;
    const { stats } = await fetchFavicons(tools, {
      cacheDir,
      outDir: join(root, 'out'),
      fetchImpl: async () => { calls += 1; return pngResponse(); },
    });
    expect(calls).toBe(0);
    expect(stats).toEqual({ total: 1, cached: 1, fetched: 0, placeholder: 0 });
  });

  it('retombe sur le repli quand la requête échoue, sans jamais planter', async () => {
    const root = await tempDir();
    const tools = new Map([['a', tool('a', 'a.com')]]);
    const { bySlug, stats } = await fetchFavicons(tools, {
      cacheDir: join(root, 'cache'),
      outDir: join(root, 'out'),
      fetchImpl: async () => { throw new Error('offline'); },
    });
    expect(bySlug.a).toBe(PLACEHOLDER_PATH);
    expect(stats).toEqual({ total: 1, cached: 0, fetched: 0, placeholder: 1 });
  });

  it('retombe sur le repli pour une réponse non ok, sans mettre en cache un échec', async () => {
    const root = await tempDir();
    const cacheDir = join(root, 'cache');
    const tools = new Map([['a', tool('a', 'a.com')]]);
    const { bySlug } = await fetchFavicons(tools, {
      cacheDir,
      outDir: join(root, 'out'),
      fetchImpl: async () => ({ ok: false, headers: { get: () => null } }),
    });
    expect(bySlug.a).toBe(PLACEHOLDER_PATH);
    await expect(readFile(join(cacheDir, 'a.com.png'))).rejects.toThrow();
  });

  it('normalise le domaine (www. et casse) avant de nommer le fichier de cache', async () => {
    const root = await tempDir();
    const cacheDir = join(root, 'cache');
    const tools = new Map([['a', tool('a', 'WWW.A.com')]]);
    await fetchFavicons(tools, {
      cacheDir,
      outDir: join(root, 'out'),
      fetchImpl: async () => pngResponse(),
    });
    await expect(readFile(join(cacheDir, 'a.com.png'))).resolves.toBeInstanceOf(Buffer);
  });

  // Ce test passait `fetchImpl: undefined`, ce qui déclenche la valeur par
  // défaut du déstructurage (`fetchImpl = globalThis.fetch`) : il appelait
  // donc VRAIMENT https://www.google.com/s2/favicons à chaque exécution, et
  // ne passait que parce que Google répond 404 pour ce domaine de fixture.
  // Il affirmait l'inverse de ce qu'il faisait, et rendait la suite racine
  // non hermétique. `fetchImpl: null` désactive réellement la récupération
  // (fetchFaviconBytes teste `typeof fetchImpl !== 'function'`), et le fetch
  // global est remplacé par un espion : le test échoue maintenant si une
  // requête sort, au lieu de dépendre de la réponse d'un tiers.
  it("n'appelle jamais le réseau quand aucune implémentation fetch n'est disponible", async () => {
    const root = await tempDir();
    const tools = new Map([['a', tool('a', 'a.com')]]);
    const original = globalThis.fetch;
    let networkCalls = 0;
    globalThis.fetch = async (...args) => {
      networkCalls += 1;
      throw new Error(`requête réseau interdite dans ce test : ${args[0]}`);
    };
    try {
      const { bySlug, stats } = await fetchFavicons(tools, {
        cacheDir: join(root, 'cache'),
        outDir: join(root, 'out'),
        fetchImpl: null,
      });
      expect(networkCalls).toBe(0);
      expect(bySlug.a).toBe(PLACEHOLDER_PATH);
      expect(stats).toEqual({ total: 1, cached: 0, fetched: 0, placeholder: 1 });
    } finally {
      globalThis.fetch = original;
    }
  });

  it('télécharge aussi les domaines hors catalogue et les indexe par domaine', async () => {
    const root = await tempDir();
    const { byDomain, stats } = await fetchFavicons(new Map(), {
      cacheDir: join(root, 'cache'),
      outDir: join(root, 'out'),
      extraDomains: ['postiz.com'],
      fetchImpl: async () => pngResponse(),
    });
    expect(byDomain['postiz.com']).toBe('/assets/favicons/postiz.com.png');
    expect(stats).toEqual({ total: 1, cached: 0, fetched: 1, placeholder: 0 });
  });

  it("ne compte le repli qu'une fois pour un domaine partagé par un outil et un sponsor dont la récupération échoue", async () => {
    const root = await tempDir();
    const tools = new Map([['a', tool('a', 'fail.com')]]);
    let calls = 0;
    const { bySlug, byDomain, stats } = await fetchFavicons(tools, {
      cacheDir: join(root, 'cache'),
      outDir: join(root, 'out'),
      extraDomains: ['fail.com'],
      fetchImpl: async () => { calls += 1; throw new Error('offline'); },
    });
    expect(calls).toBe(1);
    expect(bySlug.a).toBe(PLACEHOLDER_PATH);
    expect(byDomain['fail.com']).toBe(PLACEHOLDER_PATH);
    expect(stats).toEqual({ total: 2, cached: 0, fetched: 0, placeholder: 1 });
  });
});
