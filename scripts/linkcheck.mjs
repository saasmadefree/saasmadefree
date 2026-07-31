import { loadData } from './lib/load-data.mjs';

/**
 * Vérifie que chaque URL citée dans les fiches répond vraiment.
 *
 * Le schéma ne contrôle que la *forme* d'une URI : un chemin de dépôt inventé
 * de bonne foi (`github.com/bramw/baserow` au lieu de `baserow/baserow`) passe
 * la CI et se publie tel quel. Trois liens morts ont été trouvés ainsi, dont
 * deux dans des fiches parmi les plus anciennes du catalogue.
 *
 * Délibérément hors de `npm run validate` : ce contrôle dépend du réseau et
 * d'hébergeurs qui limitent le débit. En faire une porte de CI la rendrait
 * instable, et une CI instable finit par être ignorée. À lancer à la main
 * avant une publication, ou périodiquement.
 *
 * Usage : npm run linkcheck
 */
const CONCURRENCY = 12;
const TIMEOUT_MS = 12000;
const UA = 'Mozilla/5.0 (compatible; saasmadefree-linkcheck)';

const data = await loadData(process.cwd());

// Une même URL est souvent citée par plusieurs fiches : on ne la teste qu'une
// fois, mais on garde toutes les fiches qui la citent pour le rapport.
const citedBy = new Map();
const cite = (url, where) => {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return;
  if (!citedBy.has(url)) citedBy.set(url, []);
  citedBy.get(url).push(where);
};

for (const [slug, tool] of data.tools) {
  cite(tool.pricing?.source, `data/tools/${slug}.json pricing.source`);
  for (const [i, art] of (tool.priorArt ?? []).entries()) {
    cite(art?.url, `data/tools/${slug}.json priorArt[${i}] (${art?.name ?? '?'})`);
  }
}
for (const agent of data.agents) {
  cite(agent.homepage, `data/agents.json[${agent.id}] homepage`);
  cite(agent.docs, `data/agents.json[${agent.id}] docs`);
}

const urls = [...citedBy.keys()];
console.log(`${urls.length} URL distincte(s) à vérifier…\n`);

async function check(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // HEAD d'abord : beaucoup d'hôtes le refusent (405/403), on retombe alors
    // sur GET. Un 405 sur HEAD ne dit rien sur l'existence de la ressource.
    let res = await fetch(url, {
      method: 'HEAD', redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': UA },
    });
    if (res.status === 405 || res.status === 403 || res.status === 501) {
      res = await fetch(url, {
        method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': UA },
      });
    }
    return { url, status: res.status, finalUrl: res.url };
  } catch (err) {
    return { url, status: 0, error: err.name === 'AbortError' ? 'timeout' : String(err.message) };
  } finally {
    clearTimeout(timer);
  }
}

const results = [];
const queue = [...urls];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) results.push(await check(queue.shift()));
  })
);

const broken = results.filter((r) => r.status === 0 || r.status >= 400);
const ok = results.length - broken.length;

for (const r of broken.sort((a, b) => a.url.localeCompare(b.url))) {
  console.error(`  ${String(r.status || r.error).padEnd(8)} ${r.url}`);
  for (const where of citedBy.get(r.url)) console.error(`           ↳ ${where}`);
}

console.log(`\n${ok} OK, ${broken.length} en échec.`);
if (broken.length > 0) process.exit(1);
