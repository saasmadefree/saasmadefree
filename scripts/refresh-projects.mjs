// scripts/refresh-projects.mjs
//
// Rafraîchit les faits GitHub des projets open source (data/projects/*.json) :
// étoiles, dernier commit, date de création, archivage, et la licence quand
// elle manque. Ces champs viennent de l'API GitHub et de nulle part ailleurs.
// La logique vit dans scripts/lib/github-stats.mjs.
//
// - Tout ou rien : si un appel échoue (limite de débit, 5xx, réseau), le
//   script s'arrête AVANT d'écrire le moindre fichier.
// - Un dépôt renommé prend son nouveau nom (`full_name` renvoyé par l'API).
// - Un projet sans `repo` (forge non GitHub) reste sans stats : on ne devine
//   jamais un dépôt depuis la homepage.
// - Sort en code 1 si un dépôt est introuvable (404), ou si plusieurs projets
//   pointent sur le même dépôt et que --merge-duplicates n'est pas passé.
//
// Usage (depuis la racine du dépôt) :
//   GITHUB_TOKEN=… node scripts/refresh-projects.mjs [--merge-duplicates]
//
// --merge-duplicates : garde le slug sans suffixe numérique ni préfixe
// d'organisation, unit les catégories, réécrit les `alternatives` des fiches
// et supprime le fichier du doublon.

import { readFile, readdir, writeFile, unlink, access } from 'node:fs/promises';
import { join } from 'node:path';
import {
  refreshAll, findDuplicateRepos, pickKeeper, mergeDuplicate, serializeProject,
} from './lib/github-stats.mjs';
import { LANGS } from './lib/load-data.mjs';

const STALE_DAYS = 365;

async function readDir(dir) {
  const out = new Map();
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  for (const f of files) {
    out.set(f.replace(/\.json$/, ''), { text: await readFile(join(dir, f), 'utf8') });
  }
  for (const entry of out.values()) entry.value = JSON.parse(entry.text);
  return out;
}

const exists = (path) => access(path).then(() => true, () => false);
const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

const args = new Set(process.argv.slice(2));
for (const arg of args) {
  if (arg !== '--merge-duplicates') {
    console.error(`Option inconnue : ${arg}`);
    process.exit(2);
  }
}
const mergeDuplicates = args.has('--merge-duplicates');

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error('GITHUB_TOKEN manquant : sans jeton, la limite de 60 appels/heure ne suffit pas.');
  process.exit(2);
}

const root = process.cwd();
const projectsDir = join(root, 'data', 'projects');
const toolsDir = join(root, 'data', 'tools');
const today = new Date().toISOString().slice(0, 10);

const projectFiles = await readDir(projectsDir);
const toolFiles = await readDir(toolsDir);
const originalProjects = new Map([...projectFiles].map(([slug, f]) => [slug, f.value]));

let refreshed;
try {
  refreshed = await refreshAll(originalProjects, { fetch, token, today, concurrency: 8 });
} catch (err) {
  console.error(`Échec, aucun fichier écrit — ${err.message}`);
  process.exit(1);
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
          console.error(`Fusion ${drop} → ${keep} refusée, aucun fichier écrit : ${path} existe, ` +
            'le texte se fusionne à la main.');
          process.exit(1);
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

// Écriture : seulement ce qui change, après que tout a réussi.
let written = 0;
for (const [slug, project] of projects) {
  const text = serializeProject(project);
  if (text !== projectFiles.get(slug)?.text) {
    await writeFile(join(projectsDir, `${slug}.json`), text, 'utf8');
    written++;
  }
}
for (const slug of changedTools) {
  await writeFile(join(toolsDir, `${slug}.json`), JSON.stringify(tools.get(slug), null, 2) + '\n', 'utf8');
}
for (const slug of deleted) await unlink(join(projectsDir, `${slug}.json`));

// Bilan.
const all = [...projects.values()];
const withStats = all.filter((p) => p.stats);
const archived = withStats.filter((p) => p.stats.archived).map((p) => p.slug);
const stale = withStats
  .filter((p) => !p.stats.archived && daysBetween(p.stats.lastCommit, today) > STALE_DAYS)
  .map((p) => `${p.slug} (${p.stats.lastCommit})`);
const noRepo = all.filter((p) => !p.repo).map((p) => p.slug);

const list = (items) => (items.length ? `\n    ${items.join('\n    ')}` : '');
console.log(`${withStats.length} projet(s) rafraîchi(s), ${written} fichier(s) projet écrit(s), au ${today}.`);
console.log(`  Renommés : ${renamed.length}${list(renamed)}`);
console.log(`  Archivés : ${archived.length}${list(archived)}`);
console.log(`  Sans commit depuis plus de ${STALE_DAYS} jours : ${stale.length}${list(stale)}`);
console.log(`  Sans dépôt GitHub (pas de stats) : ${noRepo.length}${list(noRepo)}`);
if (merges.length) console.log(`  Doublons fusionnés : ${merges.length}${list(merges)}`);

let failed = false;
if (refreshed.missing.length > 0) {
  const lines = refreshed.missing.map((slug) => `${slug} (${originalProjects.get(slug).repo})`);
  console.error(`Dépôt(s) introuvable(s) (404), stats retirées : ${lines.length}${list(lines)}`);
  failed = true;
}
if (duplicates.length > 0 && !mergeDuplicates) {
  const lines = duplicates.map(({ repo, slugs }) => `${repo} : ${slugs.join(', ')} (garder ${pickKeeper(slugs, repo)})`);
  console.error(`Projets en double sur un même dépôt : ${lines.length}${list(lines)}`);
  console.error('Relancer avec --merge-duplicates pour les fusionner.');
  failed = true;
}
if (failed) process.exit(1);
