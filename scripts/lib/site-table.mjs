import { escapeHtml, verdictBadge } from './site-html.mjs';
import { categoryLabel } from './site-data.mjs';
import { formatMonthlyPrice, interpolate, pluralize, MONTHLY_BASES } from './site-format.mjs';
import { PLACEHOLDER_PATH } from './site-favicons.mjs';

/**
 * Grille de cartes de l'annuaire, partagée par l'accueil (avec recherche,
 * filtres, tri et « Voir plus ») et les pages de catégorie (sans). Elle
 * remplace la table du registre : mêmes informations par fiche (nom, icône,
 * catégorie, prix, verdict, votes), plus l'accroche, le temps de fabrication
 * et les alternatives libres affichables.
 *
 * Chaque `tool` doit déjà porter `tagline` et `path` (voir buildToolViews dans
 * build-site.mjs) ; `alternativeNames` est facultatif.
 *
 * Toutes les cartes sont dans le HTML et aucune n'est masquée : sans
 * JavaScript, chaque fiche reste liée depuis la page (spec D14). C'est
 * scripts/assets/site.js qui en montre 24 puis propose « Voir plus ».
 *
 * Le panneau de recherche et le tri lisent la carte elle-même (nom, catégorie,
 * accroche, icône : voir cardIndex dans site.js) — on n'émet jamais une
 * deuxième copie du catalogue dans la page. Les anciens attributs data-name,
 * data-cat, data-search et data-favicon recopiaient ces textes visibles : sur
 * les 530 cartes de l'accueil, ils pesaient 128 Ko (Task A8). Seule la
 * sous-catégorie, cherchable mais non affichée, garde son attribut `data-sub`.
 * Une carte tient sur peu de lignes, sans indentation : même raison.
 *
 * @param {object[]} tools
 * @param {object} opts
 * @param {number} [opts.headingLevel=3] - niveau du titre de carte : 3 sous le
 *   h2 de l'annuaire (accueil), 2 directement sous le h1 (page de catégorie)
 */
export function renderToolGrid(tools, { lang, ui, categories, voteCounts, favicons = {}, headingLevel = 3 }) {
  const t = ui.site.tool;
  const h = ui.site.home;
  const singularTpl = t.voteCountOne;
  const pluralTpl = t.voteCountOther;
  const hn = `h${headingLevel}`;

  const cards = tools
    .map((tool) => {
      const catLabel = categoryLabel(categories, tool.category, lang);
      const price = formatMonthlyPrice(tool.pricing, lang);
      const verdict = ui.site.verdicts[tool.verdict];
      const favicon = favicons[tool.slug] ?? PLACEHOLDER_PATH;
      const knownZero = voteCounts && !Object.prototype.hasOwnProperty.call(voteCounts, tool.slug);
      // count === null signifie : le service de vote n'a pas répondu au moment
      // du build. Ce n'est pas la même chose qu'un slug absent de la réponse
      // (ça, c'est un vrai zéro). Voir la règle d'honnêteté du projet.
      const count = voteCounts ? (knownZero ? 0 : voteCounts[tool.slug]) : null;
      const subAttr = tool.subcategory ? ` data-sub="${escapeHtml(tool.subcategory.toLowerCase())}"` : '';
      // Trois états, et le zéro n'est pas affiché : « 0 vote » répété sur cinq
      // cents cartes occupe la place d'un chiffre sans en porter un. Le décompte
      // exact reste dit au lecteur d'écran. Rien n'est caché, rien n'est inventé.
      const voteText = count === null
        ? `<span class="visually-hidden">${escapeHtml(t.voteUnavailable)}</span>`
        : count === 0
          ? `<span class="visually-hidden">${escapeHtml(pluralize(0, lang, singularTpl, pluralTpl))}</span>`
          : escapeHtml(pluralize(count, lang, singularTpl, pluralTpl));
      const votesAttr = count === null ? '' : ` data-votes="${count}"`;
      // Le point qui sépare les votes du reste est posé par la feuille, et
      // seulement quand un décompte se voit : jamais un « · » orphelin.
      // Le tri « prix » ne compare que des mensualités : un paiement unique
      // n'a pas de prix au mois, il passe en fin de liste plutôt que d'être
      // classé contre des abonnements comme s'il en était un.
      const priceAttr = MONTHLY_BASES.has(tool.pricing.basis) ? ` data-price="${tool.pricing.amount}"` : '';
      const diy = ui.diyTimeEstimate?.[tool.diyTimeEstimate];
      const diyPart = diy
        ? `<span class="dot" aria-hidden="true">·</span><span>${escapeHtml(interpolate(h.cardDiyTemplate, { time: diy }))}</span>`
        : '';
      const alts = tool.alternativeNames ?? [];
      const altsLine = alts.length === 0 ? ''
        : `\n<p class="alts"><span>${escapeHtml(h.cardAltsLabel)}</span> ${escapeHtml(alts.join(', '))}</p>`;

      return `<li class="card" data-slug="${tool.slug}" data-category="${tool.category}" data-verdict="${tool.verdict}" data-priority="${tool.pagePriority}"${votesAttr}${priceAttr}${subAttr}>
<div class="card-top"><img class="fav" src="${escapeHtml(favicon)}" alt="" width="32" height="32" loading="lazy" decoding="async"><${hn} class="card-name"><a href="${tool.path}">${escapeHtml(tool.name)}</a></${hn}>${verdictBadge(tool.verdict, verdict.label)}</div>
<p class="cat">${escapeHtml(catLabel)}</p><p class="tagline">${escapeHtml(tool.tagline ?? '')}</p>
<p class="facts"><span class="price">${escapeHtml(price)}</span>${diyPart}<span class="votes" data-vote-cell>${voteText}</span></p>${altsLine}</li>`;
    })
    .join('\n');

  return `      <div id="tool-table" data-lang="${lang}" data-singular="${escapeHtml(singularTpl)}" data-plural="${escapeHtml(pluralTpl)}">
        <ul class="tool-grid" id="tool-rows" aria-label="${escapeHtml(h.rankNote)}">
${cards}
        </ul>
      </div>`;
}
