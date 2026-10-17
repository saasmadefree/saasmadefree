import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Garde-fous des workflows GitHub (revue A8). Pas d'analyseur YAML dans les
// dépendances : on découpe le texte en jobs puis en steps, sur l'indentation
// fixe des fichiers du dépôt (jobs à 2 espaces, steps à 6).
const read = (name) => readFileSync(join('.github', 'workflows', name), 'utf8');

/** { nom du job → texte du job } */
function jobsOf(yml) {
  const body = yml.slice(yml.indexOf('\njobs:\n') + '\njobs:\n'.length);
  const jobs = {};
  for (const chunk of body.split(/\n(?=  [a-z][\w-]*:\n)/)) {
    const name = chunk.match(/^\s*([a-z][\w-]*):/)?.[1];
    if (name) jobs[name] = chunk;
  }
  return jobs;
}

/** Steps d'un job, chacun avec ses commentaires de tête retirés. */
function stepsOf(job) {
  return job.split(/\n(?=      - )/).slice(1)
    .map((step) => step.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n'));
}

// Une commande npm/npx/node en tête de ligne (après `run:` ou dans un bloc
// `run: |`) — pas un mot dans un texte de PR.
const runsNode = (step) => /^\s*(run:\s*)?(npm|npx|node)\s/m.test(step);
const hasToken = (step) => /\b(GITHUB_TOKEN|GH_TOKEN)\s*:/.test(step);
const writes = (job) => /permissions:\n(\s+[\w-]+: \w+\n)*?\s+[\w-]+: write/.test(job);

describe('refresh-projects.yml — isolation du jeton', () => {
  const yml = read('refresh-projects.yml');
  const jobs = jobsOf(yml);

  it('aucune permission par défaut au niveau du workflow', () => {
    expect(yml).toMatch(/^permissions: \{\}$/m);
  });

  it('deux jobs : refresh en lecture seule, pull-request en écriture', () => {
    expect(Object.keys(jobs)).toEqual(['refresh', 'pull-request']);
    expect(writes(jobs.refresh)).toBe(false);
    expect(jobs.refresh).toMatch(/permissions:\n\s+contents: read\n/);
    expect(writes(jobs['pull-request'])).toBe(true);
  });

  it('chaque checkout part de main, sans garder le jeton dans .git/config', () => {
    const checkouts = Object.values(jobs).flatMap(stepsOf).filter((s) => s.includes('actions/checkout@'));
    expect(checkouts).toHaveLength(2);
    for (const step of checkouts) {
      expect(step).toContain('persist-credentials: false');
      expect(step).toMatch(/ref: main\b/);
    }
  });

  it('npm ci toujours avec --ignore-scripts', () => {
    const installs = yml.split('\n').filter((line) => /\bnpm ci\b/.test(line) && !/^\s*#/.test(line));
    expect(installs.length).toBeGreaterThan(0);
    for (const line of installs) expect(line).toContain('--ignore-scripts');
  });

  it('un job en écriture n’exécute ni npm ni node', () => {
    for (const [name, job] of Object.entries(jobs)) {
      if (!writes(job)) continue;
      for (const step of stepsOf(job)) {
        expect(runsNode(step), `${name} : step qui lance npm/node avec des droits d'écriture\n${step}`).toBe(false);
        expect(step).not.toContain('actions/setup-node');
      }
    }
  });

  it('aucun step qui lance npm ou node ne reçoit un jeton dans un job en écriture ; en lecture, un seul', () => {
    for (const [name, job] of Object.entries(jobs)) {
      const withToken = stepsOf(job).filter((s) => runsNode(s) && hasToken(s));
      if (writes(job)) expect(withToken, name).toEqual([]);
      else expect(withToken.map((s) => s.match(/name: (.*)/)?.[1])).toEqual(['Rafraîchir les projets']);
    }
  });

  it('le push passe le jeton en en-tête, jamais dans l’URL du remote', () => {
    const job = jobs['pull-request'];
    expect(job).toMatch(/git -c http\.https:\/\/github\.com\/\.extraheader="AUTHORIZATION: basic \$\{auth\}" push --force origin "\$branch"/);
    expect(job).not.toMatch(/https:\/\/[^"\s]*\$\{?GH_TOKEN/);
    expect(job).not.toMatch(/git remote set-url/);
  });
});

describe('ci.yml — garde-fous dist/ du déploiement', () => {
  const jobs = jobsOf(read('ci.yml'));

  it('le job deploy lance les tests sur dist/ entre le build et la publication', () => {
    const steps = stepsOf(jobs.deploy);
    const build = steps.findIndex((s) => /run: npm run build/.test(s));
    const guard = steps.findIndex((s) => /npx vitest run tests\/dist-budget\.test\.mjs tests\/site-indexing\.test\.mjs/.test(s));
    const publish = steps.findIndex((s) => /pages deploy dist/.test(s));
    expect(build).toBeGreaterThanOrEqual(0);
    expect(guard).toBeGreaterThan(build);
    expect(publish).toBeGreaterThan(guard);
  });
});
