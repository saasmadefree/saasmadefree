import { escapeHtml, renderLayout } from './site-html.mjs';
import { categoryLabel } from './site-data.mjs';
import { formatMoney, interpolate, pluralize } from './site-format.mjs';
import { renderToolGrid } from './site-table.mjs';
import { organizationJsonLd, websiteJsonLd, itemListJsonLd } from './site-seo.mjs';

// Nombre d'entrées de la liste « Alternatives populaires ».
const POPULAR_COUNT = 8;
// Cartes montrées d'abord par site.js, avant « Voir plus ». Le chiffre voyage
// dans data-page-size : le script le lit, il n'en garde pas de copie.
const PAGE_SIZE = 24;

/** La ligne de chiffres sous le héros (spec D14) : les six chiffres du
 *  catalogue, puis la dépense mensuelle représentée par les votes. Quand le
 *  service de vote n'a pas répondu au build (mrrTotal null), on affiche un
 *  texte simple plutôt qu'un zéro qui se ferait passer pour une donnée. Le
 *  montant des votes est doublé d'une phrase complète pour lecteur d'écran. */
function renderFigures(figures, mrrTotal, lang, h) {
  const n = (value) => new Intl.NumberFormat(lang).format(value);
  const usd = (value) => formatMoney(value, 'USD', lang);
  const items = [
    [h.figureToolsPublished, n(figures.toolsPublished)],
    [h.figureCategories, n(figures.categories)],
    [h.figureLanguages, n(figures.languages)],
    // Un prompt par fiche ET par langue (chaque langue a le sien, écrit dans
    // la langue) : le libellé dit lesquelles, pour qu'on ne le lise pas à
    // côté du nombre d'outils comme « un prompt par outil ».
    [interpolate(h.figurePrompts, { langs: (figures.promptLanguages ?? []).join(' + ') }), n(figures.prompts)],
    [h.figureTotalPrice, usd(figures.totalMonthlyUsd)],
    [h.replaceableSpendLabel, usd(figures.replaceableMonthlyUsd)],
  ].map(([label, value]) => `        <li><span>${escapeHtml(label)}</span> <strong>${escapeHtml(value)}</strong></li>`);

  if (mrrTotal === null) {
    items.push(`        <li>${escapeHtml(h.mrrUnavailable)}</li>`);
  } else {
    const amount = usd(mrrTotal);
    items.push(`        <li><span aria-hidden="true"><span>${escapeHtml(h.mrrLabel)}</span> <strong>${escapeHtml(amount)}</strong></span>`
      + `<span class="visually-hidden">${escapeHtml(interpolate(h.mrrSrTemplate, { amount }))}</span></li>`);
  }
  return `      <ul class="figures" aria-label="${escapeHtml(h.figuresAriaLabel)}">
${items.join('\n')}
      </ul>`;
}

/** Filtres au-dessus de la grille : les pastilles de verdict (forme + mot +
 *  décompte, définition en `title` et en `aria-describedby` vers la légende),
 *  puis le filtre de catégorie et le tri. Tous ne servent qu'avec
 *  JavaScript : ils sont rendus `hidden`, et site.js les dévoile — un
 *  contrôle mort est pire qu'un contrôle absent. La légende, elle, reste
 *  visible sans script : chaque verdict, son nombre de fiches et sa part du
 *  catalogue (D14), calculés sur la grille. */
function renderControls(toolViews, categories, lang, s, h) {
  const n = new Intl.NumberFormat(lang);
  const pct = new Intl.NumberFormat(lang, { style: 'percent' });
  const marks = { yes: '●', kinda: '◐', no: '○' };
  const countOf = (v) => toolViews.filter((t) => t.verdict === v).length;
  const share = (v) => interpolate(h.legendShareTemplate, {
    count: n.format(countOf(v)), share: pct.format(toolViews.length ? countOf(v) / toolViews.length : 0),
  });
  const chips = ['yes', 'kinda', 'no'].map((v) => {
    const count = countOf(v);
    const { label, desc } = s.verdicts[v];
    return `          <button type="button" class="verdict-chip" data-verdict="${v}" aria-pressed="false" title="${escapeHtml(desc)}" aria-describedby="legend-${v}">`
      + `<span class="mark" aria-hidden="true">${marks[v]}</span>${escapeHtml(label)} <span class="c">${escapeHtml(n.format(count))}</span></button>`;
  });

  // Une option par catégorie présente dans la grille, triée par libellé.
  const counts = new Map();
  for (const tool of toolViews) counts.set(tool.category, (counts.get(tool.category) ?? 0) + 1);
  const options = [...counts.keys()]
    .map((slug) => [slug, categoryLabel(categories, slug, lang)])
    .sort((a, b) => a[1].localeCompare(b[1], lang))
    .map(([slug, label]) => `            <option value="${slug}">${escapeHtml(label)} (${escapeHtml(n.format(counts.get(slug)))})</option>`)
    .join('\n');

  return `      <div class="controls">
        <div class="filters" role="group" hidden aria-label="${escapeHtml(h.verdictFilterAriaLabel)}">
          <button type="button" class="verdict-chip is-active" data-verdict="all" aria-pressed="true">${escapeHtml(h.allChip)} <span class="c">${escapeHtml(n.format(toolViews.length))}</span></button>
${chips.join('\n')}
        </div>
        <div class="selects" hidden>
          <label for="cat-filter">${escapeHtml(h.categoryFilterLabel)}</label>
          <select id="cat-filter">
            <option value="all">${escapeHtml(h.categoryFilterAll)}</option>
${options}
          </select>
          <label for="order">${escapeHtml(h.orderLabel)}</label>
          <select id="order">
            <option value="votes">${escapeHtml(h.orderVotes)}</option>
            <option value="price">${escapeHtml(h.orderPrice)}</option>
            <option value="name">${escapeHtml(h.orderName)}</option>
          </select>
        </div>
      </div>
      <ul class="legend" aria-label="${escapeHtml(h.verdictsHeading)}">
${['yes', 'kinda', 'no'].map((v) => `        <li id="legend-${v}"><strong><span class="mark" aria-hidden="true">${marks[v]}</span>${escapeHtml(s.verdicts[v].label)}</strong> ${escapeHtml(share(v))} ${escapeHtml(s.verdicts[v].desc)}</li>`).join('\n')}
      </ul>`;
}

/** Les deux listes de liens du bas : les fiches les mieux classées qui ont au
 *  moins une alternative libre affichable, et les catégories les plus
 *  peuplées (topCategorySlugs, calculé au build — jamais une liste en dur),
 *  plus le lien vers toutes les catégories. Les pastilles de catégorie
 *  restent de vrais liens : elles marchent sans JavaScript, et chaque
 *  catégorie reste une page indexable. */
function renderStart({ toolViews, topCategorySlugs, categories, path, lang, ui, figures }) {
  const h = ui.site.home;
  const c = ui.categoriesIndex;
  const popular = toolViews
    .filter((tool) => (tool.alternativeNames ?? []).length > 0)
    .slice(0, POPULAR_COUNT)
    .map((tool) => `          <li><a href="${tool.path}"><span class="l-name">${escapeHtml(interpolate(h.popularAltTemplate, { name: tool.name }))}</span>`
      + `<span class="l-meta">${escapeHtml(tool.alternativeNames.join(', '))}</span></a></li>`)
    .join('\n');
  const popularBlock = popular ? `      <div>
        <h2 id="h-alts">${escapeHtml(h.popularHeading)}</h2>
        <ul class="links" aria-labelledby="h-alts">
${popular}
        </ul>
      </div>
` : '';

  const cats = topCategorySlugs
    .map((slug) => {
      const count = toolViews.filter((t) => t.category === slug).length;
      return `          <li><a href="${path}categories/${slug}"><span class="l-name">${escapeHtml(categoryLabel(categories, slug, lang))}</span>`
        + `<span class="l-meta">${escapeHtml(pluralize(count, lang, c.toolCountOne, c.toolCountOther))}</span></a></li>`;
    })
    .join('\n');
  const allCategories = interpolate(h.allCategoriesTemplate, { count: new Intl.NumberFormat(lang).format(figures.categories) });

  return `    <section class="start">
${popularBlock}      <div>
        <h2 id="h-cats">${escapeHtml(h.browseHeading)}</h2>
        <ul class="links" aria-labelledby="h-cats">
${cats}
        </ul>
        <a class="more" href="${path}categories/">${escapeHtml(allCategories)}</a>
      </div>
    </section>`;
}

/**
 * L'accueil, façon openalternative.co (maquette direction-3-airy-home.html) :
 * titre court et sous-titre d'une ligne, emplacement newsletter, ligne de
 * chiffres, rangée sponsor discrète, recherche, filtres et tri, légende des
 * verdicts, grille de cartes, puis alternatives populaires et catégories.
 *
 * Rien de ce que l'accueil affichait ne disparaît (spec D14) : toutes les
 * fiches publiées sont dans la grille, et chaque placement sponsor vendu est
 * rendu — les latéraux dans la rangée sous le héros, ceux du bandeau en pied,
 * les places libres regroupées en un lien par zone (Ruling 14).
 *
 * @param {string} [opts.newsletter] - formulaire d'inscription déjà rendu
 *   (renderNewsletterForm, variante `hero`, Task A9). Vide par défaut : sans clé SmartLetter, aucun formulaire n'est
 *   rendu, jamais un formulaire mort (spec D13).
 */
export function renderHomePage({
  collectionLinks = [],
  lang, path, toolViews, topCategorySlugs, categories, voteCounts, favicons, figures, mrrTotal,
  ui, alternates, xDefaultPath, sponsorSlots, newsletter = '',
}) {
  const s = ui.site;
  const h = s.home;

  const grid = renderToolGrid(toolViews, { lang, ui, categories, voteCounts, favicons });
  const sub = interpolate(h.heroSub, { count: new Intl.NumberFormat(lang).format(toolViews.length) });

  // Sponsors de l'accueil (spec D14 amendée, Ruling 14) : chaque placement
  // vendu, et les places libres regroupées en un seul lien par zone. Les
  // emplacements latéraux passent des rails à la rangée sous le héros ; la
  // coquille ne reçoit que le bandeau du bas, sans rails ni repli.
  const sponsorRow = sponsorSlots?.homeRow ?? '';
  const layoutSlots = sponsorSlots
    ? { tapeBottom: sponsorSlots.homeTape ?? '', railLeft: '', railRight: '', fallback: '' }
    : null;

  const main = `    <section class="hero">
      <h1>${escapeHtml(h.heroTitle)}</h1>
      <p class="sub">${escapeHtml(sub)}</p>${newsletter ? `\n      ${newsletter}` : ''}
${renderFigures(figures, mrrTotal, lang, h)}
    </section>
    ${sponsorRow}
    <section class="directory" aria-labelledby="h-list">
      <h2 id="h-list" class="visually-hidden">${escapeHtml(h.listHeading)}</h2>
      <div class="search-frame">
        <label for="q" class="visually-hidden">${escapeHtml(h.searchLabel)}</label>
        <div class="search-combo">
          <search aria-label="${escapeHtml(h.searchLabel)}">
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
      </div>
${renderControls(toolViews, categories, lang, s, h)}
${grid}
      <p id="no-results" hidden>${escapeHtml(h.noResults)}</p>
      <p id="grid-status" class="visually-hidden" role="status" aria-live="polite" data-one="${escapeHtml(h.resultCountOne)}" data-other="${escapeHtml(h.resultCountOther)}"></p>
      <button type="button" id="show-more" class="show-more" hidden data-page-size="${PAGE_SIZE}" data-template="${escapeHtml(h.showMoreTemplate)}">${escapeHtml(interpolate(h.showMoreTemplate, { count: new Intl.NumberFormat(lang).format(Math.max(0, toolViews.length - PAGE_SIZE)) }))}</button>
    </section>
${renderStart({ toolViews, topCategorySlugs, categories, path, lang, ui, figures })}`;

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
    collectionLinks,
    sponsorSlots: layoutSlots,
    hasNewsletter: Boolean(newsletter),
  });
}
