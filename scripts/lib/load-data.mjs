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

  return { tools, i18n, ui, agents, categories };
}
