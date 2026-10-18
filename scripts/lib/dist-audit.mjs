// Contrôles SEO du site construit (Task A8) : sitemaps, canonical, hreflang,
// liens internes et nombre de fichiers. Chaque contrôle rend la liste de ses
// problèmes (vide = conforme), pour que tests/site-indexing.test.mjs les
// passe sur le vrai dist/ ET sur un faux dist/ fabriqué exprès avec des
// défauts — un contrôle qui ne trouve jamais rien ne prouve rien.
//
// Les URL sont résolues comme Cloudflare Pages les sert (pageFile) :
// `/a/b` → a/b.html, `/a/b/` → a/b/index.html. Une URL qui ne trouve son
// fichier qu'après une redirection 308 compte comme absente : canonical,
// sitemap et liens internes doivent viser l'URL servie en 200.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pageFile } from './site-seo.mjs';
import { SITE_ORIGIN } from './site-data.mjs';

/** Limite de la spec D12 : Cloudflare refuse un déploiement de plus de
 *  20 000 fichiers en Free ; on s'arrête 1 000 avant. */
export const MAX_DIST_FILES = 19000;

export function listFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, out);
    else out.push(full);
  }
  return out;
}

/** Fichier HTML (chemin relatif à dist/, en « / ») → URL qu'il sert. */
export function urlOfFile(rel) {
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel.slice(0, -'.html'.length)}`;
}

/** Le fichier de `dir` qui répond en 200 à une URL interne, ou null. Un
 *  fichier non HTML (asset, feed, robots.txt) est servi par son chemin. */
export function servedFile(dir, url) {
  const path = url.split(/[?#]/)[0];
  if (!path.startsWith('/')) return null;
  if (/\.[a-z0-9]+$/i.test(path) && !path.endsWith('.html')) {
    const direct = join(dir, ...path.split('/').filter(Boolean));
    return existsSync(direct) ? direct : null;
  }
  const page = join(dir, ...pageFile(path).split('/'));
  return existsSync(page) ? page : null;
}

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const pathOf = (url) => (url.startsWith(SITE_ORIGIN) ? url.slice(SITE_ORIGIN.length) : null);

/**
 * Lit dist/ une fois : chaque page HTML (hors feed) avec ses balises de
 * <head>, et les sitemaps cités par sitemap-index.xml.
 */
export function readDist(dir) {
  const files = listFiles(dir);
  const pages = new Map();
  for (const file of files) {
    const rel = file.slice(dir.length + 1).split('\\').join('/');
    if (!rel.endsWith('.html') || rel.startsWith('feed/')) continue;
    const html = readFileSync(file, 'utf8');
    const end = html.indexOf('</head>');
    const head = end === -1 ? html : html.slice(0, end);
    pages.set(urlOfFile(rel), {
      rel,
      html,
      noindex: /<meta name="robots" content="[^"]*noindex/.test(head),
      canonical: head.match(/<link rel="canonical" href="([^"]+)">/)?.[1] ?? null,
      hreflang: [...head.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)]
        .map((m) => ({ lang: m[1], href: m[2] })),
    });
  }
  const indexPath = join(dir, 'sitemap-index.xml');
  const indexXml = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';
  const sitemaps = locs(indexXml).map((url) => {
    const name = (pathOf(url) ?? url).replace(/^\//, '');
    const file = join(dir, name);
    const xml = existsSync(file) ? readFileSync(file, 'utf8') : null;
    return { name, xml, urls: xml ? locs(xml) : [] };
  });
  return { dir, fileCount: files.length, pages, indexXml, sitemaps };
}

/** Index : au moins un sitemap, un par type connu, tous présents. */
export function sitemapIndexProblems({ sitemaps }) {
  if (sitemaps.length === 0) return ['sitemap-index.xml ne cite aucun sitemap'];
  return sitemaps.flatMap(({ name, xml }) => [
    ...(/^sitemap-(pages|tools|projects|compare|lists)\.xml$/.test(name) ? [] : [`${name} : nom de sitemap inattendu`]),
    ...(xml === null ? [`${name} : cité par l'index mais absent`] : []),
  ]);
}

/** Pages noindex présentes dans un sitemap (spec D7). */
export function noindexInSitemaps({ pages, sitemaps }) {
  return sitemaps.flatMap(({ name, urls }) => urls
    .filter((url) => pages.get(pathOf(url))?.noindex)
    .map((url) => `${name} : ${url} est noindex`));
}

/** URL de sitemap sans fichier servi en 200, hors du site, ou en double. */
export function sitemapUrlProblems({ pages, sitemaps }) {
  const seen = new Set();
  const problems = [];
  for (const { name, urls } of sitemaps) {
    for (const url of urls) {
      const path = pathOf(url);
      if (path === null) problems.push(`${name} : ${url} hors de ${SITE_ORIGIN}`);
      else if (!pages.has(path)) problems.push(`${name} : ${url} sans page construite`);
      if (seen.has(url)) problems.push(`${name} : ${url} en double`);
      seen.add(url);
    }
  }
  return problems;
}

/** Canonical ≠ l'URL de la page (la 404 n'a pas d'URL propre, exclue). */
export function canonicalProblems({ pages }) {
  return [...pages]
    .filter(([url]) => url !== '/404')
    .filter(([url, page]) => page.canonical !== `${SITE_ORIGIN}${url}`)
    .map(([url, page]) => `${url} : canonical ${page.canonical}`);
}

/** hreflang : symétrique, seulement entre versions indexables, un x-default
 *  parmi les versions citées, la page se cite elle-même (Ruling 29). */
export function hreflangProblems({ pages }) {
  const problems = [];
  for (const [url, page] of pages) {
    const self = `${SITE_ORIGIN}${url}`;
    const cited = page.hreflang.filter((h) => h.lang !== 'x-default');
    const xDefault = page.hreflang.filter((h) => h.lang === 'x-default');
    if (page.noindex && page.hreflang.length) problems.push(`${url} : noindex mais porte du hreflang`);
    if (page.hreflang.length && !cited.some((h) => h.href === self)) problems.push(`${url} : ne se cite pas lui-même`);
    if (cited.length && xDefault.length !== 1) problems.push(`${url} : ${xDefault.length} x-default`);
    if (xDefault[0] && !cited.some((h) => h.href === xDefault[0].href)) problems.push(`${url} : x-default hors des versions citées`);
    for (const { lang, href } of cited) {
      const target = pages.get(pathOf(href));
      if (!target) { problems.push(`${url} → ${href} : page absente`); continue; }
      if (target.noindex) problems.push(`${url} → ${href} : version noindex citée`);
      if (!href.startsWith(`${SITE_ORIGIN}/${lang}/`)) problems.push(`${url} → ${href} : langue ${lang} incohérente`);
      if (!target.hreflang.some((h) => h.href === self)) problems.push(`${url} → ${href} : pas de lien retour`);
    }
  }
  return problems;
}

/** Liens internes (href/src commençant par un seul « / ») sans fichier
 *  servi en 200. */
export function brokenInternalLinks({ dir, pages }) {
  const broken = new Set();
  for (const [url, page] of pages) {
    for (const m of page.html.matchAll(/\s(?:href|src)="(\/(?!\/)[^"]*)"/g)) {
      const target = m[1].replaceAll('&amp;', '&');
      if (!servedFile(dir, target)) broken.add(`${url} → ${target}`);
    }
  }
  return [...broken];
}
