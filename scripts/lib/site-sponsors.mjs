// Emplacements sponsors : inventaire, barème, et sélection des placements
// actifs au jour du build. Seul module du site qui connaît le mot "sponsor" —
// tout le reste (renderLayout, build-site) ne fait que lui passer des données.
//
// Aucun prix n'est calculé par une formule : les deux échelles sont écrites en
// clair parce qu'elles sont publiées telles quelles sur /sponsor, et qu'un
// lecteur doit pouvoir vérifier le prix qu'on lui annonce.

import { escapeHtml } from './site-html.mjs';
import { PLACEHOLDER_PATH } from './site-favicons.mjs';
import { normalizeDomain } from './validate-rules.mjs';
import { formatMoney } from './site-format.mjs';

export const RAIL_SLOTS = ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4'];
export const RAIL_LEFT_SLOTS = ['L1', 'L2', 'L3', 'L4'];
export const RAIL_RIGHT_SLOTS = ['R1', 'R2', 'R3', 'R4'];

const tapeSlots = (prefix) =>
  Array.from({ length: 10 }, (_, i) => `${prefix}${String(i + 1).padStart(2, '0')}`);

export const TAPE_TOP_SLOTS = tapeSlots('T');
export const TAPE_BOTTOM_SLOTS = tapeSlots('B');

export const RAIL_LADDER_USD = [149, 219, 299, 429, 619, 879, 1259, 1800];
export const TAPE_LADDER_USD = [75, 99, 129, 169, 229, 299, 399, 519, 689, 900];

/** Les 28 emplacements, dans l'ordre où ils se vendent. Même liste — et même
 *  ordre — que l'ALL_SLOTS généré pour le Worker (voir scripts/build-feed.mjs). */
export const ALL_SLOTS = [...RAIL_SLOTS, ...TAPE_TOP_SLOTS, ...TAPE_BOTTOM_SLOTS];

/**
 * Placements dont la période couvre `today`, bornes incluses.
 *
 * Les dates sont comparées en chaînes ISO : `"2026-08-10"` se compare
 * lexicographiquement dans le bon ordre, ce qui évite d'instancier des Date et
 * de traîner un fuseau horaire dans un build qui doit être reproductible.
 *
 * @param {Array<object>} placements
 * @param {string} today - date ISO "YYYY-MM-DD"
 * @returns {{ bySlot: Map<string, object>, domains: string[] }}
 */
export function selectSponsors(placements, today) {
  const bySlot = new Map();
  const domains = new Set();
  for (const placement of placements ?? []) {
    if (placement.startsOn > today || placement.endsOn < today) continue;
    bySlot.set(placement.slot, placement);
    domains.add(placement.domain);
  }
  return { bySlot, domains: [...domains] };
}

/**
 * Prix du prochain slot d'un inventaire, en dollars.
 *
 * Rend `null` quand l'inventaire est plein — jamais un zéro qui se ferait
 * passer pour un prix (principe 3 de .impeccable.md). Aucun rendu n'observe
 * ce `null` : un inventaire plein n'a plus aucun slot vendable à afficher (un
 * slot compté « vendu » est forcément « pris », voir mergeOccupancy), donc les
 * cartes, les places et les lignes d'inventaire prennent toutes la branche
 * "occupé". L'invariant tient tant qu'il y a exactement une marche de barème
 * par slot, ce que verrouille le test "a une marche de prix par slot".
 *
 * Lève une erreur si `kind` n'est ni 'rail' ni 'tape' : silence sur un `kind`
 * inconnu serait une dégradation silencieuse des prix (ex. rail quoté au prix tape).
 *
 * Lève aussi sur un décompte négatif, pour la même raison : c'est un décompte
 * impossible, donc un bug d'appelant. Rendre `null` le faisait remonter jusqu'à
 * formatMoney, qui affichait "$0.00" — exactement le zéro qui se fait passer
 * pour une donnée que ce module interdit ailleurs.
 */
export function nextPriceUsd(kind, occupiedCount) {
  if (kind !== 'rail' && kind !== 'tape') {
    throw new Error(`nextPriceUsd: kind doit être 'rail' ou 'tape', reçu ${JSON.stringify(kind)}`);
  }
  if (!Number.isInteger(occupiedCount) || occupiedCount < 0) {
    throw new Error(
      `nextPriceUsd: occupiedCount doit être un entier positif ou nul, reçu ${JSON.stringify(occupiedCount)}`
    );
  }
  const ladder = kind === 'rail' ? RAIL_LADDER_USD : TAPE_LADDER_USD;
  return occupiedCount < ladder.length ? ladder[occupiedCount] : null;
}

// Statuts réellement produits par le Worker (voir readSlots dans
// worker/src/sponsors.mjs). Un statut absent de cet ensemble — champ mal
// formé, déploiement désynchronisé — n'est pas traité comme une donnée : le
// slot retombe sur data/sponsors.json, jamais sur une supposition.
export const LIVE_STATUSES = new Set(['open', 'reserved', 'paid']);

/**
 * L'occupation de l'inventaire, fusionnée une fois pour toute la page.
 *
 * C'est la SEULE notion d'occupation du site : les rails, les bandeaux, le
 * repli petits écrans et le tableau d'inventaire de /sponsor en dérivent tous
 * leur statut ET leur prix. Avant, deux notions coexistaient — l'une lue de
 * data/sponsors.json pour les cartes, l'autre de la charge utile du Worker
 * pour le tableau — et la même page annonçait deux prix différents pour le
 * même emplacement.
 *
 * Deux axes, parce que le statut et le prix ne répondent pas à la même
 * question :
 *
 * - `taken` — « ce slot est-il vendable aujourd'hui ? ». Non si
 *   data/sponsors.json y pose un placement actif, non si la charge utile le
 *   dit `paid`, non s'il est `reserved` (quelqu'un est en train de payer :
 *   l'afficher libre laisserait un second acheteur cliquer sur un emplacement
 *   déjà engagé).
 * - `sold` — « ce slot compte-t-il dans l'index du barème ? ». Un `reserved`
 *   NE compte PAS : c'est la règle du Worker (`paidCounts`, voir
 *   priceCentsFor dans worker/src/sponsors.mjs), et elle existe pour qu'une
 *   poignée de paniers abandonnés ne suffise pas à faire monter les prix
 *   affichés. Compter les réservations ici ferait diverger le prix publié du
 *   prix réellement facturé.
 *
 * La précédence entre les deux sources est VOLONTAIREMENT à sens unique : la
 * charge utile peut PROMOUVOIR un slot vers « pris » que data/sponsors.json
 * ignore encore (paiement encaissé, créa pas commitée), mais elle ne doit
 * JAMAIS pouvoir rouvrir un slot que data/sponsors.json sait occupé. Sans
 * cette garde, un sponsor commité à la main (donc toujours `open` côté D1,
 * puisque Stripe n'y a jamais touché) réapparaîtrait à la vente alors même que
 * sa carte s'affiche sur le rail — la page se contredirait elle-même.
 *
 * `liveSlots` traverse une frontière HTTP (voir fetchSponsorSlots, qui ne
 * vérifie que « c'est un objet ») : chaque slot est donc vérifié
 * indépendamment, jamais en bloc. Un champ absent ou du mauvais type ne fait
 * retomber QUE ce slot sur data/sponsors.json, sans jamais planter.
 *
 * @param {Map<string, object>} bySlot - placements actifs (selectSponsors)
 * @param {object|null} liveSlots - charge utile de fetchSponsorSlots
 * @returns {Map<string, {taken: boolean, sold: boolean}>}
 */
export function mergeOccupancy(bySlot, liveSlots) {
  const payload = liveSlots && typeof liveSlots === 'object' && !Array.isArray(liveSlots)
    ? liveSlots
    : null;
  const occupancy = new Map();
  for (const slot of ALL_SLOTS) {
    const local = bySlot.has(slot);
    const entry = payload ? payload[slot] : undefined;
    const known = Boolean(entry)
      && typeof entry === 'object'
      && !Array.isArray(entry)
      && LIVE_STATUSES.has(entry.status);
    occupancy.set(slot, {
      taken: local || (known && entry.status !== 'open'),
      sold: local || (known && entry.status === 'paid'),
    });
  }
  return occupancy;
}

/** Un lien sponsor est toujours tracé côté annonceur, jamais côté site : le
 *  projet n'a aucune analytics (principe 4), donc les UTM sont le seul moyen
 *  pour lui de mesurer ce qu'il achète. */
function sponsorHrefFor(placement) {
  const url = new URL(placement.url);
  url.searchParams.set('utm_source', 'saasmadefree');
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', `sponsor_${placement.slot}`);
  return url.toString();
}

/**
 * Icône auto-hébergée du sponsor, ou l'icône de repli neutre partagée.
 *
 * La table `favicons` est construite par fetchFavicons() et indexée par
 * `normalizeDomain(domaine)` : la lire avec le domaine brut du placement
 * ferait retomber silencieusement sur le repli dès qu'un opérateur écrit
 * "www.exemple.com" ou "Exemple.com". `npm run validate` refuse ces formes,
 * mais `npm run build` ne lance pas la validation — la normalisation doit
 * donc être faite ici aussi, au point de lecture.
 */
function sponsorIcon(ctx, placement) {
  return ctx.favicons[normalizeDomain(placement.domain)] ?? PLACEHOLDER_PATH;
}

/**
 * Contexte partagé par tous les rendus sponsor d'une page.
 * Calculé une fois par page pour ne pas refaire huit fois le même décompte.
 *
 * `occupancy` est la vue fusionnée (voir mergeOccupancy) : c'est elle, et elle
 * seule, qui décide du statut de chaque emplacement et de l'index de barème de
 * chaque compartiment. Les rails, les bandeaux, le repli et le tableau
 * d'inventaire de /sponsor la lisent tous — ils s'accordent donc par
 * construction, pas par coïncidence.
 *
 * `bySlot` reste à côté : c'est la créa à afficher (nom, icône, tagline), que
 * seul data/sponsors.json porte. Un slot peut être `taken` sans créa (payé
 * chez Stripe, pas encore commité) — d'où la carte « pris » sans lien.
 */
export function sponsorContext({
  placements, today, lang, ui, favicons = {}, sponsorHref, liveSlots = null,
}) {
  const { bySlot } = selectSponsors(placements, today);
  const occupancy = mergeOccupancy(bySlot, liveSlots);
  const soldCount = (slots) => slots.filter((slot) => occupancy.get(slot).sold).length;
  return {
    bySlot, occupancy, lang, sponsorHref,
    strings: ui.site.sponsor,
    favicons,
    prices: {
      rail: nextPriceUsd('rail', soldCount(RAIL_SLOTS)),
      top: nextPriceUsd('tape', soldCount(TAPE_TOP_SLOTS)),
      bottom: nextPriceUsd('tape', soldCount(TAPE_BOTTOM_SLOTS)),
    },
  };
}

/** Un emplacement est-il vendable aujourd'hui ? Toujours lu de la vue
 *  fusionnée, jamais recalculé sur place. */
function isTaken(ctx, slot) {
  return ctx.occupancy.get(slot)?.taken === true;
}

function renderCard(slot, ctx, price) {
  const s = ctx.strings;
  const placement = ctx.bySlot.get(slot);
  if (!placement && isTaken(ctx, slot)) {
    // Pris sans créa à afficher : le paiement est encaissé (ou une réservation
    // court) mais data/sponsors.json ne porte pas encore le placement. Ni
    // carte de sponsor — on n'a ni nom ni icône — ni carte libre : annoncer
    // « Slot libre — 149 $US — Réserver » sur un emplacement que le tableau
    // d'inventaire de la même page déclare pris, c'est la page qui se
    // contredit. Pas de lien non plus : il n'y a rien à réserver ici.
    return `<div class="sp-card taken" data-slot="${slot}">`
      + `<span class="sp-taken-label">${escapeHtml(s.takenLabel)}</span></div>`;
  }
  if (!placement) {
    // `price` n'est jamais null ici — voir l'invariant documenté sur
    // nextPriceUsd. Le montant passe par formatMoney comme tous les autres
    // chiffres du site : "$1259" sur une page française se lit comme une
    // année, et l'accueil affiche déjà "11 760,18 $US" pour le catalogue.
    const money = escapeHtml(formatMoney(price, 'USD', ctx.lang));
    return `<a class="sp-card open" data-slot="${slot}" href="${escapeHtml(ctx.sponsorHref)}">`
      + `<span class="sp-open-label">${escapeHtml(s.openLabel)}</span>`
      + `<span class="sp-price">${money}</span><span class="sp-per">${escapeHtml(s.perDays)}</span>`
      + `<span class="sp-cta">${escapeHtml(s.bookCta)} →</span></a>`;
  }
  const icon = sponsorIcon(ctx, placement);
  // Décision explicite du propriétaire du site (2026-08-06) : aucun marqueur
  // de sponsoring, ni visible ni dans rel — donc pas de "sponsored" ici. On
  // garde noopener car target="_blank" l'exige pour des raisons de sécurité
  // (empêcher la page ouverte d'accéder à window.opener), rien à voir avec le
  // SEO. Ce n'est pas un oubli : ne pas réintroduire "sponsored" par réflexe.
  return `<a class="sp-card live" data-slot="${slot}" href="${escapeHtml(sponsorHrefFor(placement))}"`
    + ` target="_blank" rel="noopener">`
    + `<img class="sp-icon" src="${escapeHtml(icon)}" alt="" width="32" height="32" loading="lazy">`
    + `<span class="sp-name">${escapeHtml(placement.name)}</span>`
    + `<span class="sp-tagline">${escapeHtml(placement.tagline[ctx.lang] ?? '')}</span></a>`;
}

// Décision du propriétaire du site (2026-08-06, étendue le jour même) : le mot
// "Sponsors" n'apparaît nulle part dans le balisage des emplacements — ni en
// titre visible, ni en nom accessible. La décision de ne poser aucun marqueur
// de sponsoring couvre toutes ses occurrences, pas seulement rel="sponsored".
//
// Les rails restent des <aside> : un repère complémentaire sans nom
// accessible reste valide, et la perte de navigabilité (un lecteur d'écran ne
// distingue pas les deux repères dans sa liste) a été acceptée explicitement.
// Ne pas réintroduire d'aria-label par réflexe — un test le verrouille.
export function renderRail(side, ctx) {
  const slots = side === 'left' ? RAIL_LEFT_SLOTS : RAIL_RIGHT_SLOTS;
  const cards = slots.map((slot) => renderCard(slot, ctx, ctx.prices.rail)).join('');
  return `<aside class="sp-rail sp-${side}">${cards}</aside>`;
}

export function renderRailFallback(ctx) {
  const cards = RAIL_SLOTS.map((slot) => renderCard(slot, ctx, ctx.prices.rail)).join('');
  return `<aside class="sp-fallback">`
    + `<div class="sp-fallback-grid">${cards}</div></aside>`;
}

function renderTapeItem(slot, ctx, price, { hidden = false } = {}) {
  const s = ctx.strings;
  const placement = ctx.bySlot.get(slot);
  // La copie dupliquée de la piste (voir renderTape) est purement visuelle :
  // aria-hidden la retire de l'arbre d'accessibilité, inert la retire du focus
  // clavier. Sans inert, un lecteur d'écran l'ignorerait mais un utilisateur
  // clavier tabulerait quand même à travers vingt liens fantômes.
  const hiddenAttrs = hidden ? ' aria-hidden="true" inert' : '';
  if (!placement && isTaken(ctx, slot)) {
    // Même raison que la carte « pris » de renderCard : une place vendue sans
    // créa commitée ne s'annonce pas libre, et n'est pas un lien.
    return `<span class="sp-tape-item taken" data-slot="${slot}"${hiddenAttrs}>${escapeHtml(s.takenLabel)}</span>`;
  }
  if (!placement) {
    // Même invariant et même formatage monétaire que renderCard. Le montant
    // vit dans son propre <span>, comme .sp-price sur la carte de rail : sans
    // lui, le rafraîchissement client (site.js) ne pourrait pas remplacer le
    // prix d'une place sans réécrire le nœud de texte entier — et la page
    // annoncerait deux montants différents pour le même compartiment dès
    // qu'une vente fait monter le barème entre le build et la visite.
    const money = `<span class="sp-tape-price">${escapeHtml(formatMoney(price, 'USD', ctx.lang))}</span>`;
    const body = `${escapeHtml(s.openLabel)} — ${money}`;
    return `<a class="sp-tape-item open" data-slot="${slot}" href="${escapeHtml(ctx.sponsorHref)}"${hiddenAttrs}>${body}</a>`;
  }
  const icon = sponsorIcon(ctx, placement);
  // Même décision assumée que dans renderCard : pas de "sponsored", noopener
  // conservé pour la sécurité de target="_blank" uniquement.
  return `<a class="sp-tape-item live" data-slot="${slot}" href="${escapeHtml(sponsorHrefFor(placement))}"`
    + ` target="_blank" rel="noopener"${hiddenAttrs}>`
    + `<img src="${escapeHtml(icon)}" alt="" width="18" height="18" loading="lazy">`
    + `<span>${escapeHtml(placement.name)}</span>`
    + `<span class="sp-tape-tagline">${escapeHtml(placement.tagline[ctx.lang] ?? '')}</span></a>`;
}

export function renderTape(position, ctx) {
  const slots = position === 'top' ? TAPE_TOP_SLOTS : TAPE_BOTTOM_SLOTS;
  const price = ctx.prices[position];
  const items = slots.map((slot) => renderTapeItem(slot, ctx, price)).join('');
  const hiddenItems = slots.map((slot) => renderTapeItem(slot, ctx, price, { hidden: true })).join('');
  // La piste est écrite deux fois : l'animation translate de -50%, donc la
  // seconde moitié prend exactement la place de la première et la boucle ne
  // saute pas. Même technique que le bandeau de prix déjà en place. La seconde
  // moitié est marquée aria-hidden/inert item par item (voir renderTapeItem).
  //
  // Aucun aria-label ici non plus : même décision de propriétaire que pour les
  // rails, et de toute façon aria-label sur un <div> nu est interdit par la
  // spec (name-prohibited) — les technologies d'assistance l'ignoraient déjà.
  return `<div class="sponsor-tape sp-${position}">`
    + `<div class="sp-tape-marquee"><div class="sp-tape-track">${items}${hiddenItems}</div></div></div>`;
}

/**
 * Tout le balisage sponsor d'une page, déjà rendu.
 *
 * C'est le seul point d'entrée utilisé par renderLayout : lui passer des chaînes
 * plutôt que le contexte évite que site-html.mjs importe ce module, et donc le
 * cycle d'imports entre les deux.
 */
export function renderSponsorSlots(ctx) {
  return {
    tapeTop: renderTape('top', ctx),
    tapeBottom: renderTape('bottom', ctx),
    railLeft: renderRail('left', ctx),
    railRight: renderRail('right', ctx),
    fallback: renderRailFallback(ctx),
  };
}
