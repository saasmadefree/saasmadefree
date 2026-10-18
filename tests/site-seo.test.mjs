import { describe, it, expect } from 'vitest';
import {
  organizationJsonLd, websiteJsonLd, itemListJsonLd, faqPageJsonLd,
  breadcrumbJsonLd, buildSitemap, softwareItemListJsonLd, webPageJsonLd, listSitemapEntries,
  languageVersions, hreflangFor, pageFile, buildSitemaps, SITEMAP_KINDS,
} from '../scripts/lib/site-seo.mjs';

describe('organizationJsonLd', () => {
  it('pointe vers le dépôt public réel, rien d’inventé', () => {
    const data = organizationJsonLd();
    expect(data['@type']).toBe('Organization');
    expect(data.sameAs).toEqual(['https://github.com/saasmadefree/saasmadefree']);
  });
});

describe('websiteJsonLd', () => {
  it('construit une SearchAction dont la cible est vraiment la page de recherche du même chemin', () => {
    const data = websiteJsonLd('/fr/');
    expect(data.url).toBe('https://saasmadefree.com/fr/');
    expect(data.potentialAction.target).toBe('https://saasmadefree.com/fr/?q={search_term_string}');
  });
});

describe('itemListJsonLd', () => {
  it('numérote les positions à partir de 1, dans l’ordre reçu', () => {
    const data = itemListJsonLd([
      { name: 'Notion', path: '/en/tools/notion' },
      { name: 'Obsidian', path: '/en/tools/obsidian' },
    ]);
    expect(data.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(data.itemListElement[0].url).toBe('https://saasmadefree.com/en/tools/notion');
  });
});

describe('faqPageJsonLd', () => {
  it('mappe q/a vers Question/acceptedAnswer', () => {
    const data = faqPageJsonLd([{ q: 'Q1', a: 'A1' }]);
    expect(data.mainEntity[0]).toEqual({
      '@type': 'Question', name: 'Q1', acceptedAnswer: { '@type': 'Answer', text: 'A1' },
    });
  });
});

describe('breadcrumbJsonLd', () => {
  it('construit des URLs absolues à partir de chemins relatifs', () => {
    const data = breadcrumbJsonLd([{ label: 'Directory', href: '/en/' }]);
    expect(data.itemListElement[0].item).toBe('https://saasmadefree.com/en/');
  });
});

describe('softwareItemListJsonLd', () => {
  const items = [
    { name: 'Listmonk', url: 'https://listmonk.app', applicationCategory: 'Newsletters',
      hosted: { exists: false, checkedOn: '2026-10-12', source: 'https://listmonk.app' } },
    { name: 'Mautic', url: 'https://saasmadefree.com/en/oss/mautic', applicationCategory: 'Newsletters',
      hosted: { exists: true, priceFrom: 9, currency: 'USD', source: 'https://x', checkedOn: '2026-10-01' } },
  ];

  it('une ItemList de SoftwareApplication, positions à partir de 1, dans l’ordre reçu', () => {
    const data = softwareItemListJsonLd(items, 'en');
    expect(data['@type']).toBe('ItemList');
    expect(data.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(data.itemListElement[0].item).toEqual({
      '@type': 'SoftwareApplication', name: 'Listmonk', url: 'https://listmonk.app',
      applicationCategory: 'Newsletters', operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
    });
  });

  it('pas d’offre gratuite affirmée quand une version hébergée payante existe', () => {
    const data = softwareItemListJsonLd(items, 'en');
    expect(data.itemListElement[1].item.offers).toBeUndefined();
  });

  // Finding 2 : hosted: {exists: false} sans date est la valeur par défaut de
  // la migration, pas un fait. Aucun prix 0 n'en sort.
  it('pas d’offre gratuite affirmée quand « pas d’offre hébergée » n’a jamais été vérifié', () => {
    const data = softwareItemListJsonLd([
      { name: 'Keila', url: 'https://keila.io', applicationCategory: 'Newsletters', hosted: { exists: false } },
      { name: 'Postal', url: 'https://postalserver.io', applicationCategory: 'Newsletters' },
    ], 'en');
    expect(data.itemListElement[0].item.offers).toBeUndefined();
    expect(data.itemListElement[1].item.offers).toBeUndefined();
  });
});

describe('webPageJsonLd', () => {
  it('porte dateModified, l’URL absolue et la langue', () => {
    const data = webPageJsonLd({
      path: '/en/tools/mailchimp', name: 'T', description: 'D', lang: 'en', dateModified: '2026-10-16',
    });
    expect(data).toMatchObject({
      '@type': 'WebPage', url: 'https://saasmadefree.com/en/tools/mailchimp',
      name: 'T', description: 'D', inLanguage: 'en', dateModified: '2026-10-16',
    });
  });
});

describe('buildSitemap', () => {
  it('inclut lastmod seulement pour les pages qui en fournissent un', () => {
    const xml = buildSitemap([{ path: '/en/' }, { path: '/en/tools/notion', lastmod: '2026-07-30' }]);
    expect(xml).toContain('<loc>https://saasmadefree.com/en/</loc>');
    expect(xml).toContain('<lastmod>2026-07-30</lastmod>');
    expect(xml.match(/<lastmod>/g)?.length).toBe(1);
  });
});

// Porte D7 des pages de liste (catégories, collections, hub) : une page
// noindex ne va jamais dans le sitemap.
describe('listSitemapEntries', () => {
  it('keeps indexable pages only, with their lastmod when present', () => {
    const pages = [
      { path: '/en/categories/a', indexable: true },
      { path: '/en/collections/self-hosted', indexable: false },
      { path: '/en/alternatives/', indexable: true, lastmod: '2026-10-17' },
    ];
    expect(listSitemapEntries(pages)).toEqual([
      { path: '/en/categories/a' },
      { path: '/en/alternatives/', lastmod: '2026-10-17' },
    ]);
  });

  it('a noindex page never reaches the sitemap XML', () => {
    const xml = buildSitemap(listSitemapEntries([{ path: '/fr/categories/tiny', indexable: false }]));
    expect(xml).not.toContain('/fr/categories/tiny');
  });

  it('refuses a page whose gate was not decided', () => {
    expect(() => listSitemapEntries([{ path: '/en/x' }])).toThrow(/indexable/);
  });
});

// Ruling 29 : une seule règle hreflang pour tous les types de page. Seules
// les versions générées ET indexables s'annoncent entre elles ; une version
// noindex ne porte aucun lien et n'est citée par aucune autre langue.
describe('languageVersions + hreflangFor', () => {
  // Fixture : la collection existe en en et fr, mais la version fr a moins
  // de 3 éléments, donc elle est noindex.
  const versions = languageVersions(['en', 'fr'], (l) => `/${l}/collections/self-hosted`, (l) => l === 'en');

  it('décrit chaque version générée avec sa porte', () => {
    expect(versions).toEqual([
      { lang: 'en', path: '/en/collections/self-hosted', indexable: true },
      { lang: 'fr', path: '/fr/collections/self-hosted', indexable: false },
    ]);
  });

  it('la version indexable ne cite pas la version noindex', () => {
    const { links, xDefault } = hreflangFor({ alternates: versions, robots: null });
    expect(links).toEqual([{ lang: 'en', path: '/en/collections/self-hosted' }]);
    expect(xDefault).toBe('/en/collections/self-hosted');
  });

  it('la version noindex ne porte aucun lien hreflang, ni x-default', () => {
    expect(hreflangFor({ alternates: versions, robots: 'noindex,follow' })).toEqual({ links: [], xDefault: null });
  });

  it('x-default = en tant que en est indexable, sinon la première version indexable', () => {
    const enOff = languageVersions(['en', 'fr', 'de'], (l) => `/${l}/x`, (l) => l !== 'en');
    expect(hreflangFor({ alternates: enOff }).xDefault).toBe('/fr/x');
    const all = languageVersions(['fr', 'en'], (l) => `/${l}/x`);
    expect(hreflangFor({ alternates: all }).xDefault).toBe('/en/x');
  });

  it('un x-default demandé hors des versions indexables est ignoré', () => {
    const { xDefault } = hreflangFor({ alternates: versions, xDefaultPath: '/fr/collections/self-hosted' });
    expect(xDefault).toBe('/en/collections/self-hosted');
  });

  it('une version sans porte décidée compte comme indexable (fiches, accueil)', () => {
    const { links } = hreflangFor({ alternates: [{ lang: 'en', path: '/en/' }, { lang: 'fr', path: '/fr/' }] });
    expect(links.map((l) => l.lang)).toEqual(['en', 'fr']);
  });

  it('aucune version : aucun lien', () => {
    expect(hreflangFor({ alternates: [] })).toEqual({ links: [], xDefault: null });
  });

  it('symétrie : si A cite B, alors B cite A', () => {
    const many = languageVersions(['en', 'fr', 'de'], (l) => `/${l}/y`, (l) => l !== 'de');
    const cited = new Map(many.map((v) => [v.lang, hreflangFor({
      alternates: many, robots: v.indexable ? null : 'noindex,follow',
    }).links.map((l) => l.lang)]));
    for (const [from, tos] of cited) {
      for (const to of tos) expect(cited.get(to)).toContain(from);
    }
    expect(cited.get('de')).toEqual([]);
  });
});

// Règle de Cloudflare Pages : `/a/b` est servi par `a/b.html`, `/a/b/` par
// `a/b/index.html`. Écrire une URL sans barre finale en dossier la faisait
// répondre par une 308, alors que canonical et sitemap la citent.
describe('pageFile', () => {
  it('URL sans barre finale → fichier .html', () => {
    expect(pageFile('/en/tools/mailchimp')).toBe('en/tools/mailchimp.html');
    expect(pageFile('/en/sponsor')).toBe('en/sponsor.html');
  });

  it('URL à barre finale → index.html du dossier', () => {
    expect(pageFile('/')).toBe('index.html');
    expect(pageFile('/en/')).toBe('en/index.html');
    expect(pageFile('/en/categories/')).toBe('en/categories/index.html');
  });

  it('refuse un chemin relatif', () => {
    expect(() => pageFile('en/x')).toThrow(/absolu/);
  });
});

// Step 1 (A8) : un index + un sitemap par type, pages indexables seulement.
describe('buildSitemaps', () => {
  const entries = [
    { kind: 'pages', path: '/en/', lastmod: '2026-10-10' },
    { kind: 'tools', path: '/en/tools/a', lastmod: '2026-10-01' },
    { kind: 'tools', path: '/en/tools/b', lastmod: '2026-10-12' },
    { kind: 'lists', path: '/en/categories/x' },
  ];
  const { files, index } = buildSitemaps(entries);

  it('un fichier par type non vide, nommé sitemap-<type>.xml', () => {
    expect(files.map((f) => [f.name, f.count])).toEqual([
      ['sitemap-pages.xml', 1], ['sitemap-tools.xml', 2], ['sitemap-lists.xml', 1],
    ]);
    expect(SITEMAP_KINDS).toEqual(['pages', 'tools', 'projects', 'compare', 'lists']);
  });

  it('chaque fichier ne contient que ses URL, avec leur lastmod', () => {
    const tools = files.find((f) => f.name === 'sitemap-tools.xml').xml;
    expect(tools).toContain('<loc>https://saasmadefree.com/en/tools/a</loc>\n    <lastmod>2026-10-01</lastmod>');
    expect(tools).not.toContain('/en/categories/x');
  });

  it("l'index cite chaque fichier, daté de sa plus récente lastmod", () => {
    expect(index).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(index).toContain('<loc>https://saasmadefree.com/sitemap-tools.xml</loc>\n    <lastmod>2026-10-12</lastmod>');
    // Aucune date dans les listes : l'index n'en invente pas.
    expect(index).toMatch(/<loc>https:\/\/saasmadefree\.com\/sitemap-lists\.xml<\/loc>\n  <\/sitemap>/);
    expect(index).not.toContain('sitemap-projects.xml');
  });

  it('refuse un type inconnu et une URL en double', () => {
    expect(() => buildSitemaps([{ kind: 'blog', path: '/x' }])).toThrow(/blog/);
    expect(() => buildSitemaps([{ kind: 'tools', path: '/x' }, { kind: 'lists', path: '/x' }])).toThrow(/double/);
  });
});
