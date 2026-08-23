import { escapeHtml, renderLayout } from './site-html.mjs';
import { categoryLabel } from './site-data.mjs';
import { formatMoney, formatMonthlyPrice, formatStampDate, interpolate, pluralize } from './site-format.mjs';
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

/** La bande de répartition : l'argument du site rendu à l'échelle.
 *
 *  Les trois segments sont proportionnels au NOMBRE réel de fiches portant
 *  chaque verdict — comptées ici, sur toolViews, jamais reçues toutes faites.
 *  C'est la seule figure de la page qui n'a pas besoin d'être expliquée : la
 *  largeur du « Non » est l'aveu que le site fait sur lui-même.
 *
 *  Chaque segment est un `.verdict-chip[data-verdict]`, donc scripts/assets/site.js
 *  le câble au filtre du registre sans une ligne de plus. Sans JavaScript la
 *  bande reste ce qu'elle est d'abord : un graphique lisible.
 *
 *  Le pourcentage passe par Intl.NumberFormat : aucun mot à traduire, et
 *  l'arrondi suit la locale. Le libellé porte le nom accessible complet
 *  (label + décompte), parce que la couleur ne porte jamais l'information
 *  seule — principe 2 du .impeccable.md.
 */
function renderVerdictBand(toolViews, lang, s, h, replaceableMonthlyUsd) {
  const total = toolViews.length;
  if (total === 0) return '';
  const pct = new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0 });
  const n = new Intl.NumberFormat(lang);

  const segments = ['yes', 'kinda', 'no'].map((v) => {
    const count = toolViews.filter((t) => t.verdict === v).length;
    const verdict = s.verdicts[v];
    const share = pct.format(count / total);
    // flex-grow porte la proportion : une part nulle ne prend aucune place,
    // mais garde une largeur de base pour rester cliquable si elle existe.
    return `        <button type="button" class="verdict-chip vb-seg vb-${v}" data-verdict="${v}"
                aria-pressed="false" style="flex-grow:${count}"
                aria-label="${escapeHtml(`${verdict.label} — ${n.format(count)} (${share}). ${verdict.desc}`)}">
          <span class="vb-share" aria-hidden="true">${escapeHtml(share)}</span>
          <span class="vb-count" aria-hidden="true">${escapeHtml(n.format(count))}</span>
          <span class="vb-label" aria-hidden="true">${escapeHtml(verdict.label)}</span>
        </button>`;
  }).join('\n');

  return `    <section class="verdict-band" aria-label="${escapeHtml(h.verdictsHeading)}">
      <div class="vb-track" role="group" aria-label="${escapeHtml(h.verdictFilterAriaLabel)}">
${segments}
      </div>
      <div class="vb-foot">
        <button type="button" class="verdict-chip vb-reset is-active" data-verdict="all" aria-pressed="true">${escapeHtml(h.allChip)} · ${escapeHtml(n.format(total))}</button>
        <p class="vb-spend">
          <span class="vb-spend-label">${escapeHtml(h.replaceableSpendLabel)}</span>
          <strong class="vb-spend-value">${escapeHtml(formatMoney(replaceableMonthlyUsd, 'USD', lang))}</strong>
        </p>
      </div>
    </section>`;
}

/** Le titre à trou : « ____ Made Free », où le trou défile.
 *
 *  Les noms viennent des fiches au verdict « oui » — celles dont le catalogue
 *  dit qu'un prompt les remplace vraiment. Prendre aussi les « presque »
 *  ferait promettre au titre ce que la fiche passe ensuite son temps à
 *  nuancer. L'ordre suit pagePriority (le degré de préparation de la fiche),
 *  donc le titre montre en premier ce que le site sait le mieux défendre.
 *
 *  Le rotateur est décoratif : aria-hidden dessus, et une phrase stable en
 *  visually-hidden porte le vrai nom accessible du h1. Un lecteur d'écran ne
 *  doit pas entendre huit marques à la suite, et un moteur ne doit pas
 *  indexer un titre qui change de sens à chaque seconde.
 */
function renderHeroTitle(toolViews, lang, h) {
  const picks = toolViews
    .filter((t) => t.verdict === 'yes')
    .sort((a, b) => (b.pagePriority ?? 0) - (a.pagePriority ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 8);

  // Aucune fiche « oui » : pas de trou à remplir, donc pas de rotateur et
  // aucun badge à semer. Le titre retombe sur sa forme stable.
  if (picks.length === 0) {
    return `<h1 class="hero-h1">${escapeHtml(h.heroStatic)}</h1>`;
  }

  // Le pas vit en variable CSS : la feuille le lit, et le décalage de chaque
  // nom en découle — un seul chiffre à changer pour régler la cadence.
  const cell = (content, i) =>
    `<span class="hero-rot-item" style="animation-delay:calc(var(--rot-step) * ${i})">${content}</span>`;

  const names = picks.map((t, i) => cell(escapeHtml(t.name), i)).join('');

  // Les prix ne sont plus dans le titre : ils deviennent des badges qui
  // s'envolent, semés par scripts/assets/site.js au rythme du rotateur. Ils
  // voyagent donc en données, pas en balisage — plusieurs peuvent coexister à
  // l'écran, ce qu'un élément unique dans le h1 ne permettait pas.
  //
  // Ce sont les vrais prix relevés, formatés comme partout ailleurs sur le
  // site : ce qui s'envole, c'est ce que la fiche dit qu'on arrête de payer.
  const savings = JSON.stringify(picks.map((t) => formatMonthlyPrice(t.pricing, lang)));

  // Le semoir est placé AVANT le titre : les badges montent donc dans la bande
  // vide au-dessus du héro, au lieu de traverser le titre en cours de vol —
  // ce qui rendait les deux illisibles pendant la moitié du trajet.
  return `<div class="hero-savings" aria-hidden="true" data-savings="${escapeHtml(savings)}"></div>
      <h1 class="hero-h1">
        <span class="hero-rot" aria-hidden="true" style="--rot-count:${picks.length}">${names}</span>
        <span class="hero-made" aria-hidden="true">${escapeHtml(h.heroSuffix)}</span>
        <span class="visually-hidden">${escapeHtml(h.heroStatic)}</span>
      </h1>`;
}

export function renderHomePage({
  lang, path, toolViews, topCategorySlugs, categories, voteCounts, favicons, figures, mrrTotal,
  ui, alternates, xDefaultPath, sponsorSlots, buildDate,
}) {
  const s = ui.site;
  const h = s.home;
  const allCategoriesPath = `${path}categories/`;

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
      const label = categoryLabel(categories, slug, lang);
      return `        <li><a href="${path}categories/${slug}/">${escapeHtml(label)}</a></li>`;
    })
    .join('\n');

  const table = renderToolTable(toolViews, { lang, ui, categories, voteCounts, favicons });

  // Le cachet « Prix tous vérifiés depuis le … » est retiré le 20.08.2026.
  // Il portait un vrai fait (la plus ANCIENNE date de relevé du catalogue),
  // mais chaque fiche affiche déjà sa propre date de vérification, à côté de
  // sa source — là où elle sert vraiment. En pied d'accueil, il ne faisait
  // que dater tout le catalogue par sa pire fiche.

  // Plus de cartouche de références sur l'accueil (20.08.2026) : elle répétait
  // en tête ce que le récapitulatif dit plus bas, en plus grand — nombre de
  // fiches, nombre de catégories. Elle repoussait le titre sous la ligne de
  // flottaison pour trois chiffres déjà présents deux écrans plus loin. La
  // cartouche reste sur la fiche outil, où ses cellules ne figurent nulle
  // part ailleurs.
  const refCells = [];

  // Le bordereau général, dans l'ordre de la maquette-accueil : cadre héro
  // (ligne à remplir STATIQUE — jamais un champ ; l'annotation au stylo est le
  // renvoi vers le cadre recherche), cadre « Recherche au registre », état
  // récapitulatif tamponné, registre annoté, signature.
  // Direction « Le Verdict » : le héro affirme, il ne mime plus un formulaire.
  // La question restait la promesse du site, mais la rendre avec une fausse
  // ligne à remplir DANS le h1 se lisait comme un bug de gabarit, et le vrai
  // champ se trouvait quatre cents pixels plus bas. Les deux lignes de
  // heroLine sont désormais le titre, et le champ n'existe qu'une fois.
  // Le champ de recherche vit DANS le héro, sous le titre : c'est la première
  // chose que fait un visiteur venu pour un outil précis. Il vivait quatre
  // cents pixels plus bas, après la lede et la bande — trois écrans de
  // défilement sur téléphone avant de pouvoir taper un nom.
  const main = `    <section class="hero">
${renderHeroTitle(toolViews, lang, h)}
      <p class="lede">${escapeHtml(h.lede)}</p>
      <div class="search-frame">
        <div class="field">
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
      </div>
    </section>

${renderVerdictBand(toolViews, lang, s, h, figures.replaceableMonthlyUsd)}

    <section class="recap" aria-label="${escapeHtml(h.figuresAriaLabel)}">
      <div class="recap-figures">
${renderRecapFigures(figures, lang, h)}
      ${renderMrrLine(mrrTotal, lang, h)}
      </div>
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
