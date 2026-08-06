import { escapeHtml, renderLayout, renderBreadcrumb } from './site-html.mjs';
import { organizationJsonLd, breadcrumbJsonLd } from './site-seo.mjs';
import { formatMoney, interpolate } from './site-format.mjs';
import {
  RAIL_SLOTS, TAPE_TOP_SLOTS, TAPE_BOTTOM_SLOTS,
  RAIL_LADDER_USD, TAPE_LADDER_USD,
} from './site-sponsors.mjs';

export const SPONSOR_EMAIL = 'sponsor@saasmadefree.com';

/** Une ligne par marche : la n-ième ligne donne le prix du slot suivant quand
 *  n slots sont déjà pris. Le barème est publié parce qu'on vend une rareté —
 *  annoncer un prix qui monte sans montrer la règle serait invérifiable. */
function ladderTable(ladder, heading, s) {
  const rows = ladder
    .map((price, i) => `<tr><td>${escapeHtml(i)}</td><td>$${escapeHtml(price)}</td></tr>`)
    .join('\n          ');
  return `      <table class="sp-ladder">
        <caption>${escapeHtml(heading)}</caption>
        <thead><tr><th scope="col">${escapeHtml(s.ladderRankColumn)}</th><th scope="col">${escapeHtml(s.ladderPriceColumn)}</th></tr></thead>
        <tbody>
          ${rows}
        </tbody>
      </table>`;
}

function inventoryList(slots, sponsors, s) {
  const items = slots
    .map((slot) => {
      const taken = sponsors.bySlot.has(slot);
      return `        <li class="sp-inv-item ${taken ? 'taken' : 'open'}">`
        + `<span class="sp-inv-slot">${escapeHtml(slot)}</span> `
        + `<span class="sp-inv-state">${escapeHtml(taken ? s.takenLabel : s.openLabel)}</span></li>`;
    })
    .join('\n');
  return `      <ul class="sp-inv">\n${items}\n      </ul>`;
}

/**
 * La page qui vend les emplacements.
 *
 * Elle n'affiche aucun chiffre d'audience : le site n'a pas d'analytics
 * (principe 4 de .impeccable.md), donc aucun trafic n'est mesurable, et le
 * principe 3 interdit d'afficher un nombre qu'on ne peut pas calculer. Tout ce
 * qu'elle montre est lu du catalogue au moment du build.
 *
 * Les libellés des chiffres sont ceux de l'accueil (ui.site.home.figure*) :
 * une seule traduction pour une seule notion, dans les sept locales.
 */
export function renderSponsorPage({
  lang, path, ui, alternates, xDefaultPath, homePath, sponsors, sponsorSlots, figures,
}) {
  const site = ui.site;
  const s = site.sponsor;
  // Même motif que renderFigures dans site-page-home.mjs : un chiffre du
  // catalogue passe par Intl.NumberFormat avant d'être affiché, sinon
  // l'accueil et cette page divergeraient (ex. "1 234" contre "1234") le
  // jour où toolsPublished franchit 1 000.
  const n = (value) => new Intl.NumberFormat(lang).format(value);

  const breadcrumbItems = [
    { label: site.directoryLabel, href: homePath },
    { label: s.h1, href: path },
  ];

  const steps = s.howSteps.map((step) => `        <li>${escapeHtml(step)}</li>`).join('\n');

  // La meta description annonce la taille de l'inventaire ("8 blocs, 20
  // places") : ces deux comptes sont dérivés des constantes exportées par
  // site-sponsors.mjs, jamais écrits en dur dans ui.json — sinon la phrase
  // mentirait en silence le jour où l'inventaire change de forme.
  const railCount = RAIL_SLOTS.length;
  const tapeCount = TAPE_TOP_SLOTS.length + TAPE_BOTTOM_SLOTS.length;
  const description = interpolate(s.metaDescription, { railCount, tapeCount });

  const main = `    ${renderBreadcrumb(breadcrumbItems)}
    <h1>${escapeHtml(s.h1)}</h1>
    <p class="lede">${escapeHtml(s.lede)}</p>

    <section>
      <h2>${escapeHtml(s.noAnalyticsHeading)}</h2>
      <p>${escapeHtml(s.noAnalyticsBody)}</p>
      <ul class="sp-figures">
        <li><strong>${escapeHtml(n(figures.toolsPublished))}</strong> ${escapeHtml(site.home.figureToolsPublished)}</li>
        <li><strong>${escapeHtml(n(figures.categories))}</strong> ${escapeHtml(site.home.figureCategories)}</li>
        <li><strong>${escapeHtml(n(figures.languages))}</strong> ${escapeHtml(site.home.figureLanguages)}</li>
        <li><strong>${escapeHtml(formatMoney(figures.totalMonthlyUsd, 'USD', lang))}</strong> ${escapeHtml(site.home.figureTotalPrice)}</li>
      </ul>
    </section>

    <section>
      <h2>${escapeHtml(s.inventoryHeading)}</h2>
      <h3>${escapeHtml(s.railHeading)}</h3>
${inventoryList(RAIL_SLOTS, sponsors, s)}
      <h3>${escapeHtml(s.tapeTopHeading)}</h3>
${inventoryList(TAPE_TOP_SLOTS, sponsors, s)}
      <h3>${escapeHtml(s.tapeBottomHeading)}</h3>
${inventoryList(TAPE_BOTTOM_SLOTS, sponsors, s)}
    </section>

    <section>
      <h2>${escapeHtml(s.ladderHeading)}</h2>
      <p>${escapeHtml(s.ladderBody)}</p>
      <div class="two-col">
${ladderTable(RAIL_LADDER_USD, s.ladderRailHeading, s)}
${ladderTable(TAPE_LADDER_USD, s.ladderTapeHeading, s)}
      </div>
      <h3>${escapeHtml(s.lockHeading)}</h3>
      <p>${escapeHtml(s.lockBody)}</p>
    </section>

    <section>
      <h2>${escapeHtml(s.howHeading)}</h2>
      <ol>
${steps}
      </ol>
      <p>${escapeHtml(s.noReportingNote)}</p>
    </section>

    <section>
      <h2>${escapeHtml(s.transparencyHeading)}</h2>
      <p>${escapeHtml(s.transparencyBody)}</p>
    </section>

    <p><a class="sp-contact" href="mailto:${SPONSOR_EMAIL}">${escapeHtml(s.contactCta)} →</a></p>`;

  return renderLayout({
    lang,
    path,
    title: s.titleTag,
    description,
    alternates,
    xDefaultPath,
    jsonLd: [organizationJsonLd(), breadcrumbJsonLd(breadcrumbItems)],
    main,
    ui,
    homeHref: homePath,
    sponsorSlots,
  });
}
