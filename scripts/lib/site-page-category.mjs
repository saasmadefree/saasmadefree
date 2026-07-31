import { escapeHtml, renderLayout, renderBreadcrumb } from './site-html.mjs';
import { categoryLabel } from './site-data.mjs';
import { interpolate } from './site-format.mjs';
import { renderToolTable } from './site-table.mjs';
import { organizationJsonLd, itemListJsonLd, breadcrumbJsonLd } from './site-seo.mjs';

export function renderCategoryPage({
  lang, path, categorySlug, categories, toolViews, voteCounts, ui, alternates, xDefaultPath, homePath,
}) {
  const s = ui.site;
  const label = categoryLabel(categories, categorySlug, lang);
  const heading = interpolate(s.category.heading, { category: label });
  const title = interpolate(s.category.titleTemplate, { category: label });
  const description = interpolate(s.category.metaDescriptionTemplate, { category: label });

  const breadcrumbItems = [
    { label: s.directoryLabel, href: homePath },
    { label, href: path },
  ];

  const table = renderToolTable(toolViews, { lang, ui, categories, voteCounts });

  const main = `    ${renderBreadcrumb(breadcrumbItems)}
    <h1>${escapeHtml(heading)}</h1>
${table}`;

  return renderLayout({
    lang,
    path,
    title,
    description,
    alternates,
    xDefaultPath,
    jsonLd: [
      organizationJsonLd(),
      itemListJsonLd(toolViews),
      breadcrumbJsonLd(breadcrumbItems.map((item) => ({ ...item, href: item.href }))),
    ],
    main,
    ui,
    homeHref: homePath,
  });
}
