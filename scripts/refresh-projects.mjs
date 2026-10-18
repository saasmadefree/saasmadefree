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
//   GITHUB_TOKEN=… node scripts/refresh-projects.mjs [--merge-duplicates] [--dry-run]
//
// --merge-duplicates : garde le slug sans suffixe numérique ni préfixe
// d'organisation, unit les catégories, réécrit les `alternatives` des fiches
// et supprime le fichier du doublon.
//
// --dry-run : interroge GitHub et calcule tout exactement comme sans
// l'option, puis affiche un bilan par slug (missing, archived, stale > 365 j,
// renamed, ok) et n'écrit RIEN. Le jeton reste obligatoire.
//
// Le corps du script vit dans scripts/lib/refresh-projects-run.mjs (testé
// avec un faux fetch et un faux système de fichiers).

import { readFile, readdir, writeFile, unlink, access } from 'node:fs/promises';
import { runRefreshProjects } from './lib/refresh-projects-run.mjs';

const code = await runRefreshProjects({
  argv: process.argv.slice(2),
  env: process.env,
  root: process.cwd(),
  fetch,
  fs: { readFile, readdir, writeFile, unlink, access },
  today: new Date().toISOString().slice(0, 10),
  log: (line) => console.log(line),
  error: (line) => console.error(line),
});
process.exitCode = code;
