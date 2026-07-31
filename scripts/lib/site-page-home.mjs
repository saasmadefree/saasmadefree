import { escapeHtml, renderLayout } from './site-html.mjs';
import { categoryLabel, categoryEmoji } from './site-data.mjs';
import { pluralize } from './site-format.mjs';
import { renderToolTable } from './site-table.mjs';
import { organizationJsonLd, websiteJsonLd, itemListJsonLd } from './site-seo.mjs';

export function renderHomePage({ lang, path, toolViews, categorySlugs, categories, voteCounts, ui, alternates, xDefaultPath }) {
  const s = ui.site;
  const h = s.home;

  const verdictsList = ['yes', 'kinda', 'no']
    .map((v) => `        <dt><span class="badge ${v}">${escapeHtml(s.verdicts[v].label)}</span></dt>
        <dd>${escapeHtml(s.verdicts[v].desc)}</dd>`)
    .join('\n');

  const tally = pluralize(toolViews.length, lang, h.tallyOne, h.tallyOther);

  // Les pastilles sont des liens vers les pages de catégorie, qui existent déjà.
  // Elles fonctionnent donc sans JavaScript, et chaque catégorie reste une page
  // indexable — ce qu'un filtre purement client ne donne pas.
  const chips = categorySlugs
    .map((slug) => {
      const emoji = categoryEmoji(categories, slug);
      const label = categoryLabel(categories, slug, lang);
      return `        <li><a href="${path}categories/${slug}/">${emoji ? `<span aria-hidden="true">${emoji}</span> ` : ''}${escapeHtml(label)}</a></li>`;
    })
    .join('\n');

  // {blank} marque l'emplacement du nom d'outil que le lecteur va taper.
  const [qBefore, qAfter] = String(h.heroQuestion ?? '{blank}').split('{blank}');

  const table = renderToolTable(toolViews, { lang, ui, categories, voteCounts });

  const main = `    <h1 class="r">${escapeHtml(qBefore)}<span class="blank">&#95;&#95;&#95;</span>${escapeHtml(qAfter ?? '')}</h1>
    <p class="lede r">${escapeHtml(h.heroLine1)} ${escapeHtml(h.heroLine2)}</p>

    <search class="r" aria-label="${escapeHtml(h.searchLabel)}">
      <div class="field">
        <label for="q">${escapeHtml(h.searchLabel)}</label>
        <div class="search-shell">
          <input type="search" id="q" name="q" placeholder="${escapeHtml(h.searchPlaceholder)}" autocomplete="off">
        </div>
      </div>
    </search>

    <h2>${escapeHtml(h.browseHeading ?? h.categoryFilterLabel)}</h2>
    <ul class="chips r">
${chips}
    </ul>

    <div class="r">
      <h2>${escapeHtml(h.verdictsHeading)}</h2>
      <dl class="verdicts">
${verdictsList}
      </dl>
      <p class="tally">${escapeHtml(tally)}</p>
    </div>

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
