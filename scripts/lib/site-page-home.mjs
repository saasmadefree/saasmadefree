import { escapeHtml, renderLayout, stamp } from './site-html.mjs';
import { categoryLabel, categoryEmoji, oldestCheckedOn } from './site-data.mjs';
import { formatMoney, formatStampDate, interpolate, pluralize } from './site-format.mjs';
import { renderToolTable } from './site-table.mjs';
import { organizationJsonLd, websiteJsonLd, itemListJsonLd } from './site-seo.mjs';

/** La ligne MRR-votes de l'état récapitulatif : une ligne de bordereau sobre
 *  (libellé + montant via formatMoney — plus jamais de "digit boxes"). Le
 *  montant visible est doublé d'une phrase complète pour lecteur d'écran
 *  (mrrSrTemplate) ; quand le service de vote n'a pas répondu au build
 *  (mrrTotal null), on affiche un texte simple plutôt qu'un zéro qui se
 *  ferait passer pour une donnée. */
function renderMrrLine(mrrTotal, lang, h) {
  if (mrrTotal === null) {
    return `<p class="recap-unavailable">${escapeHtml(h.mrrUnavailable)}</p>`;
  }
  const amount = formatMoney(mrrTotal, 'USD', lang);
  const srText = interpolate(h.mrrSrTemplate, { amount });
  return `<div class="recap-figure">
        <span aria-hidden="true"><span class="recap-label">${escapeHtml(h.mrrLabel)}</span>
        <span class="recap-value recap-value-sm">${escapeHtml(amount)}</span></span>
        <span class="visually-hidden">${escapeHtml(srText)}</span>
      </div>`;
}

/** Les lignes de l'état récapitulatif : les figures de catalogueFigures en
 *  lignes de bordereau (libellé condensé au-dessus, valeur en dessous). */
function renderRecapFigures(figures, lang, h) {
  const n = (value) => new Intl.NumberFormat(lang).format(value);
  const items = [
    [h.figureToolsPublished, n(figures.toolsPublished), ''],
    [h.figureCategories, n(figures.categories), ''],
    [h.figureTotalPrice, formatMoney(figures.totalMonthlyUsd, 'USD', lang), ' recap-value-sm'],
  ];
  return items
    .map(
      ([label, value, extra]) => `      <div class="recap-figure">
        <span class="recap-label">${escapeHtml(label)}</span>
        <span class="recap-value${extra}">${escapeHtml(value)}</span>
      </div>`
    )
    .join('\n');
}

export function renderHomePage({
  lang, path, toolViews, topCategorySlugs, categories, voteCounts, favicons, figures, mrrTotal,
  ui, alternates, xDefaultPath, sponsorSlots, buildDate,
}) {
  const s = ui.site;
  const h = s.home;
  const allCategoriesPath = `${path}categories/`;

  // {blank} marque l'emplacement du nom d'outil que le lecteur va taper.
  const [qBefore, qAfter] = String(h.heroQuestion ?? '{blank}').split('{blank}');

  // Seulement les catégories les plus peuplées (topCategorySlugs, calculé au
  // build par topCategoriesByCount — jamais une liste en dur) : la totalité
  // vivait ici et poussait la liste des outils loin sous la ligne de
  // flottaison. La page /categories/ garde la totalité, voir le dernier
  // chip "Toutes les catégories →" ci-dessous. Les pastilles restent des
  // liens vers les pages de catégorie, qui existent déjà — elles
  // fonctionnent donc sans JavaScript, et chaque catégorie reste une page
  // indexable, ce qu'un filtre purement client ne donne pas.
  const categoryChips = topCategorySlugs
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
      return `        <button type="button" class="chip verdict-chip" data-verdict="${v}" aria-pressed="false" aria-label="${escapeHtml(`${verdict.label}: ${verdict.desc}`)}">${escapeHtml(verdict.label)}</button>`;
    })
    .join('\n');

  const table = renderToolTable(toolViews, { lang, ui, categories, voteCounts, favicons });

  // Le cachet plancher du bordereau : la date de vérification la plus ANCIENNE
  // du catalogue (oldestCheckedOn), jamais la plus récente — le tampon promet
  // « tous vérifiés depuis », il doit donc être vrai pour la pire fiche.
  const verifStamp = stamp('verif', [
    s.dossier.pricesVerifiedSince,
    formatStampDate(oldestCheckedOn(toolViews)),
  ]);

  // La cartouche de références sous le filet de tête (renderLayout) : chaque
  // cellule est un fait calculé au build — dont la date d'arrêté, calculée UNE
  // fois dans build-site.mjs pour que toutes les pages portent la même.
  const refCells = [
    [s.dossier.registryLabel, new Intl.NumberFormat(lang).format(figures.toolsPublished)],
    [h.figureCategories, new Intl.NumberFormat(lang).format(figures.categories)],
    [s.dossier.statusArrestedOn, formatStampDate(buildDate)],
  ];

  // Le bordereau général, dans l'ordre de la maquette-accueil : cadre héro
  // (ligne à remplir STATIQUE — jamais un champ ; l'annotation au stylo est le
  // renvoi vers le cadre recherche), cadre « Recherche au registre », état
  // récapitulatif tamponné, registre annoté, signature.
  const main = `    <section class="hero sheet">
      <h1 class="hero-h1">${escapeHtml(qBefore)}<span class="hero-blank"><em class="pen-line" aria-hidden="true">${escapeHtml(h.searchPlaceholder)}</em></span>${escapeHtml(qAfter ?? '')}</h1>
      <p class="hero-sub">${escapeHtml(h.heroLine1)} ${escapeHtml(h.heroLine2)}</p>
      <p class="pen-note">${escapeHtml(h.lede)}</p>
    </section>

    <section class="search-frame sheet">
      <div class="field">
        <label for="q">${escapeHtml(s.dossier.searchFrameHeading)}</label>
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
      <div class="verdict-chips" role="group" aria-label="${escapeHtml(h.verdictFilterAriaLabel)}">
        <button type="button" class="chip verdict-chip is-active" data-verdict="all" aria-pressed="true">${escapeHtml(h.allChip)}</button>
${verdictChips}
      </div>
    </section>

    <section class="recap sheet" aria-label="${escapeHtml(h.figuresAriaLabel)}">
      <div class="recap-figures">
${renderRecapFigures(figures, lang, h)}
      ${renderMrrLine(mrrTotal, lang, h)}
      </div>
      <div class="recap-stamps">${verifStamp}</div>
    </section>

    <div class="list-head">
      <h2 class="list-heading">${escapeHtml(h.listHeading)}</h2>
      <p class="rank-note">${escapeHtml(h.rankNote)}</p>
    </div>
    <nav class="chips-nav" aria-label="${escapeHtml(h.categoryFilterLabel)}">
      <ul class="chips">
        <li><a href="${path}" aria-current="page">${escapeHtml(h.allChip)}</a></li>
${categoryChips}
        <li><a class="chip-all-categories" href="${allCategoriesPath}">${escapeHtml(h.allCategoriesChip)}</a></li>
      </ul>
    </nav>
${table}
    <p id="no-results" hidden>${escapeHtml(h.noResults)}</p>

    <section class="sign-row">
      <div class="sign-text">
        <p class="sign-note">${escapeHtml(pluralize(figures.toolsPublished, lang, h.tallyOne, h.tallyOther))}</p>
      </div>
      <span class="paraphe" aria-hidden="true">SMF</span>
    </section>`;

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
    sponsorSlots,
    refCells,
  });
}
