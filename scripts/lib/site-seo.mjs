import { SITE_ORIGIN } from './site-data.mjs';
import { noHostedOfferChecked } from './site-alternatives.mjs';

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'SaaS Made Free',
    url: `${SITE_ORIGIN}/`,
    logo: `${SITE_ORIGIN}/icon.png`,
    sameAs: ['https://github.com/saasmadefree/saasmadefree'],
  };
}

export function websiteJsonLd(homePath) {
  const url = `${SITE_ORIGIN}${homePath}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url,
    name: 'SaaS Made Free',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${url}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function itemListJsonLd(tools) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: tools.map((tool, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: tool.name,
      url: `${SITE_ORIGIN}${tool.path}`,
    })),
  };
}

/** Les alternatives libres d'une fiche, en ItemList de SoftwareApplication.
 *  Chaque élément porte déjà son URL finale (page projet indexable, ou site
 *  du projet) : aucune langue à résoudre ici. Une offre gratuite n'est
 *  affirmée que si l'absence de version hébergée payante a été VÉRIFIÉE
 *  (`hosted.checkedOn`) — `{ exists: false }` sans date est une valeur par
 *  défaut de la migration, et on ne dit alors rien du prix plutôt que d'en
 *  inventer un (finding 2).
 *  @param {Array<{name:string,url:string,applicationCategory:string,hosted?:{exists:boolean,checkedOn?:string}}>} items */
export function softwareItemListJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((entry, i) => {
      const item = {
        '@type': 'SoftwareApplication',
        name: entry.name,
        url: entry.url,
        applicationCategory: entry.applicationCategory,
        operatingSystem: 'Web',
      };
      if (noHostedOfferChecked(entry)) item.offers = { '@type': 'Offer', price: 0, priceCurrency: 'USD' };
      return { '@type': 'ListItem', position: i + 1, item };
    }),
  };
}

/** La page elle-même : sa date de dernière modification réelle (relevé de
 *  prix ou de chiffres GitHub le plus récent), pas la date du build. */
export function webPageJsonLd({ path, name, description, lang, dateModified }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url: `${SITE_ORIGIN}${path}`,
    name,
    description,
    inLanguage: lang,
    dateModified,
  };
}

export function faqPageJsonLd(faq) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: { '@type': 'Answer', text: entry.a },
    })),
  };
}

export function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      item: `${SITE_ORIGIN}${item.href}`,
    })),
  };
}

/**
 * Fichier de dist/ qui sert une URL de page, selon les règles de Cloudflare
 * Pages : `/a/b` est servi en 200 par `a/b.html` (et `/a/b/` y redirige en
 * 308), `/a/b/` par `a/b/index.html`. Écrire `/en/tools/x` en
 * `en/tools/x/index.html` faisait répondre l'URL canonique par une 308 vers
 * `/en/tools/x/` : canonical, sitemap et hreflang visaient une redirection.
 * Le build écrit chaque page par cette fonction, et les tests sur dist/
 * résolvent les liens par elle : une seule règle des deux côtés.
 * @param {string} path  chemin absolu de la page, sans query ni ancre
 * @returns {string} chemin relatif dans dist/, séparé par des « / »
 */
export function pageFile(path) {
  if (!path.startsWith('/')) throw new TypeError(`pageFile : chemin absolu attendu, reçu ${path}`);
  if (path.endsWith('/')) return `${path.slice(1)}index.html`;
  return `${path.slice(1)}.html`;
}

/**
 * Versions de langue d'une page : une entrée par langue où la page est
 * générée, avec sa porte D7. C'est la forme que toutes les pages passent en
 * `alternates` à renderLayout, qui en tire le sélecteur de langue (toutes les
 * versions générées) et le hreflang (les seules versions indexables, voir
 * hreflangFor).
 * @param {string[]} langs  langues où la page est générée
 * @param {(lang: string) => string} pathOf
 * @param {(lang: string) => boolean} [indexableOf]  porte de chaque version ; toujours vraie par défaut
 * @returns {Array<{ lang: string, path: string, indexable: boolean }>}
 */
export function languageVersions(langs, pathOf, indexableOf = () => true) {
  return langs.map((lang) => ({ lang, path: pathOf(lang), indexable: indexableOf(lang) === true }));
}

/**
 * Règle hreflang unique de tout le site (Ruling 29). Les liens hreflang ne
 * relient que des versions générées ET indexables :
 * - une version noindex (robots contient « noindex ») ne porte aucun lien,
 *   ni x-default ;
 * - une version indexable ne cite que les versions indexables, elle comprise ;
 * - x-default = la version en si elle est indexable, sinon la première
 *   version indexable. Un `xDefaultPath` demandé n'est gardé que s'il vise
 *   une de ces versions.
 * Une version sans porte décidée (`indexable` absent) compte comme
 * indexable : les fiches et l'accueil le sont toujours (Ruling 2).
 * Comme toutes les versions d'une page reçoivent les mêmes `alternates`, la
 * relation est symétrique : si A cite B, B cite A.
 * @param {{ alternates?: Array<{lang:string,path:string,indexable?:boolean}>,
 *   xDefaultPath?: string|null, robots?: string|null }} opts
 * @returns {{ links: Array<{lang:string,path:string}>, xDefault: string|null }}
 */
export function hreflangFor({ alternates = [], xDefaultPath = null, robots = null }) {
  if (robots && /noindex/i.test(robots)) return { links: [], xDefault: null };
  const links = alternates.filter((a) => a.indexable !== false).map(({ lang, path }) => ({ lang, path }));
  if (links.length === 0) return { links: [], xDefault: null };
  const xDefault = xDefaultPath && links.some((l) => l.path === xDefaultPath)
    ? xDefaultPath
    : (links.find((l) => l.lang === 'en') ?? links[0]).path;
  return { links, xDefault };
}

/**
 * Entrées de sitemap d'une série de pages dont la porte D7 a été décidée
 * (catégories, collections, hub) : seules les pages indexables y entrent ;
 * une page noindex,follow reste hors sitemap. Une page sans décision
 * (`indexable` non booléen) casse le build plutôt que d'entrer par défaut.
 * @param {Array<{ path: string, indexable: boolean, lastmod?: string }>} pages
 * @returns {Array<{ path: string, lastmod?: string }>}
 */
export function listSitemapEntries(pages) {
  return pages
    .filter((page) => {
      if (typeof page.indexable !== 'boolean') {
        throw new TypeError(`listSitemapEntries : ${page.path} n'a pas de porte indexable décidée.`);
      }
      return page.indexable;
    })
    .map(({ path, lastmod }) => (lastmod ? { path, lastmod } : { path }));
}

export function buildSitemap(pages) {
  const urls = pages
    .map(({ path, lastmod }) => {
      const loc = `${SITE_ORIGIN}${path}`;
      const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
      return `  <url>\n    <loc>${loc}</loc>${lastmodTag}\n  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Types de sitemap, dans l'ordre de l'index (Task A8). `pages` : accueils et
 *  pages fixes (sponsor, stats, confidentialité) ; `lists` : catégories,
 *  collections, hub A–Z et répertoire des catégories. */
export const SITEMAP_KINDS = ['pages', 'tools', 'projects', 'compare', 'lists'];

/**
 * Sitemaps découpés par type, et leur index. Les entrées doivent déjà avoir
 * passé leur porte D7 (listSitemapEntries pour les listes) : aucune page
 * noindex n'arrive ici. Un type sans URL n'a pas de fichier, et l'index ne le
 * cite pas. La lastmod d'un fichier dans l'index est la plus récente de ses
 * URL ; sans aucune date, on n'en met pas — jamais la date du build.
 * @param {Array<{ kind: string, path: string, lastmod?: string }>} entries
 * @returns {{ files: Array<{ name: string, xml: string, count: number, lastmod: string|null }>, index: string }}
 */
export function buildSitemaps(entries) {
  const seen = new Set();
  const byKind = new Map(SITEMAP_KINDS.map((kind) => [kind, []]));
  for (const entry of entries) {
    if (!byKind.has(entry.kind)) {
      throw new TypeError(`buildSitemaps : type inconnu « ${entry.kind} » pour ${entry.path} (attendu : ${SITEMAP_KINDS.join(', ')}).`);
    }
    if (seen.has(entry.path)) throw new Error(`buildSitemaps : ${entry.path} en double dans les sitemaps.`);
    seen.add(entry.path);
    byKind.get(entry.kind).push(entry);
  }
  const files = [...byKind]
    .filter(([, pages]) => pages.length > 0)
    .map(([kind, pages]) => {
      const dates = pages.map((p) => p.lastmod).filter(Boolean);
      return {
        name: `sitemap-${kind}.xml`,
        xml: buildSitemap(pages),
        count: pages.length,
        lastmod: dates.length ? dates.reduce((max, d) => (d > max ? d : max)) : null,
      };
    });
  const items = files
    .map(({ name, lastmod }) => {
      const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
      return `  <sitemap>\n    <loc>${SITE_ORIGIN}/${name}</loc>${lastmodTag}\n  </sitemap>`;
    })
    .join('\n');
  const index = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
  return { files, index };
}
