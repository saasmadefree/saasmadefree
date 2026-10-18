// scripts/lib/refresh-projects-run.mjs
//
// Corps de scripts/refresh-projects.mjs, sorti du script pour être testé :
// le système de fichiers, `fetch`, l'environnement, la date et les sorties
// arrivent en paramètre. Le script ne fait que brancher les vrais et sortir
// avec le code renvoyé. La logique GitHub elle-même vit dans github-stats.mjs.
//
// --dry-run : mêmes appels GitHub, même calcul (fusion des doublons
// comprise si --merge-duplicates est passé), puis un bilan par slug, et
// AUCUNE écriture : ni writeFile ni unlink. Les codes de sortie restent ceux
// du mode normal, pour qu'une simulation signale les mêmes problèmes.

import { join } from 'node:path';
import {
  refreshAll, findDuplicateRepos, pickKeeper, mergeDuplicate, serializeProject,
} from './github-stats.mjs';
import { LANGS } from './load-data.mjs';

export const STALE_DAYS = 365;
const OPTIONS = new Set(['--merge-duplicates', '--dry-run']);

const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

async function readDir(fs, dir) {
  const out = new Map();
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  for (const f of files) {
    out.set(f.replace(/\.json$/, ''), { text: await fs.readFile(join(dir, f), 'utf8') });
  }
  for (const entry of out.values()) entry.value = JSON.parse(entry.text);
  return out;
}

/**
 * Bilan par slug d'un rafraîchissement, trié par slug. Statuts, cumulables
 * sauf `missing`, `no-repo` et `ok` :
 * - `missing` : dépôt introuvable (404), stats retirées ;
 * - `renamed` : `repo` a changé (nouveau `full_name` renvoyé par GitHub) ;
 * - `archived` : dépôt archivé ;
 * - `stale` : non archivé, aucun commit depuis plus de STALE_DAYS jours ;
 * - `no-repo` : pas de dépôt GitHub, donc pas de stats ;
 * - `ok` : rien de tout cela.
 * @returns {Array<{ slug: string, statuses: string[], details: string[] }>}
 */
export function dryRunReport({ original, refreshed, missing, today }) {
  const lost = new Set(missing);
  const rows = [];
  for (const [slug, before] of original) {
    const after = refreshed.get(slug);
    const statuses = [];
    const details = [];
    if (lost.has(slug)) {
      statuses.push('missing');
      details.push(`dépôt introuvable (404) : ${before.repo}`);
    } else if (!before.repo) {
      statuses.push('no-repo');
      details.push('pas de dépôt GitHub, pas de stats');
    } else {
      if (after.repo !== before.repo) {
        statuses.push('renamed');
        details.push(`${before.repo} → ${after.repo}`);
      }
      if (after.stats?.archived) {
        statuses.push('archived');
      } else if (after.stats && daysBetween(after.stats.lastCommit, today) > STALE_DAYS) {
        statuses.push('stale');
        details.push(`dernier commit ${after.stats.lastCommit}, plus de ${STALE_DAYS} jours`);
      }
      if (statuses.length === 0) statuses.push('ok');
    }
    rows.push({ slug, statuses, details });
  }
  return rows.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/**
 * @param {{ argv: string[], env: object, root: string, fetch: Function,
 *   fs: { readFile: Function, readdir: Function, writeFile: Function, unlink: Function, access: Function },
 *   today: string, log: (line: string) => void, error: (line: string) => void }} opts
 * @returns {Promise<number>} code de sortie : 0, 1 (échec, 404, doublons) ou 2 (usage)
 */
export async function runRefreshProjects({ argv, env, root, fetch, fs, today, log, error }) {
  const args = new Set(argv);
  for (const arg of args) {
    if (!OPTIONS.has(arg)) {
      error(`Option inconnue : ${arg}`);
      return 2;
    }
  }
  const mergeDuplicates = args.has('--merge-duplicates');
  const dryRun = args.has('--dry-run');

  const token = env.GITHUB_TOKEN;
  if (!token) {
    error('GITHUB_TOKEN manquant : sans jeton, la limite de 60 appels/heure ne suffit pas.');
    return 2;
  }

  const exists = (path) => fs.access(path).then(() => true, () => false);
  const projectsDir = join(root, 'data', 'projects');
  const toolsDir = join(root, 'data', 'tools');

  const projectFiles = await readDir(fs, projectsDir);
  const toolFiles = await readDir(fs, toolsDir);
  const originalProjects = new Map([...projectFiles].map(([slug, f]) => [slug, f.value]));

  let refreshed;
  try {
    refreshed = await refreshAll(originalProjects, { fetch, token, today, concurrency: 8 });
  } catch (err) {
    error(`Échec, aucun fichier écrit — ${err.message}`);
    return 1;
  }

  let projects = refreshed.projects;
  let tools = new Map([...toolFiles].map(([slug, f]) => [slug, f.value]));
  const renamed = [...originalProjects]
    .filter(([slug, p]) => p.repo && projects.get(slug).repo !== p.repo)
    .map(([slug, p]) => `${slug} : ${p.repo} → ${projects.get(slug).repo}`);

  // Doublons : plusieurs projets sur le même dépôt (souvent après un renommage).
  const duplicates = findDuplicateRepos(projects);
  const merges = [];
  const changedTools = new Set();
  const deleted = [];
  if (duplicates.length > 0 && mergeDuplicates) {
    for (const { repo, slugs } of duplicates) {
      const keep = pickKeeper(slugs, repo);
      for (const drop of slugs.filter((s) => s !== keep)) {
        for (const lang of LANGS) {
          const path = join(root, 'data', 'i18n', lang, 'projects', `${drop}.json`);
          if (await exists(path)) {
            error(`Fusion ${drop} → ${keep} refusée, aucun fichier écrit : ${path} existe, ` +
              'le texte se fusionne à la main.');
            return 1;
          }
        }
        const out = mergeDuplicate({ projects, tools }, keep, drop);
        projects = out.projects;
        tools = out.tools;
        out.changedTools.forEach((t) => changedTools.add(t));
        deleted.push(drop);
        merges.push(`${drop} → ${keep} (${repo}, ${out.changedTools.length} fiche(s) réécrite(s))`);
      }
    }
  }

  // Écriture : seulement ce qui change, après que tout a réussi. En
  // simulation, on compte ce qui serait écrit sans rien toucher.
  let written = 0;
  for (const [slug, project] of projects) {
    const text = serializeProject(project);
    if (text !== projectFiles.get(slug)?.text) {
      if (!dryRun) await fs.writeFile(join(projectsDir, `${slug}.json`), text, 'utf8');
      written++;
    }
  }
  if (!dryRun) {
    for (const slug of changedTools) {
      await fs.writeFile(join(toolsDir, `${slug}.json`), JSON.stringify(tools.get(slug), null, 2) + '\n', 'utf8');
    }
    for (const slug of deleted) await fs.unlink(join(projectsDir, `${slug}.json`));
  }

  const list = (items) => (items.length ? `\n    ${items.join('\n    ')}` : '');

  if (dryRun) {
    const rows = dryRunReport({
      original: originalProjects, refreshed: refreshed.projects, missing: refreshed.missing, today,
    });
    const width = Math.max(0, ...rows.map((r) => r.slug.length));
    log(`Simulation (--dry-run) au ${today} : aucun fichier écrit.`);
    for (const { slug, statuses, details } of rows) {
      log(`  ${slug.padEnd(width)}  ${statuses.join(', ')}${details.length ? ` — ${details.join(' ; ')}` : ''}`);
    }
    log(`${written} fichier(s) projet, ${changedTools.size} fiche(s) outil seraient écrits, ` +
      `${deleted.length} fichier(s) projet supprimé(s).`);
  } else {
    // Bilan.
    const all = [...projects.values()];
    const withStats = all.filter((p) => p.stats);
    const archived = withStats.filter((p) => p.stats.archived).map((p) => p.slug);
    const stale = withStats
      .filter((p) => !p.stats.archived && daysBetween(p.stats.lastCommit, today) > STALE_DAYS)
      .map((p) => `${p.slug} (${p.stats.lastCommit})`);
    const noRepo = all.filter((p) => !p.repo).map((p) => p.slug);

    log(`${withStats.length} projet(s) rafraîchi(s), ${written} fichier(s) projet écrit(s), au ${today}.`);
    log(`  Renommés : ${renamed.length}${list(renamed)}`);
    log(`  Archivés : ${archived.length}${list(archived)}`);
    log(`  Sans commit depuis plus de ${STALE_DAYS} jours : ${stale.length}${list(stale)}`);
    log(`  Sans dépôt GitHub (pas de stats) : ${noRepo.length}${list(noRepo)}`);
  }
  if (merges.length) log(`  Doublons ${dryRun ? 'à fusionner' : 'fusionnés'} : ${merges.length}${list(merges)}`);

  let failed = false;
  if (refreshed.missing.length > 0) {
    const lines = refreshed.missing.map((slug) => `${slug} (${originalProjects.get(slug).repo})`);
    error(`Dépôt(s) introuvable(s) (404), stats retirées : ${lines.length}${list(lines)}`);
    failed = true;
  }
  if (duplicates.length > 0 && !mergeDuplicates) {
    const lines = duplicates.map(({ repo, slugs }) => `${repo} : ${slugs.join(', ')} (garder ${pickKeeper(slugs, repo)})`);
    error(`Projets en double sur un même dépôt : ${lines.length}${list(lines)}`);
    error('Relancer avec --merge-duplicates pour les fusionner.');
    failed = true;
  }
  return failed ? 1 : 0;
}
