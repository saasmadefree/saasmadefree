import { escapeHtml } from './site-html.mjs';
import { categoryLabel, categoryEmoji } from './site-data.mjs';
import { formatMonthlyPrice, pluralize } from './site-format.mjs';

/**
 * Table de directory partagée par la page d'accueil (avec recherche/filtre) et
 * les pages de catégorie (sans). Chaque `tool` doit déjà porter `tagline` et
 * `path` (voir buildToolViews dans build-site.mjs).
 */
export function renderToolTable(tools, { lang, ui, categories, voteCounts }) {
  const singularTpl = ui.site.tool.voteCountOne;
  const pluralTpl = ui.site.tool.voteCountOther;

  const rows = tools
    .map((tool) => {
      const catLabel = categoryLabel(categories, tool.category, lang);
      const emoji = categoryEmoji(categories, tool.category);
      const price = formatMonthlyPrice(tool.pricing, lang);
      const verdict = ui.site.verdicts[tool.verdict];
      const knownZero = voteCounts && !Object.prototype.hasOwnProperty.call(voteCounts, tool.slug);
      // count === null signifie : le service de vote n'a pas répondu au moment
      // du build. Ce n'est pas la même chose qu'un slug absent de la réponse
      // (ça, c'est un vrai zéro). Voir la règle d'honnêteté du projet.
      const count = voteCounts ? (knownZero ? 0 : voteCounts[tool.slug]) : null;
      const searchText = [tool.name, catLabel, tool.subcategory ?? '', tool.tagline ?? '']
        .join(' ')
        .toLowerCase();
      const voteCell = count === null
        ? `<span aria-hidden="true">–</span><span class="visually-hidden">${escapeHtml(ui.site.tool.voteUnavailable)}</span>`
        : escapeHtml(pluralize(count, lang, singularTpl, pluralTpl));
      const votesAttr = count === null ? '' : ` data-votes="${count}"`;

      return `          <tr data-slug="${tool.slug}" data-category="${tool.category}" data-priority="${tool.pagePriority}"${votesAttr} data-search="${escapeHtml(searchText)}">
            <td class="rank" aria-hidden="true"></td>
            <th scope="row"><a href="${tool.path}">${escapeHtml(tool.name)}</a></th>
            <td class="cat">${emoji ? `${emoji} ` : ''}${escapeHtml(catLabel)}</td>
            <td class="price">${escapeHtml(price)}</td>
            <td><span class="badge ${tool.verdict}">${escapeHtml(verdict.label)}</span></td>
            <td class="votes" data-vote-cell data-vote-slug="${tool.slug}">${voteCell}</td>
          </tr>`;
    })
    .join('\n');

  return `      <div class="table-scroll">
        <table id="tool-table" data-lang="${lang}" data-singular="${escapeHtml(singularTpl)}" data-plural="${escapeHtml(pluralTpl)}">
          <caption>${escapeHtml(ui.site.home.listCaption)}</caption>
          <thead>
            <tr>
              <td class="rank"><span class="visually-hidden">#</span></td>
              <th scope="col">${escapeHtml(ui.site.home.colName)}</th>
              <th scope="col">${escapeHtml(ui.site.home.colCategory)}</th>
              <th scope="col">${escapeHtml(ui.site.home.colPrice)}</th>
              <th scope="col">${escapeHtml(ui.site.home.colVerdict)}</th>
              <th scope="col">${escapeHtml(ui.site.home.colVotes)}</th>
            </tr>
          </thead>
          <tbody id="tool-rows">
${rows}
          </tbody>
        </table>
      </div>`;
}
