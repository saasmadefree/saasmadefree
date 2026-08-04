import { mkdir, writeFile, cp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { loadData, compileValidators, LANGS } from './lib/load-data.mjs';
import { validateAll } from './lib/validate-rules.mjs';
import { buildIndex, buildToolRecord, buildSlugList, buildAgentIdList, FEED_VERSION } from './lib/feed.mjs';

const OUT = 'dist';

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

const today = new Date().toISOString().slice(0, 10);
const data = await loadData(process.cwd());
const errors = validateAll(data, compileValidators('schema'), today);
if (errors.length > 0) {
  console.error('Build interrompu : les données ne sont pas valides. Lancer `npm run validate`.');
  process.exit(1);
}

const feedRoot = join(OUT, 'feed', FEED_VERSION);

await writeJson(join(feedRoot, 'index.json'), buildIndex(data.tools));
await writeJson(join('extension', 'data', 'index.json'), buildIndex(data.tools));
await writeJson(join(feedRoot, 'agents.json'), data.agents);
await writeJson(join(feedRoot, 'categories.json'), data.categories);

for (const lang of LANGS) {
  for (const [slug, tool] of data.tools) {
    const entry = data.i18n.get(`${lang}/${slug}`);
    if (!entry) continue;
    await writeJson(join(feedRoot, lang, 'tools', `${slug}.json`), buildToolRecord(tool, entry, lang));
    const promptPath = join(feedRoot, lang, 'prompts', `${slug}.txt`);
    await mkdir(dirname(promptPath), { recursive: true });
    await writeFile(promptPath, entry.prompt, 'utf8');
  }
  const ui = data.ui.get(lang);
  if (ui) await writeJson(join(feedRoot, lang, 'ui.json'), ui);
}

await mkdir(join('worker', 'src'), { recursive: true });
await writeFile(
  join('worker', 'src', 'slugs.generated.mjs'),
  `// Généré par scripts/build-feed.mjs — ne pas modifier à la main.\nexport const SLUGS = new Set(${JSON.stringify(buildSlugList(data.tools))});\n`,
  'utf8'
);

await writeFile(
  join('worker', 'src', 'agents.generated.mjs'),
  `// Généré par scripts/build-feed.mjs — ne pas modifier à la main.\n` +
  `export const AGENT_IDS = new Set(${JSON.stringify(buildAgentIdList(data.agents))});\n` +
  `export const SITE_LANGS = new Set(${JSON.stringify([...LANGS].sort())});\n`,
  'utf8'
);

await cp('public', OUT, { recursive: true });

console.log(`Feed écrit dans ${OUT}/feed/${FEED_VERSION}/ — ${data.tools.size} outil(s).`);
