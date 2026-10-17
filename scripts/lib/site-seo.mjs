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
