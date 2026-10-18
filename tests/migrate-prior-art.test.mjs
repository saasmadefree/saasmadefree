import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migratePriorArt, parseGithubRepo, derivePriorArt } from '../scripts/lib/prior-art.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/migrate-prior-art.mjs', import.meta.url));

function tool(slug, category, priorArt) {
  const t = { slug, name: slug, category, requirements: [] };
  if (priorArt) t.priorArt = priorArt;
  t.relatedSlugs = ['x', 'y', 'z'];
  return t;
}

/** Instantané de data/ : chemin relatif → contenu. */
function snapshot(root) {
  const out = {};
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path, `${rel}${entry.name}/`);
      else out[`${rel}${entry.name}`] = readFileSync(path, 'utf8');
    }
  };
  walk(join(root, 'data'), '');
  return out;
}

describe('parseGithubRepo', () => {
  it('lit owner/name, sous-chemins et .git compris, et rend null hors GitHub', () => {
    expect(parseGithubRepo('https://github.com/KeePassXreboot/keepassxc')).toBe('KeePassXreboot/keepassxc');
    expect(parseGithubRepo('https://github.com/ml-explore/mlx-examples/tree/main/whisper')).toBe('ml-explore/mlx-examples');
    expect(parseGithubRepo('https://github.com/a/b.git')).toBe('a/b');
    expect(parseGithubRepo('https://gitlab.com/glitchtip/glitchtip-backend')).toBeNull();
  });
});

describe('migratePriorArt', () => {
  it('dedupes two tools citing the same repo into one project', () => {
    const tools = new Map([
      ['1password', tool('1password', 'security', [{ name: 'KeePassXC', url: 'https://github.com/KeePassXreboot/keepassxc' }])],
      ['dashlane', tool('dashlane', 'passwords', [{ name: 'KeePassXC', url: 'https://github.com/keepassxreboot/keepassxc', license: 'GPL-3.0' }])],
    ]);
    const { projects, tools: out, stats } = migratePriorArt(tools, new Map());
    expect([...projects.keys()]).toEqual(['keepassxc']);
    expect(projects.get('keepassxc')).toEqual({
      slug: 'keepassxc', name: 'KeePassXC',
      homepage: 'https://github.com/KeePassXreboot/keepassxc', repo: 'KeePassXreboot/keepassxc',
      license: 'GPL-3.0', selfHostable: true, hosted: { exists: false }, deploy: [], stack: [],
      categories: ['passwords', 'security'], markets: ['en'],
    });
    expect(out.get('1password').alternatives).toEqual([{ project: 'keepassxc', fit: 'partial' }]);
    expect(out.get('dashlane').alternatives).toEqual([{ project: 'keepassxc', fit: 'partial' }]);
    expect(stats).toMatchObject({ toolsMigrated: 2, projectsCreated: 1, duplicatesMerged: 1 });
  });

  it('retient le nom le plus cité, et à égalité le plus court', () => {
    const tools = new Map([
      ['ahrefs', tool('ahrefs', 'seo', [{ name: 'Screaming Frog alternatives: SEO Macroscope', url: 'https://github.com/nazuke/SEOMacroscope' }])],
      ['semrush', tool('semrush', 'seo', [{ name: 'SEO Macroscope', url: 'https://github.com/nazuke/SEOMacroscope' }])],
    ]);
    expect(migratePriorArt(tools, new Map()).projects.get('seomacroscope').name).toBe('SEO Macroscope');
  });

  it('remplace priorArt par alternatives à la même position', () => {
    const tools = new Map([['a', tool('a', 'c', [{ name: 'X', url: 'https://github.com/o/x' }])]]);
    const out = migratePriorArt(tools, new Map()).tools.get('a');
    expect(Object.keys(out)).toEqual(['slug', 'name', 'category', 'requirements', 'alternatives', 'relatedSlugs']);
    expect(out.priorArt).toBeUndefined();
  });

  it('donne repo null et un slug tiré du nom hors GitHub', () => {
    const tools = new Map([['sentry', tool('sentry', 'dev', [{ name: 'GlitchTip', url: 'https://gitlab.com/glitchtip/glitchtip-backend' }])]]);
    const project = migratePriorArt(tools, new Map()).projects.get('glitchtip');
    expect(project.repo).toBeNull();
    expect(project.homepage).toBe('https://gitlab.com/glitchtip/glitchtip-backend');
    expect(project.license).toBeUndefined();
  });

  it('préfixe le propriétaire quand deux dépôts distincts portent le même nom', () => {
    const tools = new Map([
      ['a', tool('a', 'c', [{ name: 'whisper.cpp', url: 'https://github.com/ggerganov/whisper.cpp' }])],
      ['b', tool('b', 'c', [{ name: 'whisper.cpp', url: 'https://github.com/ggerganov/whisper.cpp' }])],
      ['c', tool('c', 'c', [{ name: 'whisper.cpp', url: 'https://github.com/ggml-org/whisper.cpp' }])],
    ]);
    const { projects, tools: out } = migratePriorArt(tools, new Map());
    expect([...projects.keys()].sort()).toEqual(['ggml-org-whisper-cpp', 'whisper-cpp']);
    expect(out.get('c').alternatives[0].project).toBe('ggml-org-whisper-cpp');
  });

  it('réutilise un projet déjà sur disque, sans le réécrire sauf ses catégories', () => {
    const existing = new Map([['listmonk', {
      slug: 'listmonk', name: 'Listmonk', homepage: 'https://listmonk.app', repo: 'knadh/listmonk',
      selfHostable: true, hosted: { exists: false }, deploy: ['docker'], stack: ['go'],
      categories: ['newsletter'], markets: ['en', 'fr'],
    }]]);
    const tools = new Map([['mailchimp', tool('mailchimp', 'email', [{ name: 'listmonk', url: 'https://github.com/knadh/listmonk' }])]]);
    const { projects, tools: out, stats } = migratePriorArt(tools, existing);
    expect(out.get('mailchimp').alternatives).toEqual([{ project: 'listmonk', fit: 'partial' }]);
    expect(projects.get('listmonk')).toEqual({ ...existing.get('listmonk'), categories: ['email', 'newsletter'] });
    expect(stats.projectsCreated).toBe(0);
  });

  it('derivePriorArt rend la forme du feed v1, licence omise si absente', () => {
    const tools = new Map([['a', tool('a', 'c', [
      { name: 'X', url: 'https://github.com/o/x', license: 'MIT' },
      { name: 'Y', url: 'https://y.example' },
    ])]]);
    const { tools: out, projects } = migratePriorArt(tools, new Map());
    const derived = derivePriorArt(out.get('a'), projects);
    expect(JSON.stringify(derived)).toBe(JSON.stringify(tools.get('a').priorArt));
  });
});

describe('scripts/migrate-prior-art.mjs', () => {
  let root;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'smf-migrate-'));
    mkdirSync(join(root, 'data', 'tools'), { recursive: true });
    const write = (t) => writeFileSync(join(root, 'data', 'tools', `${t.slug}.json`), JSON.stringify(t, null, 2) + '\n');
    write(tool('1password', 'security', [{ name: 'KeePassXC', url: 'https://github.com/KeePassXreboot/keepassxc' }]));
    write(tool('dashlane', 'security', [{ name: 'KeePassXC', url: 'https://github.com/keepassxreboot/keepassxc' }]));
    write(tool('obsidian', 'notes', [{ name: 'Syncthing', url: 'https://syncthing.net', license: 'MPL-2.0' }]));
    write(tool('lonely', 'notes'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('écrit les projets et réécrit les fiches, sans créer de texte i18n', () => {
    execFileSync(process.execPath, [SCRIPT], { cwd: root, stdio: 'pipe' });
    const files = Object.keys(snapshot(root)).sort();
    expect(files).toEqual([
      'projects/keepassxc.json', 'projects/syncthing.json',
      'tools/1password.json', 'tools/dashlane.json', 'tools/lonely.json', 'tools/obsidian.json',
    ]);
    const obsidian = JSON.parse(readFileSync(join(root, 'data', 'tools', 'obsidian.json'), 'utf8'));
    expect(obsidian.alternatives).toEqual([{ project: 'syncthing', fit: 'partial' }]);
  });

  it('idempotent second run', () => {
    execFileSync(process.execPath, [SCRIPT], { cwd: root, stdio: 'pipe' });
    const first = snapshot(root);
    const log = execFileSync(process.execPath, [SCRIPT], { cwd: root, stdio: 'pipe' }).toString();
    expect(snapshot(root)).toEqual(first);
    expect(log).toContain('0 fiche(s) migrée(s)');
  });
});
