// scripts/lib/github-stats.mjs
//
// Faits chiffrés des projets open source (`stats`), lus sur l'API GitHub et
// jamais ailleurs : un LLM ne renseigne aucun de ces champs (spec §5).
//
// Tout est pur ou prend son `fetch` en paramètre, pour être testé sur les
// fixtures de tests/fixtures/github/. Les entrées/sorties disque vivent dans
// scripts/refresh-projects.mjs.

const API = 'https://api.github.com';

// Ordre des clés dans data/projects/*.json : celui du schéma. Une clé inconnue
// (que le schéma refuserait de toute façon) part à la fin, sans être perdue.
const PROJECT_KEYS = [
  'slug', 'name', 'homepage', 'repo', 'license', 'selfHostable', 'selfHostableCheckedOn', 'selfHostableSource',
  'hosted', 'deploy', 'stack', 'categories', 'stats', 'markets',
];
const STATS_KEYS = ['stars', 'lastCommit', 'createdAt', 'archived', 'checkedOn'];
const FIT_RANK = { full: 0, partial: 1, niche: 2 };

const day = (iso) => String(iso).slice(0, 10);

/** Réponse de GET /repos/{owner}/{name} → faits utiles. Licence `null` si
 *  absente ou NOASSERTION (GitHub n'a pas su l'identifier). */
export function parseRepoResponse(json) {
  const spdx = json.license?.spdx_id;
  return {
    fullName: json.full_name,
    stars: json.stargazers_count,
    createdAt: day(json.created_at),
    archived: json.archived === true,
    license: spdx && spdx !== 'NOASSERTION' ? spdx : null,
  };
}

/** Réponse de GET /repos/{repo}/commits?per_page=1 → date du dernier commit
 *  (date du committer : le moment où il est arrivé sur la branche). */
export function lastCommitDate(json) {
  const date = Array.isArray(json) ? json[0]?.commit?.committer?.date : undefined;
  if (!date) throw new Error('réponse commits sans aucun commit');
  return day(date);
}

async function githubGet(fetch, token, path) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'saasmadefree-refresh-projects',
    },
  });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) {
    const limited = res.status === 429
      || (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0');
    if (limited) {
      const reset = res.headers.get('x-ratelimit-reset');
      const when = reset ? ` (réinitialisation ${new Date(Number(reset) * 1000).toISOString()})` : '';
      throw new Error(`GitHub : limite de débit atteinte sur ${path}${when}`);
    }
    throw new Error(`GitHub : HTTP ${res.status} sur ${path}`);
  }
  return { json: await res.json() };
}

function withoutStats(project) {
  const { stats: _ignored, ...rest } = project;
  return rest;
}

const githubUrl = (repo) => `https://github.com/${repo}`;

/**
 * Rafraîchit `stats` d'un projet. N'écrit que `stats`, `license` si elle est
 * absente, et `repo` (+ `homepage` quand ce n'était que l'URL GitHub de
 * l'ancien nom) si le dépôt a été renommé : GitHub suit les renommages par
 * redirection et renvoie le nouveau `full_name`.
 *
 * Renvoie `{ project, missing }`. Dépôt introuvable (404) : `stats` retiré,
 * `missing: true`. Toute autre erreur (limite de débit comprise) lève une
 * exception : jamais de stats partielles.
 */
export async function refreshProject(project, { fetch, token, today }) {
  if (!project.repo) {
    // Pas de dépôt GitHub connu : pas de stats, et on ne devine rien depuis
    // la homepage.
    return { project: withoutStats(project), missing: false };
  }

  const repoRes = await githubGet(fetch, token, `/repos/${project.repo}`);
  if (repoRes.notFound) return { project: withoutStats(project), missing: true };
  const facts = parseRepoResponse(repoRes.json);
  const canonical = facts.fullName || project.repo;

  const commitsRes = await githubGet(fetch, token, `/repos/${canonical}/commits?per_page=1`);
  if (commitsRes.notFound) return { project: withoutStats(project), missing: true };
  const lastCommit = lastCommitDate(commitsRes.json);

  const out = { ...project };
  if (canonical !== project.repo) {
    // Un changement de casse seul ne touche pas la homepage : les URL GitHub
    // ignorent la casse, et la homepage est l'URL que le feed v1 expose dans
    // `priorArt` (contrat de l'extension, tests/feed.test.mjs).
    const realRename = canonical.toLowerCase() !== project.repo.toLowerCase();
    if (realRename && project.homepage.toLowerCase() === githubUrl(project.repo).toLowerCase()) {
      out.homepage = githubUrl(canonical);
    }
    out.repo = canonical;
  }
  if (!out.license && facts.license) out.license = facts.license;
  out.stats = {
    stars: facts.stars,
    lastCommit,
    createdAt: facts.createdAt,
    archived: facts.archived,
    checkedOn: today,
  };
  return { project: out, missing: false };
}

/**
 * Rafraîchit tous les projets, `concurrency` à la fois. Tout ou rien : si un
 * seul projet échoue, la promesse est rejetée et rien n'est renvoyé, donc
 * l'appelant n'écrit aucun fichier.
 */
export async function refreshAll(projects, { fetch, token, today, concurrency = 8 }) {
  const entries = [...projects];
  const results = new Array(entries.length);
  let next = 0;
  let failed = false;
  async function worker() {
    while (!failed && next < entries.length) {
      const i = next++;
      try {
        results[i] = await refreshProject(entries[i][1], { fetch, token, today });
      } catch (err) {
        failed = true;
        throw new Error(`${entries[i][0]} : ${err.message}`, { cause: err });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));

  const out = new Map();
  const missing = [];
  entries.forEach(([slug], i) => {
    out.set(slug, results[i].project);
    if (results[i].missing) missing.push(slug);
  });
  return { projects: out, missing };
}

/** Projets qui partagent un même dépôt (sans tenir compte de la casse). */
export function findDuplicateRepos(projects) {
  const byRepo = new Map();
  for (const [slug, project] of projects) {
    if (!project.repo) continue;
    const key = project.repo.toLowerCase();
    if (!byRepo.has(key)) byRepo.set(key, []);
    byRepo.get(key).push(slug);
  }
  return [...byRepo]
    .filter(([, slugs]) => slugs.length > 1)
    .map(([repo, slugs]) => ({ repo, slugs: [...slugs].sort() }))
    .sort((a, b) => a.repo.localeCompare(b.repo));
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Le slug à garder : sans suffixe numérique (`-2`), sans préfixe
 *  d'organisation (`ggml-org-…`), puis le plus court, puis l'alphabétique. */
export function pickKeeper(slugs, repo) {
  const ownerPrefix = `${slugify(String(repo).split('/')[0] ?? '')}-`;
  const penalty = (slug) =>
    (/-\d+$/.test(slug) ? 2 : 0) + (ownerPrefix !== '-' && slug.startsWith(ownerPrefix) ? 1 : 0);
  return [...slugs].sort((a, b) => penalty(a) - penalty(b) || a.length - b.length || a.localeCompare(b))[0];
}

const union = (a = [], b = []) => [...new Set([...a, ...b])];

/**
 * Fusionne le projet `drop` dans `keep` : catégories, marchés, déploiements et
 * stack unis, licence reprise si `keep` n'en a pas ; chaque fiche qui citait
 * `drop` cite désormais `keep`, et une fiche qui citait les deux garde une
 * seule entrée, à la place de la première, avec le meilleur `fit`.
 * Pur : renvoie de nouvelles Map, ne touche pas à celles reçues.
 */
export function mergeDuplicate({ projects, tools }, keep, drop) {
  for (const slug of [keep, drop]) {
    if (!projects.has(slug)) throw new Error(`projet inconnu : ${slug}`);
  }
  if (keep === drop) throw new Error(`fusion de ${keep} avec lui-même`);

  const kept = structuredClone(projects.get(keep));
  const dropped = projects.get(drop);
  kept.categories = union(kept.categories, dropped.categories);
  kept.markets = union(kept.markets, dropped.markets);
  kept.deploy = union(kept.deploy, dropped.deploy);
  kept.stack = union(kept.stack, dropped.stack);
  if (!kept.license && dropped.license) kept.license = dropped.license;

  const outProjects = new Map();
  for (const [slug, project] of projects) {
    if (slug === drop) continue;
    outProjects.set(slug, slug === keep ? kept : project);
  }

  const outTools = new Map();
  const changedTools = [];
  for (const [slug, tool] of tools) {
    const alts = tool.alternatives;
    if (!alts?.some((alt) => alt.project === drop)) {
      outTools.set(slug, tool);
      continue;
    }
    const merged = [];
    for (const alt of alts) {
      const project = alt.project === drop ? keep : alt.project;
      const existing = merged.find((m) => m.project === project);
      if (!existing) {
        merged.push({ ...alt, project });
      } else if ((FIT_RANK[alt.fit] ?? 9) < (FIT_RANK[existing.fit] ?? 9)) {
        existing.fit = alt.fit;
      }
    }
    outTools.set(slug, { ...tool, alternatives: merged });
    changedTools.push(slug);
  }

  return { projects: outProjects, tools: outTools, changedTools, dropped: drop };
}

function ordered(obj, keys) {
  const out = {};
  for (const key of keys) if (key in obj) out[key] = obj[key];
  for (const key of Object.keys(obj)) if (!(key in out)) out[key] = obj[key];
  return out;
}

/** JSON d'un projet : 2 espaces, `\n` final, clés dans l'ordre du schéma. */
export function serializeProject(project) {
  const p = ordered(project, PROJECT_KEYS);
  if (p.stats) p.stats = ordered(p.stats, STATS_KEYS);
  return JSON.stringify(p, null, 2) + '\n';
}
