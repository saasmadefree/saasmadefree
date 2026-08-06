import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeDomain } from './validate-rules.mjs';

// Chemin public (dans dist/) de l'icône de repli, partagée par toutes les
// fiches dont la récupération a échoué — un seul fichier, jamais une par
// outil manquant, pour ne pas gonfler dist/ inutilement.
export const PLACEHOLDER_PATH = '/assets/favicons/_placeholder.svg';

// Icône neutre, dessinée à la main : un carré arrondi et un point central,
// volontairement abstrait pour ne jamais se faire passer pour la vraie
// marque d'un outil. Générée en pur texte : aucune dépendance binaire, donc
// rien à embarquer dans le dépôt.
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-hidden="true">
  <rect x="2" y="2" width="60" height="60" rx="14" fill="#9c9a8d"/>
  <circle cx="32" cy="32" r="10" fill="#faf9f6"/>
</svg>
`;

async function readFileSafe(path) {
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

async function fetchFaviconBytes(domain, timeoutMs, fetchImpl) {
  if (typeof fetchImpl !== 'function') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) return null;
    const contentType = res.headers?.get?.('content-type') ?? '';
    if (contentType && !contentType.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;
    return buf;
  } catch {
    // Hors ligne, DNS mort, timeout, service qui répond en 4xx/5xx : dans
    // tous les cas, on ne casse jamais le build pour une icône — voir la
    // règle "never let a failed fetch break the build".
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Récupère au moment du build une icône par outil (le domaine "canonique"
 * étant `domains[0]`), la met en cache sous un dossier ignoré par git pour
 * qu'une reconstruction locale ne refasse jamais la requête réseau, et copie
 * le résultat dans le dossier de sortie du site. Un échec de récupération
 * retombe sur une icône de repli neutre partagée — jamais un outil sans image
 * ni une image d'un autre outil.
 *
 * @param {Map<string, object>} tools
 * @param {object} opts
 * @param {string} opts.cacheDir - dossier de cache, ignoré par git
 * @param {string} opts.outDir - dossier de sortie public (ex. dist/assets/favicons)
 * @param {number} [opts.timeoutMs]
 * @param {typeof fetch} [opts.fetchImpl] - injectable pour les tests
 * @param {string[]} [opts.extraDomains] - domaines hors catalogue (les sponsors, sans fiche ni slug)
 * @returns {Promise<{bySlug: Record<string,string>, byDomain: Record<string,string>, stats: {total:number, cached:number, fetched:number, placeholder:number}}>}
 */
export async function fetchFavicons(
  tools,
  { cacheDir, outDir, timeoutMs = 8000, fetchImpl = globalThis.fetch, extraDomains = [] }
) {
  await mkdir(cacheDir, { recursive: true });
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, '_placeholder.svg'), PLACEHOLDER_SVG, 'utf8');

  const bySlug = {};
  const byDomain = {};
  const stats = { total: 0, cached: 0, fetched: 0, placeholder: 0 };

  // Un domaine n'est résolu qu'une fois par build, même s'il sert à la fois une
  // fiche et un sponsor. Le cache disque l'évitait déjà d'un build à l'autre ;
  // cette table l'évite à l'intérieur d'un même build.
  const bytesByDomain = new Map();

  // cached/fetched/placeholder comptent des domaines résolus, pas des entités :
  // incrémentés une seule fois ici, derrière la garde de mémoïsation, pour
  // qu'un domaine partagé par un outil et un sponsor (ou par plusieurs outils)
  // ne soit jamais compté deux fois — y compris quand la résolution échoue.
  async function bytesFor(domain) {
    if (bytesByDomain.has(domain)) return bytesByDomain.get(domain);
    const cachePath = join(cacheDir, `${domain}.png`);
    let bytes = await readFileSafe(cachePath);
    if (bytes) {
      stats.cached += 1;
    } else {
      bytes = await fetchFaviconBytes(domain, timeoutMs, fetchImpl);
      if (bytes) {
        await writeFile(cachePath, bytes);
        stats.fetched += 1;
      } else {
        stats.placeholder += 1;
      }
    }
    bytesByDomain.set(domain, bytes);
    return bytes;
  }

  // total compte des entités (un outil, un domaine de sponsor), pas des
  // domaines : deux entités qui partagent un domaine comptent chacune pour 1
  // dans total, même si bytesFor ne les résout qu'une fois.
  for (const tool of tools.values()) {
    stats.total += 1;
    const bytes = await bytesFor(normalizeDomain(tool.domains[0]));
    if (bytes) {
      await writeFile(join(outDir, `${tool.slug}.png`), bytes);
      bySlug[tool.slug] = `/assets/favicons/${tool.slug}.png`;
    } else {
      bySlug[tool.slug] = PLACEHOLDER_PATH;
    }
  }

  // Domaines hors catalogue (les sponsors) : indexés par domaine et non par
  // slug, puisqu'ils n'ont pas de fiche. Le nom de fichier reprend le domaine,
  // déjà unique et normalisé. Un sponsor qui est aussi un outil du catalogue
  // ne déclenche donc aucun téléchargement supplémentaire.
  for (const raw of extraDomains) {
    const domain = normalizeDomain(raw);
    stats.total += 1;
    const bytes = await bytesFor(domain);
    if (bytes) {
      await writeFile(join(outDir, `${domain}.png`), bytes);
      byDomain[domain] = `/assets/favicons/${domain}.png`;
    } else {
      byDomain[domain] = PLACEHOLDER_PATH;
    }
  }

  return { bySlug, byDomain, stats };
}
