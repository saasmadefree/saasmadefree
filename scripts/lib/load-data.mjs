import { readFile, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export const LANGS = ['en', 'fr', 'es', 'de', 'it', 'pt', 'nl'];

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function listJson(dir) {
  try {
    const entries = await readdir(dir);
    return entries.filter((f) => f.endsWith('.json')).sort();
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export function compileValidators(schemaDir) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const load = (name) => JSON.parse(readFileSync(join(schemaDir, name), 'utf8'));
  return {
    tool: ajv.compile(load('tool.schema.json')),
    toolI18n: ajv.compile(load('tool-i18n.schema.json')),
    agent: ajv.compile(load('agent.schema.json')),
    sponsors: ajv.compile(load('sponsors.schema.json')),
  };
}

export async function loadData(rootDir) {
  const dataDir = join(rootDir, 'data');

  const tools = new Map();
  for (const file of await listJson(join(dataDir, 'tools'))) {
    const tool = await readJson(join(dataDir, 'tools', file));
    tools.set(file.replace(/\.json$/, ''), tool);
  }

  const i18n = new Map();
  const ui = new Map();
  for (const lang of LANGS) {
    const langDir = join(dataDir, 'i18n', lang);
    for (const file of await listJson(join(langDir, 'tools'))) {
      const slug = file.replace(/\.json$/, '');
      i18n.set(`${lang}/${slug}`, await readJson(join(langDir, 'tools', file)));
    }
    try {
      ui.set(lang, await readJson(join(langDir, 'ui.json')));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  const agents = await readJson(join(dataDir, 'agents.json'));
  const categories = await readJson(join(dataDir, 'categories.json'));

  // Fichier optionnel : un dépôt fraîchement cloné sans sponsors doit builder.
  let sponsors = { placements: [] };
  try {
    sponsors = await readJson(join(dataDir, 'sponsors.json'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  // Un fichier présent mais mal formé doit casser le build, pas le vider en
  // silence. Scénario réel : un opérateur ajoute un placement payé et écrit
  // "placement" au singulier à la racine. Avec un `?? []` en aval, le build
  // se terminait normalement et publiait les vingt-huit slots comme libres —
  // alors que le sponsor a payé. `npm run validate` l'attrape, mais
  // `npm run build` ne lance pas la validation, et le hook de déploiement
  // quotidien prévu pour la phase commerce ne passera pas par la CI.
  //
  // L'absence du fichier reste légitime et donne toujours { placements: [] }.
  if (!Array.isArray(sponsors?.placements)) {
    // On nomme les clés lues plutôt que le contenu : c'est ce qui rend la
    // faute de frappe évidente, et ça reste borné même sur un gros fichier.
    const found = sponsors && typeof sponsors === 'object'
      ? `clés lues à la racine : ${JSON.stringify(Object.keys(sponsors))}`
      : `racine lue : ${JSON.stringify(sponsors)}`;
    throw new Error(
      `data/sponsors.json : la racine doit porter une clé "placements" contenant un tableau (${found}). ` +
      'Sans elle, tous les emplacements seraient publiés comme libres, sponsors payants compris.'
    );
  }

  return { tools, i18n, ui, agents, categories, sponsors };
}
