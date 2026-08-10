import { escapeHtml, renderLayout, renderBreadcrumb } from './site-html.mjs';
import { organizationJsonLd, breadcrumbJsonLd } from './site-seo.mjs';
import { formatMoney, interpolate } from './site-format.mjs';
import {
  RAIL_SLOTS, TAPE_TOP_SLOTS, TAPE_BOTTOM_SLOTS,
  RAIL_LADDER_USD, TAPE_LADDER_USD,
} from './site-sponsors.mjs';
import { SPONSOR_SLOTS_API_URL } from './site-data.mjs';

export const SPONSOR_EMAIL = 'sponsor@saasmadefree.com';

/** Une ligne par marche : la n-ième ligne donne le prix du slot suivant quand
 *  n slots sont déjà pris. Le barème est publié parce qu'on vend une rareté —
 *  annoncer un prix qui monte sans montrer la règle serait invérifiable.
 *
 *  Les montants passent par formatMoney, comme le total du catalogue vingt
 *  lignes plus bas : un "$1259" brut se lit comme une année sur une page
 *  française. L'en-tête de la colonne des prix porte la période (perDays, la
 *  chaîne déjà affichée sur les cartes) — sans elle le tableau annonçait un
 *  montant sans dire ce qu'il achète. */
function ladderTable(ladder, heading, s, lang) {
  const rows = ladder
    .map((price, i) => `<tr><td>${escapeHtml(i)}</td><td>${escapeHtml(formatMoney(price, 'USD', lang))}</td></tr>`)
    .join('\n          ');
  return `      <table class="sp-ladder">
        <caption>${escapeHtml(heading)}</caption>
        <thead><tr><th scope="col">${escapeHtml(s.ladderRankColumn)}</th><th scope="col">${escapeHtml(s.ladderPriceColumn)} ${escapeHtml(s.perDays)}</th></tr></thead>
        <tbody>
          ${rows}
        </tbody>
      </table>`;
}

/** Un nombre fini, prêt à être affiché — jamais NaN ni undefined. Distingue
 *  un champ absent/mal formé (on n'affiche rien pour ce chiffre-là) d'un
 *  champ présent qui vaut vraiment zéro (un tableau vide, un compteur à 0),
 *  qui reste un chiffre vrai et doit s'afficher tel quel. */
function isRealNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Les chiffres d'audience de la section « ce qu'on mesure », lus du payload
 *  de l'API stats (STATS_API_URL, voir site-data.mjs::fetchStats) — jamais
 *  ailleurs. Les libellés viennent de ui.site.stats : ce sont ceux déjà
 *  publiés sur /stats (site-page-stats.mjs), pas une traduction parallèle.
 *  N'est appelée que quand `stats` n'est pas null — voir renderSponsorPage.
 *
 *  `stats` traverse une frontière HTTP (voir fetchStats, qui ne vérifie que
 *  « c'est un objet ») : un déploiement worker désynchronisé du site pourrait
 *  livrer un payload dont la forme imbriquée est incomplète. Chaque chiffre
 *  est donc vérifié indépendamment avant d'être affiché — un champ absent ou
 *  d'un type inattendu fait disparaître CE chiffre, jamais les autres, et
 *  jamais en `0` ou en `NaN` de repli (principe 3 de .impeccable.md : un
 *  nombre qu'on ne peut pas calculer ne s'affiche pas). Renvoie `null` si
 *  aucun chiffre n'a pu être calculé, pour que l'appelant retombe sur le même
 *  message que le cas `stats === null`. */
function audienceFigures(stats, statsUi, n) {
  const items = [];

  if (isRealNumber(stats.visitors7d)) {
    items.push([stats.visitors7d, statsUi.visitorDays]);
  }
  if (Array.isArray(stats.views14d)) {
    // Un tableau vide est une vraie donnée (0 vue mesurée) ; une entrée dont
    // `views` n'est pas un nombre exploitable compte pour 0 dans la somme
    // plutôt que de propager un NaN à tout le total.
    const total = stats.views14d.reduce((sum, day) => sum + (isRealNumber(day?.views) ? day.views : 0), 0);
    items.push([total, statsUi.views14d]);
  }
  if (stats.copies7d && isRealNumber(stats.copies7d.total)) {
    items.push([stats.copies7d.total, statsUi.promptsCopied]);
  }
  if (Array.isArray(stats.crawlers7d)) {
    items.push([stats.crawlers7d.length, statsUi.crawlers]);
  }

  if (items.length === 0) return null;

  const rows = items
    .map(([value, label]) => `<li><strong>${escapeHtml(n(value))}</strong> ${escapeHtml(label)}</li>`)
    .join('\n        ');
  return `      <ul class="sp-figures">
        ${rows}
      </ul>`;
}

/**
 * Une ligne d'inventaire par slot, statut et prix lus de la MÊME vue que les
 * rails et les bandeaux : `sponsors.occupancy` (voir mergeOccupancy dans
 * site-sponsors.mjs) pour le statut, `sponsors.prices` pour le montant.
 *
 * C'est le point de la correction : ce tableau dérivait autrefois son propre
 * état de la charge utile du Worker pendant que les cartes dérivaient le leur
 * de data/sponsors.json, et la même page pouvait annoncer 149 $US dans une
 * ligne et 219 $US sur la carte du même emplacement. Il n'y a plus qu'une
 * occupation, fusionnée une fois par page.
 *
 * Le prix ne vient PLUS du champ `priceCents` de la charge utile : ce serait
 * réintroduire une seconde source. Il vient du barème publié quelques
 * paragraphes plus bas sur cette page même, indexé par le nombre de slots
 * vendus — un lecteur peut donc vérifier le montant qu'on lui annonce en
 * comptant les lignes « pris » et en lisant le tableau du barème. Un prix lu
 * de la charge utile contredirait ce tableau dès que les deux sources
 * divergent.
 *
 * `data-sold` porte l'axe « compte dans le barème » (un `reserved` bloque le
 * slot sans le faire compter) pour que le rafraîchissement client
 * (enhanceSponsorInventory, scripts/assets/site.js) applique exactement la
 * même règle que le build. `data-sponsor-ladder` porte le barème du
 * compartiment, sérialisé depuis les constantes du module — jamais retapé.
 */
function inventoryList(slots, sponsors, s, price, ladder, lang) {
  const items = slots
    .map((slot) => {
      const { taken, sold } = sponsors.occupancy.get(slot);
      // `price` n'est jamais null pour un slot libre — même invariant que
      // renderCard, documenté sur nextPriceUsd. La garde reste : si
      // l'invariant venait à tomber, l'emplacement du nombre doit rester vide
      // plutôt que d'afficher le "$0.00" que formatMoney(null) produirait.
      const priceText = price === null ? '' : escapeHtml(formatMoney(price, 'USD', lang));
      // Le span de prix existe pour CHAQUE slot libre : c'est
      // l'"emplacement du nombre" que le rafraîchissement client vient
      // remplacer sans jamais avoir à insérer un nouveau nœud dans la liste —
      // la mise en page ne bouge donc pas quand un montant change. Un slot
      // pris n'en a pas : il n'y a rien à annoncer pour lui.
      const priceSpan = taken ? '' : ` <span class="sp-inv-price">${priceText}</span>`;
      const soldAttr = sold ? ' data-sold="1"' : '';
      return `        <li class="sp-inv-item ${taken ? 'taken' : 'open'}" data-slot="${escapeHtml(slot)}"${soldAttr}>`
        + `<span class="sp-inv-slot">${escapeHtml(slot)}</span> `
        + `<span class="sp-inv-state">${escapeHtml(taken ? s.takenLabel : s.openLabel)}</span>${priceSpan}</li>`;
    })
    .join('\n');
  return `      <ul class="sp-inv" data-sponsor-ladder="${escapeHtml(ladder.join(','))}">\n${items}\n      </ul>`;
}

/**
 * La page qui vend les emplacements.
 *
 * Le site fait tourner ses propres analytics (beacon, page /stats publique,
 * Worker) — la section « ce qu'on mesure » le dit et montre de vrais chiffres
 * d'audience, lus de `stats` (le payload de STATS_API_URL, voir
 * site-data.mjs::fetchStats). Le principe 3 de .impeccable.md interdit
 * d'afficher un nombre qu'on ne peut pas calculer : si le service n'a pas
 * répondu au build, `stats` vaut null et aucun chiffre d'audience n'est
 * affiché — jamais un zéro qui se ferait passer pour une donnée. Un payload
 * présent mais partiel (voir audienceFigures) dégrade chiffre par chiffre,
 * jamais en bloc : un champ absent ou mal formé n'affiche pas CE chiffre-là
 * sans faire disparaître les autres, et sans jamais planter le build. Le lien
 * vers /{lang}/stats/ reste affiché dans tous les cas : c'est l'argument de
 * vente réel, on ne demande pas qu'on croie un chiffre tapé, on publie la
 * donnée.
 *
 * Le tableau d'inventaire, lui, ne fetche rien : il lit `sponsors`, le
 * contexte déjà fusionné par sponsorContext (voir mergeOccupancy dans
 * site-sponsors.mjs), qui a croisé data/sponsors.json avec la charge utile du
 * Worker une seule fois pour toute la page. Un slot que le Worker dit `paid`
 * s'affiche donc pris ici ET sur les rails, même si data/sponsors.json ne le
 * sait pas encore (paiement encaissé, créa pas commitée) ; une charge utile
 * absente fait retomber toute la page sur data/sponsors.json — le prix, lui,
 * reste calculable dans les deux cas, puisqu'il vient du barème publié plus
 * bas indexé par l'occupation, pas de la charge utile. La section porte un
 * attribut `data-sponsor-slots-endpoint` pour que scripts/assets/site.js
 * puisse rafraîchir ce même inventaire côté client, en pure amélioration
 * progressive (principe 5) : la page est déjà complète et correcte sans lui.
 *
 * Les chiffres du catalogue (toolsPublished, etc.) restent affichés en plus,
 * avec les libellés de l'accueil (ui.site.home.figure*) : une seule
 * traduction pour une seule notion, dans les sept locales.
 */
export function renderSponsorPage({
  lang, path, ui, alternates, xDefaultPath, homePath, sponsors, sponsorSlots, figures, stats = null,
}) {
  const site = ui.site;
  const s = site.sponsor;
  // Même motif que renderFigures dans site-page-home.mjs : un chiffre du
  // catalogue passe par Intl.NumberFormat avant d'être affiché, sinon
  // l'accueil et cette page divergeraient (ex. "1 234" contre "1234") le
  // jour où toolsPublished franchit 1 000.
  const n = (value) => new Intl.NumberFormat(lang).format(value);

  // La page /stats existe dans chaque langue (voir build-site.mjs) au même
  // chemin que celui construit là-bas : /{lang}/stats/.
  const statsPath = `${homePath}stats/`;
  // audienceFigures renvoie null si stats est un payload incomplet dont
  // aucun champ n'était exploitable (voir sa doc) : même message que
  // stats === null, plutôt qu'une section vide ou un <ul> sans rien dedans.
  const audienceFiguresHtml = stats ? audienceFigures(stats, site.stats, n) : null;
  const audienceBlock = audienceFiguresHtml ?? `      <p>${escapeHtml(s.statsUnavailableNote)}</p>`;

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
      <h2>${escapeHtml(s.measuredHeading)}</h2>
      <p>${escapeHtml(s.measuredIntro)}</p>
${audienceBlock}
      <p><a href="${statsPath}">${escapeHtml(s.statsLinkCta)} →</a></p>
      <p>${escapeHtml(s.catalogueFiguresNote)}</p>
      <ul class="sp-figures">
        <li><strong>${escapeHtml(n(figures.toolsPublished))}</strong> ${escapeHtml(site.home.figureToolsPublished)}</li>
        <li><strong>${escapeHtml(n(figures.categories))}</strong> ${escapeHtml(site.home.figureCategories)}</li>
        <li><strong>${escapeHtml(n(figures.languages))}</strong> ${escapeHtml(site.home.figureLanguages)}</li>
        <li><strong>${escapeHtml(formatMoney(figures.totalMonthlyUsd, 'USD', lang))}</strong> ${escapeHtml(site.home.figureTotalPrice)}</li>
      </ul>
    </section>

    <section data-sponsor-slots-endpoint="${escapeHtml(SPONSOR_SLOTS_API_URL)}"
      data-sponsor-open-label="${escapeHtml(s.openLabel)}" data-sponsor-taken-label="${escapeHtml(s.takenLabel)}">
      <h2>${escapeHtml(s.inventoryHeading)}</h2>
      <h3>${escapeHtml(s.railHeading)}</h3>
${inventoryList(RAIL_SLOTS, sponsors, s, sponsors.prices.rail, RAIL_LADDER_USD, lang)}
      <h3>${escapeHtml(s.tapeTopHeading)}</h3>
${inventoryList(TAPE_TOP_SLOTS, sponsors, s, sponsors.prices.top, TAPE_LADDER_USD, lang)}
      <h3>${escapeHtml(s.tapeBottomHeading)}</h3>
${inventoryList(TAPE_BOTTOM_SLOTS, sponsors, s, sponsors.prices.bottom, TAPE_LADDER_USD, lang)}
    </section>

    <section>
      <h2>${escapeHtml(s.ladderHeading)}</h2>
      <p>${escapeHtml(s.ladderBody)}</p>
      <div class="two-col">
${ladderTable(RAIL_LADDER_USD, s.ladderRailHeading, s, lang)}
${ladderTable(TAPE_LADDER_USD, s.ladderTapeHeading, s, lang)}
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
