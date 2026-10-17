import { escapeHtml, renderLayout, renderBreadcrumb } from './site-html.mjs';
import { SITE_ORIGIN } from './site-data.mjs';
import { interpolate, pluralize } from './site-format.mjs';
import { renderToolGrid } from './site-table.mjs';
import { organizationJsonLd, itemListJsonLd, breadcrumbJsonLd } from './site-seo.mjs';
import { alternativesFor, indexable } from './site-alternatives.mjs';

// Collections /{lang}/collections/{kind} (spec D5, D7). Deux seulement, qui
// n'ont pas d'équivalent chez openalternative.co : les SaaS qu'on peut
// remplacer par un logiciel auto-hébergé, et ceux qu'un agent refait en une
// soirée. La liste reprend la grille de cartes de l'accueil, dans l'ordre de
// l'annuaire. Moins de 3 éléments : page générée en noindex,follow, hors
// sitemap, avec un titre sans chiffre.

export const COLLECTION_KINDS = ['self-hosted', 'build-tonight'];

/** Temps de fabrication qui tiennent dans « ce soir » au sens large. */
const TONIGHT_ESTIMATES = new Set(['one-sitting', 'weekend']);

// Libellé de la collection : le même que le lien du pied de page, une seule
// clé par langue pour le même nom.
const LABEL_KEYS = { 'self-hosted': 'selfHosted', 'build-tonight': 'buildTonight' };

export function collectionPath(lang, kind) {
  return `/${lang}/collections/${kind}`;
}

/**
 * Fiches d'une collection, dans l'ordre reçu (celui de l'annuaire).
 * - `build-tonight` : verdict `yes` ET `diyTimeEstimate` `one-sitting` ou `weekend` ;
 * - `self-hosted` : au moins un projet affichable et auto-hébergeable. La
 *   carte ne nomme alors que ces projets-là (`alternativeNames`).
 * @param {'self-hosted'|'build-tonight'} kind
 * @param {object[]} toolViews  fiches de la langue (buildToolViews)
 * @param {{ projects: Map<string, object>, today: string }} ctx
 * @returns {object[]}
 */
export function collectionTools(kind, toolViews, { projects, today }) {
  if (kind === 'build-tonight') {
    return toolViews.filter((tool) => tool.verdict === 'yes' && TONIGHT_ESTIMATES.has(tool.diyTimeEstimate));
  }
  if (kind === 'self-hosted') {
    const out = [];
    for (const tool of toolViews) {
      const hostable = alternativesFor(tool, projects, today).filter(({ project }) => project.selfHostable === true);
      if (hostable.length) out.push({ ...tool, alternativeNames: hostable.map(({ project }) => project.name) });
    }
    return out;
  }
  throw new Error(`Collection inconnue : « ${kind} » (attendu : ${COLLECTION_KINDS.join(', ')}).`);
}

/** CollectionPage d'une liste de fiches : partagée avec le hub A–Z. */
export function collectionPageJsonLd({ path, name, description, lang }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    url: `${SITE_ORIGIN}${path}`,
    name,
    description,
    inLanguage: lang,
  };
}

/**
 * @param {object} opts
 * @param {'self-hosted'|'build-tonight'} opts.kind
 * @param {object[]} opts.items  collectionTools(kind, …)
 * @param {string} opts.buildDate  'YYYY-MM-DD' (année du titre)
 */
export function renderCollectionPage({
  kind, lang, path, items, categories, voteCounts, favicons, ui, alternates, xDefaultPath, homePath,
  sponsorSlots, buildDate,
}) {
  if (!COLLECTION_KINDS.includes(kind)) throw new Error(`Collection inconnue : « ${kind} ».`);
  const s = ui.site;
  const c = s.collections;
  const k = c[kind];
  const label = s.footer[LABEL_KEYS[kind]];
  const open = indexable.list(items);
  const vars = { n: items.length, year: buildDate.slice(0, 4) };
  const title = interpolate(open ? k.titleTemplate : k.titleFallbackTemplate, vars);
  const description = interpolate(k.metaDescriptionTemplate, vars);

  const breadcrumbItems = [
    { label: s.directoryLabel, href: homePath },
    { label, href: path },
  ];

  const body = items.length === 0
    ? `    <p class="intro">${escapeHtml(c.empty)}</p>`
    : renderToolGrid(items, { lang, ui, categories, voteCounts, favicons, headingLevel: 2 });

  const main = `    <header class="list-head">
      ${renderBreadcrumb(breadcrumbItems)}
      <h1>${escapeHtml(title)}</h1>
      <p class="lede">${escapeHtml(k.lede)}</p>
      <p class="intro">${escapeHtml(pluralize(items.length, lang, c.countOne, c.countOther))}</p>
    </header>
${body}`;

  return renderLayout({
    lang,
    path,
    title,
    description,
    alternates,
    xDefaultPath,
    robots: open ? null : 'noindex,follow',
    jsonLd: [
      organizationJsonLd(),
      collectionPageJsonLd({ path, name: title, description, lang }),
      itemListJsonLd(items),
      breadcrumbJsonLd(breadcrumbItems),
    ],
    main,
    ui,
    homeHref: homePath,
    sponsorSlots,
  });
}
