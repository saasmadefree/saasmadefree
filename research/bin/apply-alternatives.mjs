// Mode « write-data » du brief research/briefs/format-haiku.md, appliqué de
// façon déterministe : les règles y sont entièrement fixées, un script les
// tient mieux qu'un agent, et plusieurs outils partagent les mêmes projets
// (OpenProject pour Trello, Asana, Smartsheet…), ce qui interdit de répartir
// l'écriture entre agents.
//
//   node research/bin/apply-alternatives.mjs write <slug>…   (avant refresh:projects)
//   node research/bin/apply-alternatives.mjs resort <slug>…  (après refresh:projects)
//
// write  : crée les projets retenus absents de data/projects, complète les
//          existants, écrit tool.alternatives (fit final, ordre par fit).
// resort : retire des alternatives les projets AJOUTÉS par ce lot qui se
//          révèlent archivés ou inactifs (> 365 j), supprime leur fichier
//          s'il n'est plus cité, puis trie chaque groupe de fit par étoiles.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const TODAY = new Date().toISOString().slice(0, 10);
const FIT_ORDER = { full: 0, partial: 1, niche: 2 };
const MAX_ALTS = 8;
const PROJECT_KEYS = ['slug', 'name', 'homepage', 'repo', 'license', 'selfHostable', 'selfHostableCheckedOn',
  'selfHostableSource', 'hosted', 'deploy', 'stack', 'categories', 'stats', 'markets'];

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const writeJson = (p, v) => fs.writeFileSync(path.join(ROOT, p), `${JSON.stringify(v, null, 2)}\n`);
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const ordered = (obj) => Object.fromEntries(PROJECT_KEYS.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
const categories = readJson('data/categories.json');

// Journal de ce que ce lot a ajouté : resort ne retire que ces entrées-là.
const LOG = 'research/decisions/_applied.json';
const applied = exists(LOG) ? readJson(LOG) : {};

function daysSince(iso) {
  return Math.round((Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / 86400000);
}

// Une offre hébergée n'est reprise que si elle est complète selon le schéma :
// « existe » sans prix vérifié ne peut pas s'afficher honnêtement, la valeur
// reste alors inconnue ({ exists: false } sans date → « — » sur le site).
function validHosted(h) {
  if (!h) return null;
  if (h.exists === true) return (typeof h.priceFrom === 'number' && /^[A-Z]{3}$/.test(h.currency ?? '') && h.source && h.checkedOn)
    ? { exists: true, priceFrom: h.priceFrom, currency: h.currency, source: h.source, checkedOn: h.checkedOn } : null;
  if (h.exists === false) return h.source && h.checkedOn ? { exists: false, source: h.source, checkedOn: h.checkedOn } : { exists: false };
  return null;
}

function projectFromResearch(c) {
  const p = {
    slug: c.slug,
    name: c.name,
    homepage: c.homepage ?? (c.repo ? `https://github.com/${c.repo}` : undefined),
    repo: c.repo ?? null,
    selfHostable: c.selfHostable?.value ?? true,
    hosted: validHosted(c.hosted) ?? { exists: false },
    deploy: [...new Set(c.deploy ?? [])],
    stack: [...new Set(c.stack ?? [])],
    categories: [...new Set((c.categories ?? []).filter((k) => categories[k]))],
    markets: ['en'],
  };
  if (c.selfHostable?.checkedOn && c.selfHostable?.source) {
    p.selfHostableCheckedOn = c.selfHostable.checkedOn;
    p.selfHostableSource = c.selfHostable.source;
  }
  return p;
}

function write(slug) {
  const tool = readJson(`data/tools/${slug}.json`);
  const research = Object.fromEntries(readJson(`research/alternatives/${slug}.json`).map((c) => [c.slug, c]));
  const decisions = readJson(`research/decisions/${slug}.json`).results.filter((r) => r.kept);
  const added = [];

  const alts = [];
  for (const d of decisions) {
    const c = research[d.slug];
    const file = `data/projects/${d.slug}.json`;
    if (!exists(file)) {
      const p = projectFromResearch(c);
      if (p.categories.length === 0) p.categories = [tool.category];
      writeJson(file, ordered(p));
      added.push(d.slug);
    } else {
      const p = readJson(file);
      p.categories = [...new Set([...p.categories, ...(c.categories ?? []).filter((k) => categories[k]), tool.category])];
      if (c.name && c.name !== p.name) p.name = c.name; // renommage : le nom suit, jamais le slug (Ruling 36)
      if (c.selfHostable?.checkedOn && c.selfHostable?.source && !p.selfHostableCheckedOn) {
        p.selfHostable = c.selfHostable.value;
        p.selfHostableCheckedOn = c.selfHostable.checkedOn;
        p.selfHostableSource = c.selfHostable.source;
      }
      if (validHosted(c.hosted)?.checkedOn && !p.hosted?.checkedOn) p.hosted = validHosted(c.hosted);
      writeJson(file, ordered(p));
    }
    const fit = d.decision >= 0.8 ? c.fitGuess : 'partial';
    alts.push({ project: d.slug, fit });
  }
  // Les alternatives déjà en place que le tri n'a pas revues restent : la
  // recherche les traitait comme candidates, une absence n'est pas un rejet.
  for (const a of tool.alternatives ?? []) {
    if (!alts.some((x) => x.project === a.project) && !research[a.project]) alts.push(a);
  }
  alts.sort((a, b) => FIT_ORDER[a.fit] - FIT_ORDER[b.fit]);
  tool.alternatives = alts.slice(0, MAX_ALTS);
  writeJson(`data/tools/${slug}.json`, tool);
  // Un second passage ne doit pas effacer ce qu'un premier a ajouté.
  applied[slug] = { added: [...new Set([...(applied[slug]?.added ?? []), ...added])], checkedOn: TODAY };
  console.log(`${slug}: ${tool.alternatives.length} alternatives (${added.length} nouveaux projets)`);
}

function resort(slug) {
  const tool = readJson(`data/tools/${slug}.json`);
  const added = new Set(applied[slug]?.added ?? []);
  const dropped = [];
  tool.alternatives = tool.alternatives.filter((a) => {
    if (!added.has(a.project)) return true;
    const s = readJson(`data/projects/${a.project}.json`).stats;
    const dead = s && (s.archived || daysSince(s.lastCommit) > 365);
    if (dead) dropped.push(a.project);
    return !dead;
  });
  const stars = (slugP) => readJson(`data/projects/${slugP}.json`).stats?.stars ?? -1;
  tool.alternatives.sort((a, b) => FIT_ORDER[a.fit] - FIT_ORDER[b.fit] || stars(b.project) - stars(a.project));
  writeJson(`data/tools/${slug}.json`, tool);
  for (const p of dropped) {
    const cited = fs.readdirSync(path.join(ROOT, 'data/tools')).some((f) =>
      (readJson(`data/tools/${f}`).alternatives ?? []).some((a) => a.project === p));
    if (!cited) fs.unlinkSync(path.join(ROOT, `data/projects/${p}.json`));
  }
  console.log(`${slug}: ${tool.alternatives.length} alternatives${dropped.length ? `, retirés (inactifs) : ${dropped.join(', ')}` : ''}`);
}

const [mode, ...slugs] = process.argv.slice(2);
for (const slug of slugs) (mode === 'write' ? write : resort)(slug);
if (mode === 'write') writeJson(LOG, applied);
