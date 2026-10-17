import { SITE_ORIGIN } from './site-data.mjs';

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
 *  affirmée que s'il n'existe aucune version hébergée payante — sinon on ne
 *  dit rien du prix plutôt que d'en inventer un.
 *  @param {Array<{name:string,url:string,applicationCategory:string,hosted?:{exists:boolean}}>} items */
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
      if (entry.hosted?.exists === false) item.offers = { '@type': 'Offer', price: 0, priceCurrency: 'USD' };
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
