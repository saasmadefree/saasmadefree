import { escapeHtml, renderLayout } from './site-html.mjs';
import { categoryLabel, categoryEmoji } from './site-data.mjs';
import { pluralize } from './site-format.mjs';
import { renderToolTable } from './site-table.mjs';
import { organizationJsonLd, websiteJsonLd, itemListJsonLd } from './site-seo.mjs';

export function renderHomePage({ lang, path, toolViews, categorySlugs, categories, voteCounts, ui, alternates, xDefaultPath }) {
  const s = ui.site;
  const h = s.home;

  const verdictsList = ['yes', 'kinda', 'no']
    .map((v) => `        <dt class="${v}"><i aria-hidden="true"></i>${escapeHtml(s.verdicts[v].label)}</dt>
        <dd>${escapeHtml(s.verdicts[v].desc)}</dd>`)
    .join('\n');

  const tally = pluralize(toolViews.length, lang, h.tallyOne, h.tallyOther);

  const categoryOptions = categorySlugs
    .map((slug) => {
      const emoji = categoryEmoji(categories, slug);
      const label = categoryLabel(categories, slug, lang);
      return `            <option value="${slug}">${emoji ? `${emoji} ` : ''}${escapeHtml(label)}</option>`;
    })
    .join('\n');

  const table = renderToolTable(toolViews, { lang, ui, categories, voteCounts });

  const main = `    <h1 class="r">${escapeHtml(h.heroLine1)}<br><em>${escapeHtml(h.heroLine2)}</em></h1>
    <p class="lede r">${escapeHtml(h.lede)}</p>

    <div class="r">
      <h2>${escapeHtml(h.verdictsHeading)}</h2>
      <dl class="verdicts">
${verdictsList}
      </dl>
      <p class="tally">${escapeHtml(tally)}</p>
    </div>

    <search aria-label="${escapeHtml(h.searchLabel)}">
      <div class="field">
        <label for="q">${escapeHtml(h.searchLabel)}</label>
        <input type="search" id="q" name="q" placeholder="${escapeHtml(h.searchPlaceholder)}" autocomplete="off">
      </div>
      <div class="field">
        <label for="category-filter">${escapeHtml(h.categoryFilterLabel)}</label>
        <select id="category-filter">
          <option value="all">${escapeHtml(h.categoryFilterAll)}</option>
${categoryOptions}
        </select>
      </div>
    </search>

    <h2 class="visually-hidden">${escapeHtml(h.listHeading)}</h2>
${table}
    <p id="no-results" hidden>${escapeHtml(h.noResults)}</p>`;

  return renderLayout({
    lang,
    path,
    title: h.titleTag,
    description: h.metaDescription,
    alternates,
    xDefaultPath,
    jsonLd: [organizationJsonLd(), websiteJsonLd(path), itemListJsonLd(toolViews)],
    main,
    ui,
    homeHref: path,
  });
}
