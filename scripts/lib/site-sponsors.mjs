// Emplacements sponsors : inventaire, barème, et sélection des placements
// actifs au jour du build. Seul module du site qui connaît le mot "sponsor" —
// tout le reste (renderLayout, build-site) ne fait que lui passer des données.
//
// Aucun prix n'est calculé par une formule : les deux échelles sont écrites en
// clair parce qu'elles sont publiées telles quelles sur /sponsor, et qu'un
// lecteur doit pouvoir vérifier le prix qu'on lui annonce.

export const RAIL_SLOTS = ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4'];
export const RAIL_LEFT_SLOTS = ['L1', 'L2', 'L3', 'L4'];
export const RAIL_RIGHT_SLOTS = ['R1', 'R2', 'R3', 'R4'];

const tapeSlots = (prefix) =>
  Array.from({ length: 10 }, (_, i) => `${prefix}${String(i + 1).padStart(2, '0')}`);

export const TAPE_TOP_SLOTS = tapeSlots('T');
export const TAPE_BOTTOM_SLOTS = tapeSlots('B');

export const RAIL_LADDER_USD = [149, 219, 299, 429, 619, 879, 1259, 1800];
export const TAPE_LADDER_USD = [75, 99, 129, 169, 229, 299, 399, 519, 689, 900];

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
 * Rend `null` quand l'inventaire est plein : l'appelant doit alors afficher
 * "complet" plutôt qu'un montant, jamais un zéro qui se ferait passer pour un
 * prix (principe 3 de .impeccable.md).
 *
 * Lève une erreur si `kind` n'est ni 'rail' ni 'tape' : silence sur un `kind`
 * inconnu serait une dégradation silencieuse des prix (ex. rail quoté au prix tape).
 */
export function nextPriceUsd(kind, occupiedCount) {
  if (kind !== 'rail' && kind !== 'tape') {
    throw new Error(`nextPriceUsd: kind doit être 'rail' ou 'tape', reçu ${JSON.stringify(kind)}`);
  }
  if (occupiedCount < 0) {
    return null;
  }
  const ladder = kind === 'rail' ? RAIL_LADDER_USD : TAPE_LADDER_USD;
  return occupiedCount < ladder.length ? ladder[occupiedCount] : null;
}

import { escapeHtml } from './site-html.mjs';
import { PLACEHOLDER_PATH } from './site-favicons.mjs';

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
 * Contexte partagé par tous les rendus sponsor d'une page.
 * Calculé une fois par page pour ne pas refaire huit fois le même décompte.
 */
export function sponsorContext({ placements, today, lang, ui, favicons = {}, sponsorHref }) {
  const { bySlot } = selectSponsors(placements, today);
  const count = (slots) => slots.filter((slot) => bySlot.has(slot)).length;
  return {
    bySlot, lang, sponsorHref,
    strings: ui.site.sponsor,
    favicons,
    prices: {
      rail: nextPriceUsd('rail', count(RAIL_SLOTS)),
      top: nextPriceUsd('tape', count(TAPE_TOP_SLOTS)),
      bottom: nextPriceUsd('tape', count(TAPE_BOTTOM_SLOTS)),
    },
  };
}

function renderCard(slot, ctx, price) {
  const s = ctx.strings;
  const placement = ctx.bySlot.get(slot);
  if (!placement) {
    const body = price === null
      ? `<span class="sp-full">${escapeHtml(s.fullLabel)}</span>`
      : `<span class="sp-price">$${price}</span><span class="sp-per">${escapeHtml(s.perDays)}</span>`;
    return `<a class="sp-card open" data-slot="${slot}" href="${escapeHtml(ctx.sponsorHref)}">`
      + `<span class="sp-open-label">${escapeHtml(s.openLabel)}</span>${body}`
      + `<span class="sp-cta">${escapeHtml(s.bookCta)} →</span></a>`;
  }
  const icon = ctx.favicons[placement.domain] ?? PLACEHOLDER_PATH;
  return `<a class="sp-card live" data-slot="${slot}" href="${escapeHtml(sponsorHrefFor(placement))}"`
    + ` target="_blank" rel="sponsored noopener">`
    + `<img class="sp-icon" src="${escapeHtml(icon)}" alt="" width="32" height="32" loading="lazy">`
    + `<span class="sp-name">${escapeHtml(placement.name)}</span>`
    + `<span class="sp-tagline">${escapeHtml(placement.tagline[ctx.lang] ?? '')}</span>`
    + `<span class="sp-label">${escapeHtml(s.label)}</span></a>`;
}

export function renderRail(side, ctx) {
  const slots = side === 'left' ? RAIL_LEFT_SLOTS : RAIL_RIGHT_SLOTS;
  const cards = slots.map((slot) => renderCard(slot, ctx, ctx.prices.rail)).join('');
  return `<aside class="sp-rail sp-${side}" aria-label="${escapeHtml(ctx.strings.railAriaLabel)}">${cards}</aside>`;
}

export function renderRailFallback(ctx) {
  const cards = RAIL_SLOTS.map((slot) => renderCard(slot, ctx, ctx.prices.rail)).join('');
  return `<aside class="sp-fallback" aria-label="${escapeHtml(ctx.strings.railAriaLabel)}">`
    + `<h2 class="sp-fallback-h">${escapeHtml(ctx.strings.heading)}</h2>`
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
  if (!placement) {
    const body = price === null ? escapeHtml(s.fullLabel) : `${escapeHtml(s.openLabel)} — $${price}`;
    return `<a class="sp-tape-item open" data-slot="${slot}" href="${escapeHtml(ctx.sponsorHref)}"${hiddenAttrs}>${body}</a>`;
  }
  const icon = ctx.favicons[placement.domain] ?? PLACEHOLDER_PATH;
  return `<a class="sp-tape-item live" data-slot="${slot}" href="${escapeHtml(sponsorHrefFor(placement))}"`
    + ` target="_blank" rel="sponsored noopener"${hiddenAttrs}>`
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
  return `<div class="sponsor-tape sp-${position}" aria-label="${escapeHtml(ctx.strings.tapeAriaLabel)}">`
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
