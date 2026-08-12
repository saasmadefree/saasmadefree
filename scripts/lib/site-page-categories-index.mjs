import { escapeHtml, renderLayout, renderBreadcrumb } from './site-html.mjs';
import { categoryLabel, categoryEmoji } from './site-data.mjs';
import { pluralize } from './site-format.mjs';
import { organizationJsonLd, breadcrumbJsonLd } from './site-seo.mjs';

/**
 * La cible du dernier chip de l'accueil ("All categories →") : une page qui
 * liste toutes les catégories réellement publiées dans cette langue, chacune
 * avec son nombre d'outils — jamais un chiffre de catégorie qui n'aurait
 * aucun outil derrière, donc aucun lien mort.
 */
export function renderCategoriesIndexPage({
  lang, path, categorySlugs, categories, countsBySlug, ui, alternates, xDefaultPath, homePath,
  sponsorSlots,
}) {
  const s = ui.site;
  const c = ui.categoriesIndex;

  const breadcrumbItems = [
    { label: s.directoryLabel, href: homePath },
    { label: c.heading, href: path },
  ];

  const items = categorySlugs
    .map((slug) => {
      const emoji = categoryEmoji(categories, slug);
      const label = categoryLabel(categories, slug, lang);
      const count = countsBySlug[slug] ?? 0;
      const tally = pluralize(count, lang, c.toolCountOne, c.toolCountOther);
      return `        <li class="category-row">
          <a href="${homePath}categories/${slug}/">
            ${emoji ? `<span aria-hidden="true">${emoji}</span>` : ''}${escapeHtml(label)}
            <span class="leader" aria-hidden="true"></span>
            <span class="category-count">${escapeHtml(tally)}</span>
          </a>
        </li>`;
    })
    .join('\n');

  const main = `    ${renderBreadcrumb(breadcrumbItems)}
    <h1>${escapeHtml(c.heading)}</h1>
    <ul class="category-list">
${items}
    </ul>`;

  return renderLayout({
    lang,
    path,
    title: c.titleTag,
    description: c.metaDescription,
    alternates,
    xDefaultPath,
    jsonLd: [organizationJsonLd(), breadcrumbJsonLd(breadcrumbItems)],
    main,
    ui,
    homeHref: homePath,
    sponsorSlots,
  });
}
