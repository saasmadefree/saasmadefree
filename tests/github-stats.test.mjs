import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseRepoResponse,
  lastCommitDate,
  refreshProject,
  refreshAll,
  findDuplicateRepos,
  pickKeeper,
  mergeDuplicate,
  serializeProject,
} from '../scripts/lib/github-stats.mjs';

const fixtures = fileURLToPath(new URL('./fixtures/github/', import.meta.url));
const fixture = (name) => JSON.parse(readFileSync(join(fixtures, name), 'utf8'));

const TODAY = '2026-10-17';

function project(overrides = {}) {
  return {
    slug: 'listmonk',
    name: 'listmonk',
    homepage: 'https://listmonk.app',
    repo: 'knadh/listmonk',
    selfHostable: true,
    hosted: { exists: false },
    deploy: [],
    stack: [],
    categories: ['email-marketing'],
    markets: ['en'],
    ...overrides,
  };
}

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

// Faux `fetch` : associe un chemin d'API (sans l'hôte) à une réponse. Garde
// trace des appels pour vérifier les en-têtes et les URL.
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const path = String(url).replace('https://api.github.com', '');
    const route = routes[path];
    if (!route) throw new Error(`route non prévue : ${path}`);
    return route();
  };
  fn.calls = calls;
  return fn;
}

describe('parseRepoResponse', () => {
  it('maps stargazers_count/created_at/archived/license.spdx_id', () => {
    expect(parseRepoResponse(fixture('repo.json'))).toEqual({
      fullName: 'knadh/listmonk',
      stars: 17042,
      createdAt: '2019-06-26',
      archived: false,
      license: 'AGPL-3.0',
    });
  });

  it('license NOASSERTION → license null', () => {
    expect(parseRepoResponse(fixture('archived.json')).license).toBeNull();
  });

  it('pas de licence du tout → license null', () => {
    expect(parseRepoResponse({ ...fixture('repo.json'), license: null }).license).toBeNull();
  });
});

describe('lastCommitDate', () => {
  it('prend la date du committer du premier commit, en YYYY-MM-DD', () => {
    expect(lastCommitDate(fixture('commits.json'))).toBe('2026-10-10');
  });

  it('refuse une liste vide', () => {
    expect(() => lastCommitDate([])).toThrow();
  });
});

describe('refreshProject', () => {
  const okRoutes = {
    '/repos/knadh/listmonk': () => json(fixture('repo.json')),
    '/repos/knadh/listmonk/commits?per_page=1': () => json(fixture('commits.json')),
  };

  it('écrit stats avec checkedOn = today, et la licence si elle est absente', async () => {
    const fetch = fakeFetch(okRoutes);
    const { project: out, missing } = await refreshProject(project(), { fetch, token: 't0k', today: TODAY });
    expect(missing).toBe(false);
    expect(out.stats).toEqual({
      stars: 17042, lastCommit: '2026-10-10', createdAt: '2019-06-26', archived: false, checkedOn: TODAY,
    });
    expect(out.license).toBe('AGPL-3.0');
  });

  it('envoie Authorization: Bearer et la version de l’API', async () => {
    const fetch = fakeFetch(okRoutes);
    await refreshProject(project(), { fetch, token: 't0k', today: TODAY });
    expect(fetch.calls).toHaveLength(2);
    for (const call of fetch.calls) {
      expect(call.init.headers.Authorization).toBe('Bearer t0k');
      expect(call.init.headers.Accept).toBe('application/vnd.github+json');
    }
  });

  it('garde une licence déjà présente, même si l’API en donne une autre', async () => {
    const fetch = fakeFetch(okRoutes);
    const { project: out } = await refreshProject(project({ license: 'MIT' }), { fetch, token: 't', today: TODAY });
    expect(out.license).toBe('MIT');
  });

  it('license NOASSERTION → keeps existing license', async () => {
    const fetch = fakeFetch({
      '/repos/knadh/listmonk': () => json({ ...fixture('repo.json'), license: fixture('archived.json').license }),
      '/repos/knadh/listmonk/commits?per_page=1': () => json(fixture('commits.json')),
    });
    const withLicense = await refreshProject(project({ license: 'GPL-3.0' }), { fetch, token: 't', today: TODAY });
    expect(withLicense.project.license).toBe('GPL-3.0');
    const without = await refreshProject(project(), { fetch, token: 't', today: TODAY });
    expect(without.project).not.toHaveProperty('license');
  });

  it('marque un dépôt archivé', async () => {
    const fetch = fakeFetch({
      '/repos/atom/atom': () => json(fixture('archived.json')),
      '/repos/atom/atom/commits?per_page=1': () => json(fixture('commits.json')),
    });
    const { project: out } = await refreshProject(project({ slug: 'atom', repo: 'atom/atom' }), { fetch, token: 't', today: TODAY });
    expect(out.stats.archived).toBe(true);
  });

  it('404 → stats removed and returns {missing:true}', async () => {
    const fetch = fakeFetch({ '/repos/knadh/listmonk': () => json(fixture('404.json'), 404) });
    const stale = { stars: 1, lastCommit: '2020-01-01', createdAt: '2019-01-01', archived: false, checkedOn: '2026-01-01' };
    const { project: out, missing } = await refreshProject(project({ stats: stale }), { fetch, token: 't', today: TODAY });
    expect(missing).toBe(true);
    expect(out).not.toHaveProperty('stats');
    expect(out.repo).toBe('knadh/listmonk');
  });

  it('rate-limit 403 → throws', async () => {
    const fetch = fakeFetch({
      '/repos/knadh/listmonk': () => json({ message: 'API rate limit exceeded' }, 403, { 'x-ratelimit-remaining': '0' }),
    });
    await expect(refreshProject(project(), { fetch, token: 't', today: TODAY })).rejects.toThrow(/limite/);
  });

  it('une erreur sur les commits fait échouer le projet entier', async () => {
    const fetch = fakeFetch({
      '/repos/knadh/listmonk': () => json(fixture('repo.json')),
      '/repos/knadh/listmonk/commits?per_page=1': () => json({ message: 'Server Error' }, 502),
    });
    await expect(refreshProject(project(), { fetch, token: 't', today: TODAY })).rejects.toThrow(/502/);
  });

  it('ne modifie jamais l’objet reçu', async () => {
    const input = project();
    const snapshot = structuredClone(input);
    await refreshProject(input, { fetch: fakeFetch(okRoutes), token: 't', today: TODAY });
    expect(input).toEqual(snapshot);
  });

  it('dépôt renommé : repo prend le full_name de l’API, commits lus sur le nouveau nom', async () => {
    const fetch = fakeFetch({
      '/repos/ggerganov/whisper.cpp': () => json(fixture('renamed.json')),
      '/repos/ggml-org/whisper.cpp/commits?per_page=1': () => json(fixture('commits.json')),
    });
    const { project: out } = await refreshProject(
      project({ slug: 'whisper-cpp', repo: 'ggerganov/whisper.cpp', homepage: 'https://github.com/ggerganov/whisper.cpp' }),
      { fetch, token: 't', today: TODAY },
    );
    expect(out.repo).toBe('ggml-org/whisper.cpp');
    // Une homepage qui n'était que l'URL GitHub de l'ancien nom suit le renommage.
    expect(out.homepage).toBe('https://github.com/ggml-org/whisper.cpp');
    expect(out.license).toBe('MIT');
  });

  it('changement de casse seul : repo suit l’API, homepage intacte (contrat du feed v1)', async () => {
    const fetch = fakeFetch({
      '/repos/KeePassXreboot/keepassxc': () => json({ ...fixture('repo.json'), full_name: 'keepassxreboot/keepassxc' }),
      '/repos/keepassxreboot/keepassxc/commits?per_page=1': () => json(fixture('commits.json')),
    });
    const { project: out } = await refreshProject(
      project({ repo: 'KeePassXreboot/keepassxc', homepage: 'https://github.com/KeePassXreboot/keepassxc' }),
      { fetch, token: 't', today: TODAY },
    );
    expect(out.repo).toBe('keepassxreboot/keepassxc');
    expect(out.homepage).toBe('https://github.com/KeePassXreboot/keepassxc');
  });

  it('dépôt renommé : une homepage hors GitHub ne bouge pas', async () => {
    const fetch = fakeFetch({
      '/repos/ggerganov/whisper.cpp': () => json(fixture('renamed.json')),
      '/repos/ggml-org/whisper.cpp/commits?per_page=1': () => json(fixture('commits.json')),
    });
    const { project: out } = await refreshProject(
      project({ repo: 'ggerganov/whisper.cpp', homepage: 'https://whisper.example.org' }),
      { fetch, token: 't', today: TODAY },
    );
    expect(out.homepage).toBe('https://whisper.example.org');
  });

  it('repo null : aucun appel, stats retirées, jamais de dépôt deviné', async () => {
    const fetch = fakeFetch({});
    const { project: out, missing } = await refreshProject(
      project({ repo: null, homepage: 'https://syncthing.net', stats: { stars: 1 } }),
      { fetch, token: 't', today: TODAY },
    );
    expect(fetch.calls).toHaveLength(0);
    expect(missing).toBe(false);
    expect(out.repo).toBeNull();
    expect(out).not.toHaveProperty('stats');
  });
});

describe('refreshAll', () => {
  it('rate-limit 403 → throws, never writes partial stats', async () => {
    const projects = new Map([
      ['listmonk', project()],
      ['atom', project({ slug: 'atom', repo: 'atom/atom' })],
    ]);
    const fetch = fakeFetch({
      '/repos/knadh/listmonk': () => json(fixture('repo.json')),
      '/repos/knadh/listmonk/commits?per_page=1': () => json(fixture('commits.json')),
      '/repos/atom/atom': () => json({ message: 'API rate limit exceeded' }, 403, { 'x-ratelimit-remaining': '0' }),
    });
    await expect(refreshAll(projects, { fetch, token: 't', today: TODAY })).rejects.toThrow(/limite/);
    expect(projects.get('listmonk')).not.toHaveProperty('stats');
  });

  it('renvoie les projets rafraîchis et la liste des introuvables', async () => {
    const projects = new Map([
      ['listmonk', project()],
      ['gone', project({ slug: 'gone', repo: 'nobody/gone' })],
      ['offforge', project({ slug: 'offforge', repo: null })],
    ]);
    const fetch = fakeFetch({
      '/repos/knadh/listmonk': () => json(fixture('repo.json')),
      '/repos/knadh/listmonk/commits?per_page=1': () => json(fixture('commits.json')),
      '/repos/nobody/gone': () => json(fixture('404.json'), 404),
    });
    const { projects: out, missing } = await refreshAll(projects, { fetch, token: 't', today: TODAY });
    expect(missing).toEqual(['gone']);
    expect([...out.keys()]).toEqual(['listmonk', 'gone', 'offforge']);
    expect(out.get('listmonk').stats.stars).toBe(17042);
  });

  it('ne dépasse jamais la concurrence demandée', async () => {
    const projects = new Map();
    for (let i = 0; i < 20; i++) projects.set(`p${i}`, project({ slug: `p${i}`, repo: `o/p${i}` }));
    let inFlight = 0;
    let peak = 0;
    const fetch = async (url) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight--;
      return String(url).includes('/commits') ? json(fixture('commits.json')) : json({ ...fixture('repo.json'), full_name: String(url).split('/repos/')[1] });
    };
    await refreshAll(projects, { fetch, token: 't', today: TODAY, concurrency: 8 });
    expect(peak).toBeLessThanOrEqual(8);
    expect(peak).toBeGreaterThan(1);
  });
});

describe('findDuplicateRepos', () => {
  it('regroupe les projets qui partagent un dépôt, sans tenir compte de la casse', () => {
    const projects = new Map([
      ['whisper-cpp', project({ slug: 'whisper-cpp', repo: 'ggml-org/whisper.cpp' })],
      ['ggml-org-whisper-cpp', project({ slug: 'ggml-org-whisper-cpp', repo: 'GGML-org/Whisper.cpp' })],
      ['listmonk', project()],
      ['a', project({ slug: 'a', repo: null })],
      ['b', project({ slug: 'b', repo: null })],
    ]);
    expect(findDuplicateRepos(projects)).toEqual([
      { repo: 'ggml-org/whisper.cpp', slugs: ['ggml-org-whisper-cpp', 'whisper-cpp'] },
    ]);
  });
});

describe('pickKeeper', () => {
  it('garde le slug sans suffixe numérique ni préfixe d’organisation', () => {
    expect(pickKeeper(['ggml-org-whisper-cpp', 'whisper-cpp'], 'ggml-org/whisper.cpp')).toBe('whisper-cpp');
    expect(pickKeeper(['syncthing-2', 'syncthing'], 'syncthing/syncthing')).toBe('syncthing');
    expect(pickKeeper(['formbricks', 'formbricks-2'], 'formbricks/formbricks')).toBe('formbricks');
  });

  it('à égalité, le plus court puis l’ordre alphabétique', () => {
    expect(pickKeeper(['plane-app', 'plane'], 'makeplane/plane')).toBe('plane');
    expect(pickKeeper(['bbb', 'aaa'], 'x/y')).toBe('aaa');
  });
});

describe('mergeDuplicate', () => {
  const projects = new Map([
    ['whisper-cpp', project({
      slug: 'whisper-cpp', name: 'whisper.cpp', repo: 'ggml-org/whisper.cpp',
      homepage: 'https://github.com/ggml-org/whisper.cpp',
      categories: ['audio-video', 'meeting-notes'], markets: ['en'],
    })],
    ['ggml-org-whisper-cpp', project({
      slug: 'ggml-org-whisper-cpp', name: 'whisper.cpp', repo: 'ggml-org/whisper.cpp',
      homepage: 'https://github.com/ggml-org/whisper.cpp', license: 'MIT',
      categories: ['ai-audio', 'meeting-notes', 'voice-dictation'], markets: ['en', 'fr'],
    })],
    ['listmonk', project()],
  ]);
  const tools = new Map([
    ['wispr-flow', { slug: 'wispr-flow', alternatives: [
      { project: 'dictee', fit: 'partial' },
      { project: 'ggml-org-whisper-cpp', fit: 'partial' },
    ] }],
    ['granola', { slug: 'granola', alternatives: [
      { project: 'whisper-cpp', fit: 'niche' },
      { project: 'listmonk', fit: 'partial' },
      { project: 'ggml-org-whisper-cpp', fit: 'full' },
    ] }],
    ['notion', { slug: 'notion', alternatives: [{ project: 'listmonk', fit: 'partial' }] }],
    ['bare', { slug: 'bare' }],
  ]);
  const before = structuredClone({ projects: [...projects], tools: [...tools] });
  const out = mergeDuplicate({ projects, tools }, 'whisper-cpp', 'ggml-org-whisper-cpp');

  it('supprime le projet abandonné et garde l’autre', () => {
    expect(out.projects.has('ggml-org-whisper-cpp')).toBe(false);
    expect(out.projects.has('whisper-cpp')).toBe(true);
    expect(out.dropped).toBe('ggml-org-whisper-cpp');
  });

  it('unit les catégories (et les marchés), dans l’ordre d’apparition', () => {
    const kept = out.projects.get('whisper-cpp');
    expect(kept.categories).toEqual(['audio-video', 'meeting-notes', 'ai-audio', 'voice-dictation']);
    expect(kept.markets).toEqual(['en', 'fr']);
  });

  it('reprend la licence du doublon si le projet gardé n’en a pas', () => {
    expect(out.projects.get('whisper-cpp').license).toBe('MIT');
  });

  it('réécrit les alternatives qui pointaient sur le slug abandonné', () => {
    expect(out.tools.get('wispr-flow').alternatives).toEqual([
      { project: 'dictee', fit: 'partial' },
      { project: 'whisper-cpp', fit: 'partial' },
    ]);
  });

  it('une fiche qui citait les deux : une seule entrée, à la première place, avec le meilleur fit', () => {
    expect(out.tools.get('granola').alternatives).toEqual([
      { project: 'whisper-cpp', fit: 'full' },
      { project: 'listmonk', fit: 'partial' },
    ]);
  });

  it('liste seulement les fiches modifiées', () => {
    expect(out.changedTools.sort()).toEqual(['granola', 'wispr-flow']);
  });

  it('ne modifie pas les Map reçues', () => {
    expect(structuredClone({ projects: [...projects], tools: [...tools] })).toEqual(before);
  });

  it('refuse un slug inconnu', () => {
    expect(() => mergeDuplicate({ projects, tools }, 'whisper-cpp', 'nope')).toThrow(/nope/);
  });
});

describe('serializeProject', () => {
  it('2 espaces, \\n final, ordre de clés du schéma quel que soit l’ordre reçu', () => {
    const p = {
      markets: ['en'],
      stats: { checkedOn: TODAY, archived: false, createdAt: '2019-06-26', lastCommit: '2026-10-10', stars: 3 },
      license: 'MIT',
      slug: 'x', name: 'X', homepage: 'https://x.dev', repo: 'o/x',
      selfHostable: true, hosted: { exists: false }, deploy: [], stack: [], categories: ['c'],
    };
    const text = serializeProject(p);
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('\n  "slug": "x"');
    const parsed = JSON.parse(text);
    expect(Object.keys(parsed)).toEqual([
      'slug', 'name', 'homepage', 'repo', 'license', 'selfHostable', 'hosted',
      'deploy', 'stack', 'categories', 'stats', 'markets',
    ]);
    expect(Object.keys(parsed.stats)).toEqual(['stars', 'lastCommit', 'createdAt', 'archived', 'checkedOn']);
  });
});
