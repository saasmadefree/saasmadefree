// scripts/migrate-prior-art.mjs
//
// Migration unique : `priorArt` des fiches → projets open source partagés
// (data/projects/<slug>.json) et `alternatives` dans chaque fiche. Conservé
// pour l'historique et parce qu'il documente d'où viennent les projets de
// départ. La logique vit dans scripts/lib/prior-art.mjs.
//
// - Un projet par dépôt GitHub (dédoublonné sans tenir compte de la casse) ;
//   hors GitHub, un projet par URL, avec `repo: null`.
// - `homepage` = l'URL citée telle quelle : c'est ce qui permet au feed v1 de
//   ressortir un `priorArt` identique (scripts/lib/feed.mjs).
// - Chaque fiche reçoit `alternatives: [{ project, fit: "partial" }]`.
// - Aucun texte data/i18n/*/projects/ n'est créé : ces projets restent non
//   publiables tant que personne ne les a rédigés.
//
// Idempotent : relancé, il ne trouve plus aucun `priorArt` et n'écrit rien.
//
// Usage : node scripts/migrate-prior-art.mjs   (depuis la racine du dépôt)

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { migratePriorArt } from './lib/prior-art.mjs';

async function readDir(dir) {
  const out = new Map();
  let files = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  for (const f of files) out.set(f.replace(/\.json$/, ''), JSON.parse(await readFile(join(dir, f), 'utf8')));
  return out;
}

const json = (value) => JSON.stringify(value, null, 2) + '\n';

const dataDir = join(process.cwd(), 'data');
const tools = await readDir(join(dataDir, 'tools'));
const projects = await readDir(join(dataDir, 'projects'));

const result = migratePriorArt(tools, projects);

if (result.projects.size > 0) await mkdir(join(dataDir, 'projects'), { recursive: true });
for (const [slug, project] of result.projects) {
  await writeFile(join(dataDir, 'projects', `${slug}.json`), json(project), 'utf8');
}
for (const [slug, tool] of result.tools) {
  await writeFile(join(dataDir, 'tools', `${slug}.json`), json(tool), 'utf8');
}

const s = result.stats;
console.log(
  `${s.toolsMigrated} fiche(s) migrée(s), ${s.citations} citation(s) priorArt → ` +
  `${s.projectsCreated} projet(s) créé(s), ${s.projectsReused} réutilisé(s), ` +
  `${s.duplicatesMerged} doublon(s) fusionné(s), ${s.slugCollisions} collision(s) de slug.`
);
