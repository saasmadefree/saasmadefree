// Passage de `priorArt` (liste libre {name, url, license?} recopiée dans chaque
// fiche) à des projets open source partagés : data/projects/<slug>.json, et
// `alternatives: [{ project, fit }]` dans la fiche.
//
// Utilisé par scripts/migrate-prior-art.mjs (migration unique des 530 fiches)
// et par scripts/import-upstream.mjs (fiches importées après coup, dont
// l'amont fournit encore un priorArt). Fonctions pures : aucune lecture ni
// écriture de fichier ici.

const GITHUB_REPO = /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i;

/** `owner/name` d'une URL GitHub (sous-chemins tolérés), sinon null. */
export function parseGithubRepo(url) {
  const m = GITHUB_REPO.exec(String(url));
  if (!m) return null;
  const name = m[2].replace(/\.git$/i, '');
  return name ? `${m[1]}/${name}` : null;
}

export function kebab(text) {
  return String(text)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '');
}

/**
 * Clé de dédoublonnage : le dépôt GitHub en minuscules (GitHub ignore la
 * casse : `KeePassXreboot/keepassxc` et `keepassxreboot/keepassxc` sont le
 * même dépôt). Hors GitHub, l'URL elle-même, en minuscules et sans `/` final.
 */
function identityOf(url) {
  const repo = parseGithubRepo(url);
  if (repo) return `repo:${repo.toLowerCase()}`;
  return `url:${String(url).toLowerCase().replace(/\/+$/, '')}`;
}

function projectIdentity(project) {
  return project.repo ? `repo:${project.repo.toLowerCase()}` : identityOf(project.homepage);
}

/** La valeur la plus citée ; à égalité, la plus courte, puis la première
 *  rencontrée. La plus courte, parce qu'une citation longue est souvent un
 *  nom recopié avec son contexte (« Screaming Frog alternatives: SEO
 *  Macroscope » face à « SEO Macroscope »). */
function mostCited(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best;
  let bestCount = 0;
  for (const [v, n] of counts) {
    if (n > bestCount || (n === bestCount && String(v).length < String(best).length)) {
      best = v;
      bestCount = n;
    }
  }
  return best;
}

/** Remplace la clé `priorArt` par `alternatives`, à la même position. */
function withAlternatives(tool, alternatives) {
  const out = {};
  for (const [key, value] of Object.entries(tool)) {
    if (key === 'priorArt') {
      if (alternatives.length > 0) out.alternatives = alternatives;
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Convertit le `priorArt` des fiches en projets.
 *
 * - `tools` : Map<slug, fiche>. Seules les fiches qui portent encore un
 *   `priorArt` sont touchées ; les autres sont ignorées.
 * - `projects` : Map<slug, projet> déjà sur disque. Un projet existant dont le
 *   dépôt (ou, hors GitHub, l'URL) correspond est réutilisé tel quel, seule
 *   sa liste `categories` gagne les catégories des nouvelles fiches.
 *
 * Renvoie les fiches et projets à écrire (nouveaux ou modifiés seulement),
 * plus des compteurs pour le rapport. Déterministe : même entrée, même sortie,
 * quel que soit l'ordre d'insertion des Map.
 */
export function migratePriorArt(tools, projects) {
  const existingByIdentity = new Map();
  for (const project of projects.values()) existingByIdentity.set(projectIdentity(project), project);

  // 1. Regrouper les citations par projet réel.
  const groups = new Map();
  let citations = 0;
  const toolSlugs = [...tools.keys()].filter((slug) => Array.isArray(tools.get(slug).priorArt)).sort();
  for (const slug of toolSlugs) {
    const tool = tools.get(slug);
    for (const item of tool.priorArt) {
      citations += 1;
      const id = identityOf(item.url);
      if (!groups.has(id)) groups.set(id, { id, order: groups.size, items: [], categories: new Set() });
      const group = groups.get(id);
      group.items.push(item);
      group.categories.add(tool.category);
    }
  }

  // 2. Attribuer un slug à chaque groupe. Un projet existant garde le sien.
  // Les nouveaux sont servis dans l'ordre : dépôts GitHub d'abord, puis les
  // plus cités, puis l'ordre de rencontre. En cas de collision (deux dépôts
  // différents qui portent le même nom), le suivant prend le préfixe de son
  // propriétaire ; hors GitHub, un suffixe numérique.
  const taken = new Set(projects.keys());
  const slugOf = new Map();
  for (const group of groups.values()) {
    const existing = existingByIdentity.get(group.id);
    if (existing) slugOf.set(group.id, existing.slug);
  }
  const fresh = [...groups.values()]
    .filter((g) => !slugOf.has(g.id))
    .sort((x, y) => {
      const xRepo = x.id.startsWith('repo:') ? 0 : 1;
      const yRepo = y.id.startsWith('repo:') ? 0 : 1;
      return (xRepo - yRepo) || (y.items.length - x.items.length) || (x.order - y.order);
    });
  let collisions = 0;
  for (const group of fresh) {
    const url = mostCited(group.items.map((item) => item.url));
    const repo = parseGithubRepo(url);
    const base = repo ? kebab(repo.split('/')[1]) : kebab(mostCited(group.items.map((item) => item.name)));
    let slug = base;
    if (taken.has(slug)) {
      collisions += 1;
      slug = repo ? kebab(`${repo.split('/')[0]}-${base}`) : base;
      for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
    }
    taken.add(slug);
    slugOf.set(group.id, slug);
  }

  // 3. Écrire les projets.
  const projectsOut = new Map();
  for (const group of groups.values()) {
    const slug = slugOf.get(group.id);
    const existing = projects.get(slug);
    if (existing) {
      const categories = [...new Set([...existing.categories, ...group.categories])].sort();
      if (categories.join() !== [...existing.categories].sort().join()) {
        projectsOut.set(slug, { ...existing, categories });
      }
      continue;
    }
    // Nom, URL et licence : la forme la plus citée. Ce sont celles que le
    // feed v1 ressort dans `priorArt` ; prendre la majorité garde identique
    // l'enregistrement du plus grand nombre de fiches.
    const homepage = mostCited(group.items.map((item) => item.url));
    const license = mostCited(group.items.map((item) => item.license).filter(Boolean));
    const project = {
      slug,
      name: mostCited(group.items.map((item) => item.name)),
      homepage,
      repo: parseGithubRepo(homepage),
    };
    if (license) project.license = license;
    Object.assign(project, {
      selfHostable: true,
      hosted: { exists: false },
      deploy: [],
      stack: [],
      categories: [...group.categories].sort(),
      markets: ['en'],
    });
    projectsOut.set(slug, project);
  }

  // 4. Réécrire les fiches.
  const toolsOut = new Map();
  for (const slug of toolSlugs) {
    const tool = tools.get(slug);
    const alternatives = [];
    for (const item of tool.priorArt) {
      const project = slugOf.get(identityOf(item.url));
      if (!alternatives.some((alt) => alt.project === project)) alternatives.push({ project, fit: 'partial' });
    }
    toolsOut.set(slug, withAlternatives(tool, alternatives));
  }

  const created = [...projectsOut.keys()].filter((slug) => !projects.has(slug)).length;
  return {
    tools: toolsOut,
    projects: projectsOut,
    stats: {
      toolsMigrated: toolsOut.size,
      citations,
      projectsCreated: created,
      projectsReused: groups.size - created,
      duplicatesMerged: citations - groups.size,
      slugCollisions: collisions,
    },
  };
}

/**
 * `priorArt` du feed v1, dérivé de `alternatives` : même forme et même ordre
 * de clés qu'avant la migration ({ name, url, license? }), pour l'extension.
 */
export function derivePriorArt(tool, projects) {
  const out = [];
  for (const alt of tool.alternatives ?? []) {
    const project = projects?.get(alt.project);
    if (!project) continue;
    const item = { name: project.name, url: project.homepage };
    if (project.license) item.license = project.license;
    out.push(item);
  }
  return out;
}
