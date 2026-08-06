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

  it("n'appelle jamais le réseau quand aucune implémentation fetch n'est fournie", async () => {
    const root = await tempDir();
    const tools = new Map([['a', tool('a', 'a.com')]]);
    const { bySlug } = await fetchFavicons(tools, {
      cacheDir: join(root, 'cache'),
      outDir: join(root, 'out'),
      fetchImpl: undefined,
    });
    expect(bySlug.a).toBe(PLACEHOLDER_PATH);
  });

  it('télécharge aussi les domaines hors catalogue et les indexe par domaine', async () => {
    const root = await tempDir();
    const { byDomain } = await fetchFavicons(new Map(), {
      cacheDir: join(root, 'cache'),
      outDir: join(root, 'out'),
      extraDomains: ['postiz.com'],
      fetchImpl: async () => pngResponse(),
    });
    expect(byDomain['postiz.com']).toBe('/assets/favicons/postiz.com.png');
  });
});
