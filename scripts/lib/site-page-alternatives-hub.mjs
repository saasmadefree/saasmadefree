import { escapeHtml, renderLayout, renderBreadcrumb } from './site-html.mjs';
import { interpolate, pluralize } from './site-format.mjs';
import { organizationJsonLd, itemListJsonLd, breadcrumbJsonLd } from './site-seo.mjs';
import { indexable } from './site-alternatives.mjs';
import { collectionPageJsonLd } from './site-page-collection.mjs';

// Hub /{lang}/alternatives/ (spec D5) : l'index A–Z de toutes les fiches
// publiées dans la langue, chacune avec son nombre d'alternatives
// affichables. Une ancre par lettre ; les noms qui commencent par un
// chiffre ou un signe sont rangés sous « # », en tête.

const OTHER = '#';

export function hubPath(lang) {
  return `/${lang}/alternatives/`;
}

/** Lettre d'index d'un nom : première lettre sans accent ni casse (« Écwid »
 *  sous E), « # » pour un chiffre ou un signe. */
function letterOf(name) {
  const first = String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : OTHER;
}

/**
 * Fiches publiées dans la langue, regroupées par lettre : « # » d'abord,
 * puis A à Z. Dans une lettre, ordre alphabétique de la langue (casse et
 * accents ignorés, nombres comparés en nombres), puis slug.
 * @param {object[]} tools  vues de fiches (`name`, `slug`, `markets`, `path`)
 * @param {string} lang
 * @returns {Array<{ letter: string, id: string, tools: object[] }>}
 */
export function groupByLetter(tools, lang) {
  const collator = new Intl.Collator(lang, { sensitivity: 'base', numeric: true });
  const groups = new Map();
  for (const tool of tools) {
    if (!(tool.markets ?? []).includes(lang)) continue;
    const letter = letterOf(tool.name);
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(tool);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === OTHER ? -1 : b === OTHER ? 1 : a < b ? -1 : a > b ? 1 : 0))
    .map(([letter, list]) => ({
      letter,
      id: letter === OTHER ? 'letter-0-9' : `letter-${letter.toLowerCase()}`,
      tools: list.sort((x, y) => collator.compare(x.name, y.name) || (x.slug < y.slug ? -1 : x.slug > y.slug ? 1 : 0)),
    }));
}

/**
 * @param {object} opts
 * @param {object[]} opts.tools  vues de fiches de la langue
 * @param {Record<string, number>} opts.counts  slug → nombre d'alternatives affichables
 * @param {string} opts.buildDate  'YYYY-MM-DD' (année du titre)
 */
export function renderAlternativesHub({
  collectionLinks = [],
  lang, path, tools, counts, ui, alternates, xDefaultPath, homePath, sponsorSlots, buildDate,
}) {
  const s = ui.site;
  const h = s.hub;
  const groups = groupByLetter(tools, lang);
  const listed = groups.flatMap((g) => g.tools);
  const vars = { n: listed.length, year: buildDate.slice(0, 4) };
  const title = interpolate(h.titleTemplate, vars);
  const description = interpolate(h.metaDescriptionTemplate, vars);

  const breadcrumbItems = [
    { label: s.directoryLabel, href: homePath },
    { label: s.footer.hub, href: path },
  ];

  // Zéro alternative listée est un vrai chiffre, mais « 0 alternative » ne
  // dit rien d'utile : chaque fiche a son prompt, on le dit.
  const countText = (slug) => {
    const n = counts[slug] ?? 0;
    return n === 0 ? h.altCountNone : pluralize(n, lang, h.altCountOne, h.altCountOther);
  };

  const nav = `    <nav class="az-nav" aria-label="${escapeHtml(h.lettersLabel)}">
      <ul class="link-cloud">
${groups.map((g) => `        <li><a href="#${g.id}">${escapeHtml(g.letter)}</a></li>`).join('\n')}
      </ul>
    </nav>`;

  const sections = groups.map((g) => `    <section class="az-sec" aria-labelledby="${g.id}">
      <h2 id="${g.id}">${escapeHtml(g.letter)}</h2>
      <ul class="links az-list">
${g.tools.map((tool) => `        <li><a href="${escapeHtml(tool.path)}"><span class="l-name">${escapeHtml(tool.name)}</span> <span class="l-meta">${escapeHtml(countText(tool.slug))}</span></a></li>`).join('\n')}
      </ul>
    </section>`);

  const main = `    <header class="list-head">
      ${renderBreadcrumb(breadcrumbItems)}
      <h1>${escapeHtml(h.h1)}</h1>
      <p class="lede">${escapeHtml(h.lede)}</p>
    </header>
${nav}

${sections.join('\n\n')}`;

  return renderLayout({
    lang,
    path,
    title,
    description,
    alternates,
    xDefaultPath,
    robots: indexable.list(listed) ? null : 'noindex,follow',
    jsonLd: [
      organizationJsonLd(),
      collectionPageJsonLd({ path, name: title, description, lang }),
      itemListJsonLd(listed),
      breadcrumbJsonLd(breadcrumbItems),
    ],
    main,
    ui,
    homeHref: homePath,
    collectionLinks,
    sponsorSlots,
  });
}
