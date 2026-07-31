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

// Ensemble des URL citées comme *preuve d'un prix*. Elles méritent plus qu'un
// code 200 : voir checkPriceEvidence plus bas.
const priceUrls = new Set();
for (const tool of data.tools.values()) {
  if (typeof tool.pricing?.source === 'string') priceUrls.add(tool.pricing.source);
}

const deep = process.argv.includes('--deep');
console.log(`${urls.length} URL distincte(s) à vérifier${deep ? ' (mode --deep)' : ''}…\n`);

// Un chiffre précédé ou suivi d'un symbole/code monétaire. Volontairement
// large : on ne cherche pas à retrouver NOTRE prix — les pages localisent,
// arrondissent et changent — seulement à savoir si la page parle d'argent.
const PRICE_RE = /[$€£]\s?\d|\d\s?(?:USD|EUR|GBP|\$|€|£)/i;

/**
 * Un code 200 ne prouve pas qu'une citation est correcte.
 *
 * `whereby.com/pricing` répond 200 : Whereby transforme tout chemin inconnu en
 * salle de réunion, si bien que cette URL ouvre une salle nommée « pricing »,
 * sans un seul prix. Elle a longtemps figuré comme source de prix, et ce
 * script la déclarait saine.
 *
 * En mode --deep, on télécharge donc les pages citées comme preuve d'un prix
 * et on signale celles qui ne mentionnent aucun montant. C'est un *signal*,
 * pas un verdict : beaucoup de grilles tarifaires sont rendues en JavaScript
 * et sortiront d'ici sans montant alors qu'elles sont parfaitement valides.
 * D'où le classement en avertissement, jamais en échec.
 */
async function checkPriceEvidence(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': UA },
    });
    if (!res.ok) return null;
    const body = await res.text();
    return PRICE_RE.test(body) ? null : 'aucun montant dans la page';
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

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
    const out = { url, status: res.status, finalUrl: res.url };
    if (deep && res.ok && priceUrls.has(url)) {
      out.warning = await checkPriceEvidence(url);
    }
    return out;
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

const suspect = results.filter((r) => r.warning);
if (suspect.length > 0) {
  console.log('\nÀ relire — page atteignable mais sans montant visible :');
  for (const r of suspect.sort((a, b) => a.url.localeCompare(b.url))) {
    console.log(`  ${r.warning.padEnd(28)} ${r.url}`);
    for (const where of citedBy.get(r.url)) console.log(`           ↳ ${where}`);
  }
  console.log('  (une grille tarifaire rendue en JavaScript sort d’ici sans montant : à vérifier à l’œil, pas à corriger en aveugle)');
}

console.log(`\n${ok} OK, ${broken.length} en échec${deep ? `, ${suspect.length} à relire` : ''}.`);
if (broken.length > 0) process.exit(1);
