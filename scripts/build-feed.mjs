import { mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { loadData, compileValidators, LANGS } from './lib/load-data.mjs';
import { validateAll } from './lib/validate-rules.mjs';
import { buildIndex, buildToolRecord, buildSlugList, buildAgentIdList, FEED_VERSION } from './lib/feed.mjs';
import {
  RAIL_SLOTS, TAPE_TOP_SLOTS, TAPE_BOTTOM_SLOTS,
  RAIL_LADDER_USD, TAPE_LADDER_USD,
} from './lib/site-sponsors.mjs';

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

// Vide dist/ avant d'écrire — ici, dans le PREMIER maillon de `npm run build`,
// pour que tout ce que la chaîne écrit ensuite (feed, public/, site) survive.
// Sans nettoyage, le build n'ajoute et n'écrase jamais : une fiche retirée du
// catalogue garde sa page indéfiniment, avec son ancien prix (Notion, retiré
// sur demande, est ainsi resté publié et servi en 200 pendant des jours). Ce
// nettoyage a longtemps vécu dans build-site.mjs, en DEUXIÈME position : il
// effaçait alors le feed et le public/ que ce script venait d'écrire — c'est
// ce qui a servi des 404 sur /privacy en production. Il vit désormais ici,
// après la validation (des données invalides ne doivent pas vider dist/), et
// build-site ne nettoie plus rien.
await rm(OUT, { recursive: true, force: true });

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

await writeFile(
  join('worker', 'src', 'sponsor-inventory.generated.mjs'),
  `// Généré par scripts/build-feed.mjs — ne pas modifier à la main.\n` +
  `//\n` +
  `// Le Worker facture ce que le site annonce. Recopier les barèmes ici à la\n` +
  `// main ferait diverger les deux le jour où l'un des deux change, et un\n` +
  `// acheteur serait débité d'un montant différent de celui affiché.\n` +
  `export const RAIL_SLOTS = ${JSON.stringify(RAIL_SLOTS)};\n` +
  `export const TAPE_TOP_SLOTS = ${JSON.stringify(TAPE_TOP_SLOTS)};\n` +
  `export const TAPE_BOTTOM_SLOTS = ${JSON.stringify(TAPE_BOTTOM_SLOTS)};\n` +
  `export const RAIL_LADDER_USD = ${JSON.stringify(RAIL_LADDER_USD)};\n` +
  `export const TAPE_LADDER_USD = ${JSON.stringify(TAPE_LADDER_USD)};\n` +
  `export const ALL_SLOTS = [...RAIL_SLOTS, ...TAPE_TOP_SLOTS, ...TAPE_BOTTOM_SLOTS];\n`,
  'utf8'
);

await cp('public', OUT, { recursive: true });

console.log(`Feed écrit dans ${OUT}/feed/${FEED_VERSION}/ — ${data.tools.size} outil(s).`);
