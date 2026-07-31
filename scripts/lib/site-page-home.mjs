import { escapeHtml, renderLayout } from './site-html.mjs';
import { categoryLabel, categoryEmoji } from './site-data.mjs';
import {
  formatMoney, formatMoneyDigits, formatMonthlyPrice, monthlySuffix, interpolate, MONTHLY_BASES,
} from './site-format.mjs';
import { renderToolTable } from './site-table.mjs';
import { organizationJsonLd, websiteJsonLd, itemListJsonLd } from './site-seo.mjs';

/** Le bandeau défilant : une entrée par outil dont le prix est vraiment
 *  mensuel (voir MONTHLY_BASES) — jamais une fiche à paiement unique, dont le
 *  "-$X/mo" mentirait sur la périodicité. La séquence est dupliquée pour que
 *  l'animation CSS boucle sans à-coup (translateX -50%). */
function renderTicker(toolViews, lang) {
  const items = toolViews.filter((t) => MONTHLY_BASES.has(t.pricing.basis));
  const entry = (t) => `<span class="ticker-item">${escapeHtml(t.name.toUpperCase())} &minus;${escapeHtml(formatMonthlyPrice(t.pricing, lang))}</span>`;
  return [...items, ...items].map(entry).join('\n        ');
}

function renderMrrFigure(mrrTotal, lang, h) {
  if (mrrTotal === null) {
    return `<p class="mrr-figure mrr-unavailable">${escapeHtml(h.mrrUnavailable)}</p>`;
  }
  const digitBoxes = formatMoneyDigits(mrrTotal, 'USD', lang)
    .map((c) => `<span class="digit-box">${escapeHtml(c)}</span>`)
    .join('');
  const srText = interpolate(h.mrrSrTemplate, { amount: formatMoney(mrrTotal, 'USD', lang) });
  return `<p class="mrr-figure">
        <span class="mrr-label">${escapeHtml(h.mrrLabel)}</span>
        <span class="mrr-digits" aria-hidden="true">${digitBoxes}<span class="mrr-suffix">${escapeHtml(monthlySuffix(lang))}</span></span>
        <span class="visually-hidden">${escapeHtml(srText)}</span>
      </p>`;
}

function renderFigures(figures, lang, h) {
  const n = (value) => new Intl.NumberFormat(lang).format(value);
  const items = [
    [n(figures.toolsPublished), h.figureToolsPublished],
    [n(figures.categories), h.figureCategories],
    [n(figures.languages), h.figureLanguages],
    [formatMoney(figures.totalMonthlyUsd, 'USD', lang), h.figureTotalPrice],
    [n(figures.prompts), h.figurePrompts],
  ];
  return items
    .map(
      ([value, caption]) => `      <li class="figure">
        <span class="figure-value">${escapeHtml(value)}</span>
        <span class="figure-caption">${escapeHtml(caption)}</span>
      </li>`
    )
    .join('\n');
}

export function renderHomePage({
  lang, path, toolViews, categorySlugs, categories, voteCounts, favicons, figures, mrrTotal,
  ui, alternates, xDefaultPath,
}) {
  const s = ui.site;
  const h = s.home;
  const allCategoriesPath = `${path}categories/`;

  // {blank} marque l'emplacement du nom d'outil que le lecteur va taper.
  const [qBefore, qAfter] = String(h.heroQuestion ?? '{blank}').split('{blank}');

  // Les pastilles sont des liens vers les pages de catégorie, qui existent déjà.
  // Elles fonctionnent donc sans JavaScript, et chaque catégorie reste une page
  // indexable — ce qu'un filtre purement client ne donne pas.
  const categoryChips = categorySlugs
    .map((slug) => {
      const emoji = categoryEmoji(categories, slug);
      const label = categoryLabel(categories, slug, lang);
      return `        <li><a href="${path}categories/${slug}/">${emoji ? `<span aria-hidden="true">${emoji}</span> ` : ''}${escapeHtml(label)}</a></li>`;
    })
    .join('\n');

  // Chaque case de verdict porte sa propre description dans son nom
  // accessible : c'est la légende "trois verdicts" de l'ancienne maquette,
  // conservée pour les lecteurs de lecteur d'écran sans ajouter de section
  // visible que la nouvelle structure ne prévoit pas.
  const verdictChips = ['yes', 'kinda', 'no']
    .map((v) => {
      const verdict = s.verdicts[v];
      return `      <button type="button" class="chip verdict-chip" data-verdict="${v}" aria-pressed="false" aria-label="${escapeHtml(`${verdict.label}: ${verdict.desc}`)}">${escapeHtml(verdict.label)}</button>`;
    })
    .join('\n');

  const table = renderToolTable(toolViews, { lang, ui, categories, voteCounts, favicons });

  const main = `    <h1 class="r hero-h1">${escapeHtml(qBefore)}<span class="blank">&#95;&#95;&#95;</span>${escapeHtml(qAfter ?? '')}</h1>
    <p class="lede r hero-sub">${escapeHtml(h.heroLine1)} ${escapeHtml(h.heroLine2)}</p>

    <div class="search-combo r">
      <search aria-label="${escapeHtml(h.searchLabel)}">
        <label for="q" class="visually-hidden">${escapeHtml(h.searchLabel)}</label>
        <div class="search-shell">
          <input type="search" id="q" name="q" placeholder="${escapeHtml(h.searchPlaceholder)}"
                 autocomplete="off" role="combobox" aria-expanded="false"
                 aria-controls="search-panel" aria-autocomplete="list">
          <button type="button" id="search-clear" class="search-clear" hidden aria-label="${escapeHtml(h.searchClearLabel)}">&times;</button>
        </div>
      </search>
      <div id="search-panel" class="search-panel" role="listbox" aria-label="${escapeHtml(h.searchResultsLabel)}"
           data-view-all-template="${escapeHtml(h.searchViewAllTemplate)}"
           data-no-results="${escapeHtml(h.noResults)}"
           data-home-path="${escapeHtml(path)}" hidden></div>
    </div>

    <nav class="chips-nav r" aria-label="${escapeHtml(h.categoryFilterLabel)}">
      <ul class="chips">
        <li><a href="${path}" aria-current="page">${escapeHtml(h.allChip)}</a></li>
${categoryChips}
        <li><a class="chip-all-categories" href="${allCategoriesPath}">${escapeHtml(h.allCategoriesChip)}</a></li>
      </ul>
    </nav>

    <section class="ticker-band r" aria-label="${escapeHtml(h.tickerAriaLabel)}">
      <div class="ticker-marquee" aria-hidden="true">
        <div class="ticker-track">
        ${renderTicker(toolViews, lang)}
        </div>
      </div>
      ${renderMrrFigure(mrrTotal, lang, h)}
    </section>

    <section class="figures-band r" aria-label="${escapeHtml(h.figuresAriaLabel)}">
      <ul class="figures-list">
${renderFigures(figures, lang, h)}
      </ul>
    </section>

    <div class="list-head r">
      <h2 class="list-heading">${escapeHtml(h.listHeading)}</h2>
      <p class="rank-note">${escapeHtml(h.rankNote)}</p>
    </div>
    <div class="verdict-chips r" role="group" aria-label="${escapeHtml(h.verdictFilterAriaLabel)}">
      <button type="button" class="chip verdict-chip is-active" data-verdict="all" aria-pressed="true">${escapeHtml(h.allChip)}</button>
${verdictChips}
    </div>
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
