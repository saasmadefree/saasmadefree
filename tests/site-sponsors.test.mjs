import { describe, it, expect } from 'vitest';
import {
  RAIL_SLOTS, TAPE_TOP_SLOTS, TAPE_BOTTOM_SLOTS, ALL_SLOTS,
  RAIL_LADDER_USD, TAPE_LADDER_USD,
  selectSponsors, nextPriceUsd, mergeOccupancy,
} from '../scripts/lib/site-sponsors.mjs';
import {
  sponsorContext, renderRail, renderTape, renderRailFallback, renderSponsorSlots,
} from '../scripts/lib/site-sponsors.mjs';
import { renderSponsorPage } from '../scripts/lib/site-page-sponsor.mjs';
import { PLACEHOLDER_PATH } from '../scripts/lib/site-favicons.mjs';
import { escapeHtml } from '../scripts/lib/site-html.mjs';
import { formatMoney } from '../scripts/lib/site-format.mjs';
import { SPONSOR_SLOTS_API_URL } from '../scripts/lib/site-data.mjs';

/** Le prix tel qu'il doit apparaître dans le HTML rendu : même formateur que
 *  le reste du site, jamais une chaîne retapée à la main dans le test. */
const usd = (amount, lang) => escapeHtml(formatMoney(amount, 'USD', lang));

/** Un chiffre d'audience tel qu'il doit apparaître : même Intl.NumberFormat
 *  que renderSponsorPage, jamais une chaîne retapée à la main. */
const n = (value, lang) => escapeHtml(new Intl.NumberFormat(lang).format(value));

const P = (slot, startsOn, endsOn, domain = 'postiz.com') => ({
  slot, name: 'Postiz', domain, url: `https://${domain}/`,
  tagline: { en: 'Schedule', fr: 'Programme' }, startsOn, endsOn,
});

describe("inventaire", () => {
  it("déclare 8 rails et 2 × 10 places défilantes", () => {
    expect(RAIL_SLOTS).toEqual(['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4']);
    expect(TAPE_TOP_SLOTS).toHaveLength(10);
    expect(TAPE_BOTTOM_SLOTS).toHaveLength(10);
    expect(TAPE_TOP_SLOTS[0]).toBe('T01');
    expect(TAPE_BOTTOM_SLOTS[9]).toBe('B10');
  });

  it("a une marche de prix par slot", () => {
    expect(RAIL_LADDER_USD).toHaveLength(RAIL_SLOTS.length);
    expect(TAPE_LADDER_USD).toHaveLength(TAPE_TOP_SLOTS.length);
  });
});

describe("selectSponsors", () => {
  it("retient un placement dont la période couvre le jour", () => {
    const { bySlot } = selectSponsors([P('L1', '2026-08-01', '2026-08-31')], '2026-08-10');
    expect(bySlot.get('L1').name).toBe('Postiz');
  });

  it("ignore un placement échu", () => {
    const { bySlot } = selectSponsors([P('L1', '2026-06-01', '2026-06-30')], '2026-08-10');
    expect(bySlot.has('L1')).toBe(false);
  });

  it("ignore un placement qui n'a pas commencé", () => {
    const { bySlot } = selectSponsors([P('L1', '2026-09-01', '2026-09-30')], '2026-08-10');
    expect(bySlot.has('L1')).toBe(false);
  });

  it("inclut les bornes de la période", () => {
    const p = [P('L1', '2026-08-10', '2026-08-10')];
    expect(selectSponsors(p, '2026-08-10').bySlot.has('L1')).toBe(true);
  });

  it("déduplique les domaines à télécharger", () => {
    const { domains } = selectSponsors(
      [P('L1', '2026-08-01', '2026-08-31'), P('R1', '2026-08-01', '2026-08-31')],
      '2026-08-10'
    );
    expect(domains).toEqual(['postiz.com']);
  });
});

describe("nextPriceUsd", () => {
  it("part du bas quand tout est libre", () => {
    expect(nextPriceUsd('rail', 0)).toBe(149);
    expect(nextPriceUsd('tape', 0)).toBe(75);
  });

  it("monte d'une marche par slot occupé", () => {
    expect(nextPriceUsd('rail', 3)).toBe(429);
    expect(nextPriceUsd('tape', 5)).toBe(299);
  });

  it("atteint la borne haute sur le dernier slot", () => {
    expect(nextPriceUsd('rail', 7)).toBe(1800);
    expect(nextPriceUsd('tape', 9)).toBe(900);
  });

  it("rend null quand il ne reste rien — jamais un prix inventé", () => {
    expect(nextPriceUsd('rail', 8)).toBe(null);
    expect(nextPriceUsd('tape', 10)).toBe(null);
  });

  it("lève une erreur sur un kind inconnu", () => {
    expect(() => nextPriceUsd('Rail', 0)).toThrow();
    expect(() => nextPriceUsd('unknown', 0)).toThrow();
    expect(() => nextPriceUsd(undefined, 0)).toThrow();
  });

  // Un décompte négatif est un décompte impossible, donc un bug d'appelant.
  // Rendre null le laissait remonter jusqu'à formatMoney, qui affichait
  // "$0.00" — le zéro qui se fait passer pour un prix que ce module interdit
  // partout ailleurs. Même garde que sur un `kind` inconnu.
  it("lève une erreur sur un décompte négatif ou non entier", () => {
    expect(() => nextPriceUsd('rail', -1)).toThrow();
    expect(() => nextPriceUsd('tape', -5)).toThrow();
    expect(() => nextPriceUsd('rail', 1.5)).toThrow();
    expect(() => nextPriceUsd('rail', undefined)).toThrow();
  });
});

// La vue fusionnée est la seule notion d'occupation du site : cartes de rail,
// places défilantes, repli petits écrans et tableau d'inventaire en dérivent
// tous statut ET prix. Deux notions parallèles faisaient annoncer deux prix
// différents pour le même emplacement sur la même page.
describe('mergeOccupancy', () => {
  const bySlot = (slots) => new Map(slots.map((slot) => [slot, { slot }]));

  it('couvre les 28 slots, même sans aucune source', () => {
    const occ = mergeOccupancy(new Map(), null);
    expect(occ.size).toBe(ALL_SLOTS.length);
    for (const slot of ALL_SLOTS) expect(occ.get(slot)).toEqual({ taken: false, sold: false });
  });

  it('un placement de data/sponsors.json est pris ET vendu', () => {
    const occ = mergeOccupancy(bySlot(['L1']), null);
    expect(occ.get('L1')).toEqual({ taken: true, sold: true });
  });

  it('la charge utile promeut vers « pris » un slot que data/sponsors.json ignore', () => {
    const occ = mergeOccupancy(new Map(), { L1: { status: 'paid' } });
    expect(occ.get('L1')).toEqual({ taken: true, sold: true });
  });

  // La promotion est UNIDIRECTIONNELLE : la charge utile ne doit jamais
  // pouvoir remettre en vente un slot que data/sponsors.json sait occupé
  // (sponsor commité à la main, donc toujours `open` côté D1).
  it('la charge utile ne peut jamais rouvrir un slot occupé localement', () => {
    const occ = mergeOccupancy(bySlot(['L1']), { L1: { status: 'open', priceCents: 14900, currency: 'USD' } });
    expect(occ.get('L1')).toEqual({ taken: true, sold: true });
  });

  // L'axe « vendu » suit la règle du Worker (paidCounts, priceCentsFor) : une
  // réservation bloque le slot sans faire monter le barème, sinon quelques
  // paniers abandonnés suffiraient à manipuler les prix affichés.
  it('une réservation prend le slot sans le compter dans le barème', () => {
    const occ = mergeOccupancy(new Map(), { L1: { status: 'reserved' } });
    expect(occ.get('L1')).toEqual({ taken: true, sold: false });
  });

  it('un slot absent, mal formé ou de statut inconnu retombe sur data/sponsors.json, seul', () => {
    const occ = mergeOccupancy(bySlot(['R1']), {
      L1: { status: 'weird' },
      L2: 'paid',
      L3: null,
      L4: ['paid'],
      T01: { status: 'paid' },
    });
    for (const slot of ['L1', 'L2', 'L3', 'L4']) {
      expect(occ.get(slot), slot).toEqual({ taken: false, sold: false });
    }
    expect(occ.get('R1')).toEqual({ taken: true, sold: true }); // repli local intact
    expect(occ.get('T01')).toEqual({ taken: true, sold: true }); // voisin bien lu
  });

  it('une charge utile qui n’est pas un objet exploitable est ignorée en bloc', () => {
    for (const payload of [null, undefined, ['L1'], 'L1', 42]) {
      const occ = mergeOccupancy(bySlot(['L1']), payload);
      expect(occ.get('L1'), String(payload)).toEqual({ taken: true, sold: true });
      expect(occ.get('L2'), String(payload)).toEqual({ taken: false, sold: false });
    }
  });
});

const ui = {
  site: {
    sponsor: {
      openLabel: 'Slot libre', takenLabel: 'Pris',
      perDays: '/ 30 jours', bookCta: 'Réserver',
    },
  },
};

const ctx = (placements, favicons = {}, liveSlots = null) => sponsorContext({
  placements, today: '2026-08-10', lang: 'fr', ui, favicons, sponsorHref: '/fr/sponsor', liveSlots,
});

const LIVE = {
  slot: 'L1', name: 'Postiz', domain: 'postiz.com', url: 'https://postiz.com/',
  tagline: { en: 'Schedule', fr: 'Programme tes posts' },
  startsOn: '2026-08-01', endsOn: '2026-08-31',
};

describe('carte de rail occupée', () => {
  const html = () => renderRail('left', ctx([LIVE], { 'postiz.com': '/assets/favicons/postiz.com.png' }));

  it('ouvre le lien en sécurité (noopener) dans un nouvel onglet', () => {
    expect(html()).toContain('rel="noopener"');
    expect(html()).toContain('target="_blank"');
  });

  it('porte les UTM du slot', () => {
    expect(html()).toContain('utm_source=saasmadefree');
    expect(html()).toContain('utm_campaign=sponsor_L1');
  });

  // Décision explicite du propriétaire du site (2026-08-06) : aucun marqueur
  // de sponsoring, ni visible ni dans rel.
  it('ne porte aucun marqueur de sponsoring', () => {
    expect(html()).not.toContain('sponsored');
    expect(html()).not.toContain('>Sponsor<');
  });

  it('sert l’icône depuis le site, jamais depuis un tiers', () => {
    expect(html()).toContain('src="/assets/favicons/postiz.com.png"');
    expect(html()).not.toContain('https://www.google.com');
  });

  // La table d'icônes est indexée par domaine normalisé (fetchFavicons) :
  // lue avec le domaine brut, un "www." ou une majuscule retombait en silence
  // sur l'icône de repli. `npm run validate` refuse ces formes, mais
  // `npm run build` ne lance pas la validation.
  it('retrouve l’icône même si le domaine du placement n’est pas normalisé', () => {
    const favicons = { 'postiz.com': '/assets/favicons/postiz.com.png' };
    for (const domain of ['www.postiz.com', 'Postiz.com', 'postiz.com.']) {
      const card = renderRail('left', ctx([{ ...LIVE, domain }], favicons));
      expect(card, domain).toContain('src="/assets/favicons/postiz.com.png"');
      expect(card, domain).not.toContain(PLACEHOLDER_PATH);
    }
  });

  it('retombe sur l’icône de repli quand le domaine n’a pas été résolu', () => {
    expect(renderRail('left', ctx([LIVE], {}))).toContain(`src="${PLACEHOLDER_PATH}"`);
  });

  it('affiche la tagline de la langue rendue', () => {
    expect(html()).toContain('Programme tes posts');
    expect(html()).not.toContain('Schedule');
  });
});

describe('carte de rail libre', () => {
  // Le contexte est rendu en `fr` : le prix doit sortir formaté par
  // formatMoney ("149 $US"), jamais en "$149" — sur une page française, un
  // "$1259" brut se lit comme une année.
  it('affiche le prix du jour, formaté par le formateur du projet', () => {
    const html = renderRail('left', ctx([]));
    expect(html).toContain(`<span class="sp-price">${usd(RAIL_LADDER_USD[0], 'fr')}</span>`);
    expect(html).toContain('href="/fr/sponsor"');
  });

  it('n’écrit jamais le sigil monétaire à la main', () => {
    expect(renderRail('left', ctx([]))).not.toMatch(/\$\d/);
  });

  it('monte d’une marche quand un rail est déjà pris', () => {
    // L1 occupé → le prochain rail libre coûte la 2e marche.
    expect(renderRail('left', ctx([LIVE]))).toContain(usd(RAIL_LADDER_USD[1], 'fr'));
  });

  it('rend un bloc par slot du côté demandé, jamais ceux de l’autre', () => {
    const html = renderRail('right', ctx([]));
    expect(html).toContain('data-slot="R1"');
    expect(html).not.toContain('data-slot="L1"');
  });
});

// Un slot payé chez Stripe avant que la créa ne soit commitée n'a ni nom ni
// icône à afficher — mais il n'est plus vendable. L'annoncer « Slot libre —
// 149 $US — Réserver » pendant que le tableau d'inventaire de la même page le
// déclare pris, c'est la page qui se contredit.
describe('carte de rail prise sans créa', () => {
  const takenCtx = (status) => ctx([], {}, { L1: { status } });

  for (const status of ['paid', 'reserved']) {
    it(`n’annonce ni prix ni CTA quand la charge utile dit "${status}"`, () => {
      const html = renderRail('left', takenCtx(status));
      const card = html.match(/<(?:a|div)[^>]*data-slot="L1"[^>]*>.*?<\/(?:a|div)>/s)[0];
      expect(card).toContain(ui.site.sponsor.takenLabel);
      expect(card).not.toContain(ui.site.sponsor.openLabel);
      expect(card).not.toContain(ui.site.sponsor.bookCta);
      expect(card).not.toContain('sp-price');
      // Rien à réserver : ce n'est pas un lien.
      expect(card).not.toContain('href=');
    });
  }

  // L'axe « vendu » gouverne le barème, l'axe « pris » gouverne le statut :
  // une réservation ne doit pas renchérir les autres emplacements (même règle
  // que paidCounts côté Worker).
  it('un slot payé fait monter le prix des autres, une réservation non', () => {
    expect(renderRail('right', takenCtx('paid'))).toContain(usd(RAIL_LADDER_USD[1], 'fr'));
    expect(renderRail('right', takenCtx('reserved'))).toContain(usd(RAIL_LADDER_USD[0], 'fr'));
  });

  it('la place défilante équivalente suit la même règle', () => {
    const html = renderTape('top', ctx([], {}, { T01: { status: 'paid' } }));
    const item = html.match(/<(?:a|span)[^>]*data-slot="T01"[^>]*>.*?<\/(?:a|span)>/s)[0];
    expect(item).toContain(ui.site.sponsor.takenLabel);
    expect(item).not.toContain('href=');
    // Le prochain prix a monté d'une marche pour les places restantes.
    expect(html).toContain(usd(TAPE_LADDER_USD[1], 'fr'));
  });
});

describe('échappement', () => {
  it('neutralise le HTML injecté dans un nom de sponsor', () => {
    const hostile = { ...LIVE, name: '<img src=x onerror=alert(1)>' };
    const html = renderRail('left', ctx([hostile]));
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });
});

describe('bandeau défilant', () => {
  it('duplique la piste pour boucler sans saut', () => {
    const html = renderTape('top', ctx([{ ...LIVE, slot: 'T01' }]));
    const occurrences = html.split('data-slot="T01"').length - 1;
    expect(occurrences).toBe(2);
  });

  it('reste lisible sans défilement — la piste porte le texte, pas une image', () => {
    expect(renderTape('top', ctx([{ ...LIVE, slot: 'T01' }]))).toContain('Postiz');
  });

  it('formate le prix d’une place libre comme partout ailleurs', () => {
    const html = renderTape('top', ctx([]));
    expect(html).toContain(usd(TAPE_LADDER_USD[0], 'fr'));
    expect(html).not.toMatch(/\$\d/);
  });

  // renderTapeItem construit son propre `rel` indépendamment de renderCard :
  // le verrou « aucun marqueur de sponsoring » ne couvrait que le chemin
  // rail/carte, donc une réintroduction de rel="sponsored" côté bandeau
  // serait passée sans qu'aucun test ne bouge.
  describe('place occupée — mêmes garanties que la carte de rail', () => {
    const html = () => renderTape(
      'top',
      ctx([{ ...LIVE, slot: 'T01' }], { 'postiz.com': '/assets/favicons/postiz.com.png' })
    );

    it('ne porte aucun marqueur de sponsoring', () => {
      expect(html()).not.toContain('sponsored');
      expect(html()).not.toContain('>Sponsor<');
    });

    it('ouvre le lien en sécurité (noopener) dans un nouvel onglet', () => {
      expect(html()).toContain('rel="noopener"');
      expect(html()).toContain('target="_blank"');
    });

    it('porte les UTM du slot', () => {
      expect(html()).toContain('utm_source=saasmadefree');
      expect(html()).toContain('utm_campaign=sponsor_T01');
    });

    it('sert l’icône depuis le site, jamais depuis un tiers', () => {
      expect(html()).toContain('src="/assets/favicons/postiz.com.png"');
      expect(html()).not.toContain('https://www.google.com');
    });

    it('retrouve l’icône même si le domaine du placement n’est pas normalisé', () => {
      const favicons = { 'postiz.com': '/assets/favicons/postiz.com.png' };
      const tape = renderTape('top', ctx([{ ...LIVE, slot: 'T01', domain: 'www.Postiz.com' }], favicons));
      expect(tape).toContain('src="/assets/favicons/postiz.com.png"');
      expect(tape).not.toContain(PLACEHOLDER_PATH);
    });

    it('neutralise le HTML injecté dans un nom de sponsor', () => {
      const hostile = { ...LIVE, slot: 'T01', name: '<img src=x onerror=alert(1)>' };
      const tape = renderTape('top', ctx([hostile]));
      expect(tape).not.toContain('<img src=x');
      expect(tape).toContain('&lt;img');
    });
  });

  it('retire la moitié dupliquée de l’arbre d’accessibilité et du focus clavier', () => {
    const html = renderTape('top', ctx([{ ...LIVE, slot: 'T01' }]));
    const secondOccurrence = html.indexOf('data-slot="T01"', html.indexOf('data-slot="T01"') + 1);
    const firstHalf = html.slice(0, secondOccurrence);
    const secondHalf = html.slice(secondOccurrence);
    // La piste visible ne doit porter ni aria-hidden ni inert…
    expect(firstHalf).not.toContain('aria-hidden="true"');
    expect(firstHalf).not.toContain('inert');
    // …la copie purement visuelle doit porter les deux : aria-hidden la retire
    // de l'arbre d'accessibilité, inert la retire du focus clavier.
    expect(secondHalf).toContain('aria-hidden="true"');
    expect(secondHalf).toContain('inert');
  });
});

describe('repli petits écrans', () => {
  it('reprend les 8 rails dans un seul bloc', () => {
    const html = renderRailFallback(ctx([]));
    for (const slot of ['L1', 'L4', 'R1', 'R4']) {
      expect(html).toContain(`data-slot="${slot}"`);
    }
  });

  it('ne porte plus de titre — le mot « Sponsors » a été retiré partout', () => {
    expect(renderRailFallback(ctx([]))).not.toContain('<h2');
  });
});

// Décision du propriétaire du site (2026-08-06, étendue le jour même) : la
// règle « aucun marqueur de sponsoring » couvre TOUTES les occurrences du mot,
// pas seulement rel="sponsored". Le mot ne doit donc apparaître ni en texte
// visible, ni en nom accessible, dans aucun emplacement.
//
// Volontairement restreint aux fonctions de rendu des emplacements : la page
// /sponsor porte légitimement le mot dans son <h1>, sa prose et son lien de
// navigation, et l'URL des emplacements pointe sur elle (/fr/sponsor), tout
// comme les UTM (utm_campaign=sponsor_L1) — ce sont des attributs, jamais du
// texte lu.
describe('aucune mention « Sponsor » dans le balisage des emplacements', () => {
  // Ce qu'un lecteur voit : on retire les balises, il ne reste que le texte.
  const visibleText = (html) => html.replace(/<[^>]+>/g, ' ');
  // Ce qu'une technologie d'assistance annonce en plus du texte.
  const accessibleNames = (html) =>
    [...html.matchAll(/\s(?:aria-label|aria-labelledby|title|alt)="([^"]*)"/g)]
      .map((m) => m[1]).join(' ');

  const favicons = { 'postiz.com': '/assets/favicons/postiz.com.png' };
  const free = ctx([]);
  const busy = ctx(
    [LIVE, { ...LIVE, slot: 'T01' }, { ...LIVE, slot: 'B01' }],
    favicons
  );
  // Emplacements pris sans créa commitée : troisième état du rendu, il doit
  // respecter la même règle que les deux autres.
  const held = ctx([], {}, { L1: { status: 'paid' }, T01: { status: 'reserved' } });
  const slots = renderSponsorSlots(busy);

  const cases = [
    ['rail gauche libre', renderRail('left', free)],
    ['rail droit libre', renderRail('right', free)],
    ['rail gauche occupé', renderRail('left', busy)],
    ['rail gauche pris sans créa', renderRail('left', held)],
    ['repli libre', renderRailFallback(free)],
    ['repli occupé', renderRailFallback(busy)],
    ['repli pris sans créa', renderRailFallback(held)],
    ['bandeau haut libre', renderTape('top', free)],
    ['bandeau haut occupé', renderTape('top', busy)],
    ['bandeau haut pris sans créa', renderTape('top', held)],
    ['bandeau bas occupé', renderTape('bottom', busy)],
    ...Object.entries(slots).map(([key, html]) => [`renderSponsorSlots.${key}`, html]),
  ];

  for (const [label, html] of cases) {
    it(`${label} : aucun « Sponsor » lu ni annoncé`, () => {
      expect(visibleText(html)).not.toMatch(/sponsor/i);
      expect(accessibleNames(html)).not.toMatch(/sponsor/i);
    });
  }

  it('ne pose plus aucun nom accessible sur les conteneurs', () => {
    for (const [, html] of cases) expect(html).not.toContain('aria-label');
  });
});

// Table complète, définie localement (pas d'import croisé entre fichiers de
// test) : porte tout ce que renderSponsorPage/renderLayout traversent, sinon
// le test échoue sur un `undefined` sans rapport avec ce qu'il vérifie.
const fullUi = {
  site: {
    brand: 'SaaS Made Free',
    skipToContent: 'Skip to content',
    languageSwitcherLabel: 'Language',
    directoryLabel: 'Directory',
    nav: { submitTool: 'Submit a tool', source: 'Source', github: 'GitHub', sponsor: 'Sponsor' },
    footer: { source: 'Source on GitHub', privacy: 'Privacy', credit: 'Catalogue based on canivibecodeit' },
    home: {
      figureToolsPublished: 'Tools published',
      figureCategories: 'Categories',
      figureLanguages: 'Languages',
      figureTotalPrice: 'Total monthly price of the catalogue (USD)',
    },
    // Sous-ensemble utilisé par renderSponsorPage pour la section « ce qu'on
    // mesure » : mêmes libellés que la page /stats (site.stats), jamais une
    // traduction parallèle — voir renderStatsPage.
    stats: {
      visitorDays: 'Visitor-days · 7d',
      views14d: 'Page views · last 14 days',
      promptsCopied: 'Prompts copied · 7d',
      crawlers: 'AI crawlers reading this site',
    },
    sponsor: {
      openLabel: 'Open slot', perDays: '/ 30 days', bookCta: 'Book it',
      takenLabel: 'Taken',
      railHeading: 'Side blocks',
      tapeTopHeading: 'Top scrolling band',
      tapeBottomHeading: 'Bottom scrolling band',
      ladderRailHeading: 'Side blocks',
      ladderTapeHeading: 'Scrolling places',
      ladderRankColumn: 'Slots taken',
      ladderPriceColumn: 'Next slot',
      titleTag: 'Sponsor SaaS Made Free',
      metaDescription: '{railCount} side slots and {tapeCount} scrolling places on a directory read by people about to cancel a subscription.',
      h1: 'Sponsor SaaS Made Free',
      lede: 'People land here to cancel something. What that means for a sponsor is for you to judge.',
      measuredHeading: 'What we measure',
      measuredIntro: 'This site runs its own analytics: a beacon on every page, logged by a Cloudflare Worker, nothing sold as a private dashboard. The figures below are read from that data, not typed by hand.',
      statsLinkCta: 'See the full figures on the public stats page',
      statsUnavailableNote: 'The analytics service did not answer when this page was built, so no figure is shown here. The same data is public, live, on the stats page.',
      catalogueFiguresNote: 'The catalogue itself, read from the same build:',
      inventoryHeading: 'The inventory',
      ladderHeading: 'The price ladder',
      ladderBody: 'The price rises as slots fill. Each step is the price of the next slot to be taken. A slot that expires frees up and the price steps back down.',
      lockHeading: 'Locking three months',
      lockBody: "Three months costs three times today's price. There is no discount — what you buy is the price, before it moves.",
      howHeading: 'How it works',
      howSteps: [
        'Pick an open slot and pay.',
        'Send a display name, a domain and one line of description.',
        'Manual approval within 48 hours. Refused means refunded in full.',
      ],
      noReportingNote: 'There is no impression or click reporting, because that would be analytics. Your link carries its own UTM parameters — measure it on your side.',
      transparencyHeading: 'What sponsoring does not buy',
      transparencyBody: 'A sponsor never buys a verdict. A sponsored tool listed in the catalogue keeps exactly the verdict its data earns it, including "keep paying".',
      contactCta: 'Ask about a slot',
    },
  },
};

// Forme exacte retournée par buildStatsPayload() côté worker (worker/src/stats.mjs) —
// seuls les champs que renderSponsorPage lit sont renseignés avec de vraies valeurs,
// le reste avec la forme vide pour ne pas mentir sur ce qui est testé.
const STATS_PAYLOAD = {
  generatedAt: '2026-08-10T00:00:00.000Z',
  today: { views: 12, visitors: 5 },
  peak: { day: '2026-08-09', views: 40 },
  views14d: [
    { day: '2026-08-03', views: 10 },
    { day: '2026-08-04', views: 8 },
    { day: '2026-08-05', views: 6 },
  ],
  visitors7d: 23,
  copies7d: { total: 17, byAgent: [], topPrompts: [] },
  aiReferrals: { d7: [], d30: [] },
  // Trois entrées, exprès : le nombre de bots distincts (3) ne doit coïncider
  // avec aucune des valeurs de `figures` utilisées par ces mêmes tests
  // (529, 51, 2, 11760.18) — sinon un test « aucune fuite de chiffre » se
  // vérifierait par accident plutôt que par construction.
  crawlers7d: [
    { bot: 'gptbot', label: 'GPTBot', vendor: 'OpenAI', edge: 3, cf: 1, lastSeen: '2026-08-09' },
    { bot: 'claudebot', label: 'ClaudeBot', vendor: 'Anthropic', edge: 2, cf: 0, lastSeen: '2026-08-08' },
    { bot: 'perplexitybot', label: 'PerplexityBot', vendor: 'Perplexity', edge: 1, cf: 0, lastSeen: '2026-08-07' },
  ],
  votes: { total: 40, top: [] },
};
// Somme attendue de views14d — calculée ici depuis le même tableau que le
// payload, jamais retapée, pour que le test ne prouve rien d'autre que ce que
// renderSponsorPage doit calculer lui-même.
const VIEWS_14D_TOTAL = STATS_PAYLOAD.views14d.reduce((sum, d) => sum + d.views, 0);

describe('page /sponsor', () => {
  // `liveSlots` n'entre plus par renderSponsorPage : il entre par
  // sponsorContext, qui fusionne data/sponsors.json et la charge utile en une
  // seule occupation — celle dont dérivent aussi les rails et les bandeaux.
  const pageCtx = ({ placements = [], favicons = {}, liveSlots = null } = {}) => sponsorContext({
    placements, today: '2026-08-10', lang: 'fr', ui: fullUi, favicons,
    sponsorHref: '/fr/sponsor', liveSlots,
  });

  const page = ({ stats = null, placements = [], favicons = {}, liveSlots = null } = {}) => renderSponsorPage({
    lang: 'fr', path: '/fr/sponsor', ui: fullUi, alternates: [], xDefaultPath: null,
    homePath: '/fr/', sponsors: pageCtx({ placements, favicons, liveSlots }), sponsorSlots: null,
    // Forme exacte retournée par catalogueFigures() dans site-data.mjs.
    figures: { toolsPublished: 529, categories: 51, languages: 2, totalMonthlyUsd: 11760.18, prompts: 529 },
    stats,
  });

  // Isole le <li> d'un slot donné dans le HTML rendu, pour vérifier son état
  // (pris/libre) et son prix sans dépendre de la position exacte dans la page.
  const itemFor = (html, slot) => {
    const m = html.match(new RegExp(`<li class="sp-inv-item[^>]*data-slot="${slot}"[^>]*>.*?</li>`, 's'));
    if (!m) throw new Error(`aucun <li> trouvé pour le slot ${slot}`);
    return m[0];
  };
  const hasClass = (li, cls) => li.includes(`class="sp-inv-item ${cls}"`);
  /** Le montant affiché dans la ligne d'inventaire d'un slot, ou null. */
  const invPrice = (html, slot) => {
    const m = itemFor(html, slot).match(/<span class="sp-inv-price">([^<]*)<\/span>/);
    return m ? m[1] : null;
  };

  // La page est rendue en `fr` : le barème publié doit correspondre marche
  // par marche à RAIL_LADDER_USD/TAPE_LADDER_USD, formaté par formatMoney.
  // Les montants attendus sont dérivés des tableaux exportés, jamais retapés
  // dans le test — sinon le test ne prouverait plus que ce qui est publié est
  // bien ce qui est vendu.
  it('publie les deux échelles de prix en clair, marche par marche', () => {
    const html = page();
    for (const [ladder, name] of [[RAIL_LADDER_USD, 'rail'], [TAPE_LADDER_USD, 'tape']]) {
      ladder.forEach((price, rank) => {
        expect(html, `${name}[${rank}]`).toContain(
          `<tr><td>${rank}</td><td>${usd(price, 'fr')}</td></tr>`
        );
      });
    }
  });

  it('n’écrit aucun montant avec un sigil monétaire posé à la main', () => {
    expect(page()).not.toMatch(/<td>\$\d/);
  });

  // Les cartes disent "/ 30 jours" ; le tableau n'annonçait qu'un montant nu.
  // La période vient de la chaîne i18n déjà utilisée par les cartes.
  it('dit dans quelle période s’entend le prix du barème', () => {
    expect(page()).toContain(
      `<th scope="col">${fullUi.site.sponsor.ladderPriceColumn} ${fullUi.site.sponsor.perDays}</th>`
    );
  });

  it('affiche les chiffres calculés du catalogue', () => {
    expect(page()).toContain('529');
  });

  // Le site a désormais de vraies analytics (beacon, page /stats, Worker) :
  // la page /sponsor doit le dire et montrer les chiffres du payload — jamais
  // "aucune analytics", qui serait faux depuis la page voisine /stats.
  describe('section « ce qu’on mesure »', () => {
    it('affiche les chiffres d’audience lus du payload, formatés comme le reste du site', () => {
      const html = page({ stats: STATS_PAYLOAD });
      expect(html).toContain(`<strong>${n(STATS_PAYLOAD.visitors7d, 'fr')}</strong> ${fullUi.site.stats.visitorDays}`);
      expect(html).toContain(`<strong>${n(VIEWS_14D_TOTAL, 'fr')}</strong> ${fullUi.site.stats.views14d}`);
      expect(html).toContain(`<strong>${n(STATS_PAYLOAD.copies7d.total, 'fr')}</strong> ${fullUi.site.stats.promptsCopied}`);
      expect(html).toContain(`<strong>${n(STATS_PAYLOAD.crawlers7d.length, 'fr')}</strong> ${fullUi.site.stats.crawlers}`);
    });

    it('n’affiche aucun chiffre d’audience et un message honnête quand le payload est indisponible', () => {
      const html = page({ stats: null });
      expect(html).toContain(fullUi.site.sponsor.statsUnavailableNote);
      // Aucune des valeurs du payload de test ne doit apparaître : ni en
      // "chiffre inventé", ni fuité d'un autre test par erreur d'état partagé.
      // Comparé sous la forme RENDUE (n(), le même Intl.NumberFormat que la
      // page) : comparer au nombre brut rendait l'assertion vide dès qu'une
      // valeur franchissait 1 000, puisque `fr` y insère une espace fine.
      for (const value of [STATS_PAYLOAD.visitors7d, VIEWS_14D_TOTAL, STATS_PAYLOAD.copies7d.total, STATS_PAYLOAD.crawlers7d.length]) {
        expect(html).not.toContain(`<strong>${n(value, 'fr')}</strong>`);
      }
      // Verrou plus général que les quatre valeurs ci-dessus (revue du
      // round 2) : une régression qui remplacerait la branche null par une
      // liste de zéros passerait le test précédent sans passer celui-ci —
      // aucun <strong> (la convention .sp-figures pour un chiffre) ne doit
      // apparaître dans le bloc audience lui-même, qui va de la fin de
      // l'intro au début du lien vers /stats.
      // L'ancrage est vérifié AVANT d'y ajouter la longueur de l'intro : un
      // `indexOf` manqué (-1) donnait un `start` positif, donc une assertion
      // « > -1 » qui ne pouvait pas échouer et un `slice` sur une zone
      // arbitraire de la page.
      const introAt = html.indexOf(fullUi.site.sponsor.measuredIntro);
      expect(introAt).toBeGreaterThan(-1);
      const start = introAt + fullUi.site.sponsor.measuredIntro.length;
      const end = html.indexOf(fullUi.site.sponsor.statsLinkCta);
      expect(end).toBeGreaterThan(start);
      expect(html.slice(start, end)).not.toContain('<strong>');
    });

    it('porte un lien vers la page /stats de la langue rendue, quel que soit l’état du payload', () => {
      expect(page({ stats: STATS_PAYLOAD })).toContain('href="/fr/stats/"');
      expect(page({ stats: null })).toContain('href="/fr/stats/"');
    });

    // Principe 3 de .impeccable.md : un nombre qui ne peut pas être calculé
    // n'est pas affiché. On isole le texte de la section et on vérifie que
    // chaque valeur affichée en <strong> (la convention du site pour un
    // chiffre — voir .sp-figures) est bien dérivée du payload. On ne scanne
    // pas tous les chiffres de la section : les libellés repris de
    // site.stats portent légitimement des indicateurs de fenêtre ("7d", "14
    // derniers jours") qui sont du texte traduit, pas des chiffres affichés.
    it('n’écrit aucun chiffre en dur dans la section — chaque valeur affichée vient du payload', () => {
      const html = page({ stats: STATS_PAYLOAD });
      const start = html.indexOf(fullUi.site.sponsor.measuredHeading);
      const end = html.indexOf(fullUi.site.sponsor.catalogueFiguresNote);
      expect(start).toBeGreaterThan(-1);
      expect(end).toBeGreaterThan(start);
      const section = html.slice(start, end);
      const allowed = new Set([
        STATS_PAYLOAD.visitors7d, VIEWS_14D_TOTAL, STATS_PAYLOAD.copies7d.total, STATS_PAYLOAD.crawlers7d.length,
      ].map(String));
      const values = [...section.matchAll(/<strong>([^<]+)<\/strong>/g)].map((m) => m[1]);
      expect(values).toHaveLength(4);
      for (const value of values) expect(allowed.has(value), `valeur inattendue : ${value}`).toBe(true);
    });
  });

  // Round de revue 2 : `stats` traverse une frontière HTTP (fetchStats ne
  // vérifie que « c'est un objet », comme fetchVoteCounts) — un payload
  // présent mais incomplet est donc un cas réel, même si le Worker actuel ne
  // le produit pas aujourd'hui. Chaque cas du tableau du reviewer, plus les
  // deux cas « tableau vide » qui doivent continuer à rendre un vrai 0.
  describe('section « ce qu’on mesure » — payload partiel', () => {
    function omit(key) {
      const copy = { ...STATS_PAYLOAD };
      delete copy[key];
      return copy;
    }

    it('visitors7d absent : ne plante pas, n’affiche pas ce chiffre, garde les trois autres', () => {
      const stats = omit('visitors7d');
      expect(() => page({ stats })).not.toThrow();
      const html = page({ stats });
      expect(html).not.toContain('NaN');
      expect(html).not.toContain(fullUi.site.stats.visitorDays);
      expect(html).toContain(`<strong>${n(VIEWS_14D_TOTAL, 'fr')}</strong> ${fullUi.site.stats.views14d}`);
      expect(html).toContain(`<strong>${n(STATS_PAYLOAD.copies7d.total, 'fr')}</strong> ${fullUi.site.stats.promptsCopied}`);
      expect(html).toContain(`<strong>${n(STATS_PAYLOAD.crawlers7d.length, 'fr')}</strong> ${fullUi.site.stats.crawlers}`);
    });

    it('views14d absent : ne plante pas (pas de TypeError sur reduce), n’affiche pas ce chiffre, garde les trois autres', () => {
      const stats = omit('views14d');
      expect(() => page({ stats })).not.toThrow();
      const html = page({ stats });
      expect(html).not.toContain('NaN');
      expect(html).not.toContain(fullUi.site.stats.views14d);
      expect(html).toContain(`<strong>${n(STATS_PAYLOAD.visitors7d, 'fr')}</strong> ${fullUi.site.stats.visitorDays}`);
      expect(html).toContain(`<strong>${n(STATS_PAYLOAD.copies7d.total, 'fr')}</strong> ${fullUi.site.stats.promptsCopied}`);
      expect(html).toContain(`<strong>${n(STATS_PAYLOAD.crawlers7d.length, 'fr')}</strong> ${fullUi.site.stats.crawlers}`);
    });

    it('copies7d.total absent : n’affiche pas de NaN, n’affiche pas ce chiffre, garde les trois autres', () => {
      const stats = { ...STATS_PAYLOAD, copies7d: { byAgent: [], topPrompts: [] } };
      expect(() => page({ stats })).not.toThrow();
      const html = page({ stats });
      expect(html).not.toContain('NaN');
      expect(html).not.toContain(fullUi.site.stats.promptsCopied);
      expect(html).toContain(`<strong>${n(STATS_PAYLOAD.visitors7d, 'fr')}</strong> ${fullUi.site.stats.visitorDays}`);
      expect(html).toContain(`<strong>${n(VIEWS_14D_TOTAL, 'fr')}</strong> ${fullUi.site.stats.views14d}`);
      expect(html).toContain(`<strong>${n(STATS_PAYLOAD.crawlers7d.length, 'fr')}</strong> ${fullUi.site.stats.crawlers}`);
    });

    it('crawlers7d absent : ne plante pas (pas de TypeError sur length), n’affiche pas ce chiffre, garde les trois autres', () => {
      const stats = omit('crawlers7d');
      expect(() => page({ stats })).not.toThrow();
      const html = page({ stats });
      expect(html).not.toContain('NaN');
      expect(html).not.toContain(fullUi.site.stats.crawlers);
      expect(html).toContain(`<strong>${n(STATS_PAYLOAD.visitors7d, 'fr')}</strong> ${fullUi.site.stats.visitorDays}`);
      expect(html).toContain(`<strong>${n(VIEWS_14D_TOTAL, 'fr')}</strong> ${fullUi.site.stats.views14d}`);
      expect(html).toContain(`<strong>${n(STATS_PAYLOAD.copies7d.total, 'fr')}</strong> ${fullUi.site.stats.promptsCopied}`);
    });

    // « Absent » ≠ « vide » : un tableau vide est une vraie mesure (0 vue, 0
    // crawler distinct) et doit s'afficher comme tel — seul le champ absent
    // fait disparaître son chiffre.
    it('views14d et crawlers7d vides ([]) : affichent bien 0, un vrai chiffre', () => {
      const stats = { ...STATS_PAYLOAD, views14d: [], crawlers7d: [] };
      const html = page({ stats });
      expect(html).toContain(`<strong>${n(0, 'fr')}</strong> ${fullUi.site.stats.views14d}`);
      expect(html).toContain(`<strong>${n(0, 'fr')}</strong> ${fullUi.site.stats.crawlers}`);
    });

    it('retombe sur le même message que le payload null quand plus aucun chiffre n’est calculable', () => {
      const html = page({ stats: {} });
      expect(html).not.toContain('NaN');
      expect(html).toContain(fullUi.site.sponsor.statsUnavailableNote);
      expect(html).toContain('href="/fr/stats/"');
    });
  });

  it('porte la clause de non-influence sur les verdicts', () => {
    expect(page().toLowerCase()).toContain('verdict');
  });

  it('n’a qu’un seul h1', () => {
    expect(page().split('<h1').length - 1).toBe(1);
  });

  // Verrou du round de revue : la meta description annonce la taille de
  // l'inventaire, calculée depuis RAIL_SLOTS/TAPE_TOP_SLOTS/TAPE_BOTTOM_SLOTS
  // — jamais depuis un "8"/"20" écrit en dur dans ui.json, qui mentirait en
  // silence le jour où l'inventaire change de forme.
  it('interpole le nombre de blocs et de places dans la meta description, jamais en dur', () => {
    expect(page()).toContain(
      '<meta name="description" content="8 side slots and 20 scrolling places on a directory read by people about to cancel a subscription.">'
    );
  });

  // Tâche 6 : le paiement est encaissé côté Worker avant que la créa ne soit
  // commitée dans data/sponsors.json — pendant cette fenêtre, l'inventaire ne
  // doit pas afficher un slot payé comme libre. La charge utile lue au build
  // (fetchSponsorSlots, voir site-data.mjs) est donc la source de vérité
  // quand elle répond ; data/sponsors.json ne sert que de repli.
  describe('inventaire — disponibilité en direct', () => {
    it('marque un slot pris quand la charge utile dit "paid", même si data/sponsors.json ne le connaît pas encore', () => {
      const html = page({
        placements: [], // data/sponsors.json : L1 encore inconnu (créa pas commitée)
        liveSlots: { L1: { status: 'paid', endsOn: '2026-09-10' } },
      });
      const li = itemFor(html, 'L1');
      expect(hasClass(li, 'taken')).toBe(true);
      expect(li).toContain(fullUi.site.sponsor.takenLabel);
      // Un slot pris ne porte aucun emplacement de prix, même vide — rien à
      // annoncer pour un emplacement déjà vendu.
      expect(li).not.toContain('sp-inv-price');
    });

    // Round de revue : la promotion vers « pris » est UNIDIRECTIONNELLE. La
    // charge utile peut déclarer pris un slot que data/sponsors.json ignore
    // encore (test ci-dessus), mais l'inverse est interdit — elle ne doit
    // jamais pouvoir rouvrir un slot que data/sponsors.json sait occupé. Sans
    // cette garde, un sponsor commité à la main (donc toujours `open` côté
    // D1, puisque Stripe n'y touche jamais) se retrouverait remis en vente à
    // 219 $ dans le tableau alors que sa carte s'affiche déjà sur le rail —
    // la page se contredit elle-même.
    it('un slot que data/sponsors.json sait occupé reste "pris" même si la charge utile le dit "open"', () => {
      const html = page({
        placements: [LIVE], // L1 occupé côté data/sponsors.json (carte affichée sur le rail)
        liveSlots: { L1: { status: 'open', priceCents: 21900, currency: 'USD' } },
      });
      const li = itemFor(html, 'L1');
      expect(hasClass(li, 'taken')).toBe(true);
      expect(li).toContain(fullUi.site.sponsor.takenLabel);
      expect(li).not.toContain('sp-inv-price');
    });

    // Le prix ne vient plus de la charge utile mais du barème publié sur cette
    // page même, indexé par le nombre de slots vendus : un lecteur peut le
    // vérifier en comptant les lignes « pris ». Lire `priceCents` serait une
    // seconde source d'occupation — celle qui faisait annoncer 149 $US ici et
    // 219 $US sur la carte du même emplacement.
    it('tarife un slot libre au barème indexé par l’occupation, jamais au priceCents de la charge utile', () => {
      const html = page({ liveSlots: { L1: { status: 'open', priceCents: 21900, currency: 'USD' } } });
      expect(hasClass(itemFor(html, 'L1'), 'open')).toBe(true);
      expect(invPrice(html, 'L1')).toBe(usd(RAIL_LADDER_USD[0], 'fr'));
      expect(invPrice(html, 'L1')).not.toBe(usd(219, 'fr'));
    });

    // I2 : le repli affichait un <span class="sp-inv-price"></span> vide pour
    // les 28 lignes — et c'est ce qui était publié, la route Worker n'étant
    // pas déployée. Le prix EST calculable sans la charge utile (barème +
    // occupation locale), donc le principe 3 impose de l'afficher.
    it('affiche quand même le prix quand la charge utile est absente — il reste calculable', () => {
      const html = page({ placements: [LIVE], liveSlots: null });
      expect(hasClass(itemFor(html, 'L1'), 'taken')).toBe(true); // LIVE occupe L1
      const start = html.indexOf(fullUi.site.sponsor.inventoryHeading);
      const end = html.indexOf(fullUi.site.sponsor.ladderHeading);
      const prices = [...html.slice(start, end).matchAll(/<span class="sp-inv-price">([^<]*)<\/span>/g)];
      expect(prices.length).toBe(RAIL_SLOTS.length - 1 + TAPE_TOP_SLOTS.length + TAPE_BOTTOM_SLOTS.length);
      for (const [, content] of prices) expect(content).not.toBe('');
      // L1 pris → le rail suivant est à la deuxième marche ; les bandeaux,
      // eux, sont intacts et restent à la première.
      expect(invPrice(html, 'L2')).toBe(usd(RAIL_LADDER_USD[1], 'fr'));
      expect(invPrice(html, 'T01')).toBe(usd(TAPE_LADDER_USD[0], 'fr'));
    });

    it('publie le barème du compartiment pour que le rafraîchissement client applique la même règle', () => {
      const html = page();
      expect(html).toContain(`data-sponsor-ladder="${RAIL_LADDER_USD.join(',')}"`);
      expect(html).toContain(`data-sponsor-ladder="${TAPE_LADDER_USD.join(',')}"`);
    });

    // L'axe « vendu » du contexte fusionné, rendu lisible au client : une
    // réservation prend le slot sans compter dans le barème.
    it('marque « vendu » un slot payé, jamais un slot seulement réservé', () => {
      const html = page({ liveSlots: { L1: { status: 'paid' }, L2: { status: 'reserved' } } });
      expect(itemFor(html, 'L1')).toContain('data-sold="1"');
      expect(itemFor(html, 'L2')).not.toContain('data-sold');
      // Un seul slot vendu → le prochain rail libre est à la deuxième marche.
      expect(invPrice(html, 'L3')).toBe(usd(RAIL_LADDER_USD[1], 'fr'));
    });

    it('porte un attribut de données pointant vers l’API, pour que site.js rafraîchisse le bloc', () => {
      expect(page()).toContain(`data-sponsor-slots-endpoint="${SPONSOR_SLOTS_API_URL}"`);
    });
  });

  // Le cœur de la correction : les deux chemins de prix. Reproduit le cas du
  // reviewer — un placement actif sur L1 dans data/sponsors.json, une charge
  // utile qui déclare les rails `open`. Avant : la carte de rail de L2
  // annonçait 219 $US pendant que la ligne d'inventaire de L2 annonçait
  // 149 $US, sur la même page.
  describe('un seul prix, un seul statut, pour le même emplacement', () => {
    const RAILS_OPEN = Object.fromEntries(
      RAIL_SLOTS.map((slot) => [slot, { status: 'open', priceCents: 14900, currency: 'USD' }])
    );

    it('la carte de rail et la ligne d’inventaire annoncent le même prix', () => {
      const options = { placements: [LIVE], liveSlots: RAILS_OPEN };
      const html = page(options);
      const rail = renderRail('left', pageCtx(options));
      const expected = usd(RAIL_LADDER_USD[1], 'fr'); // L1 pris → deuxième marche
      expect(rail).toContain(`<span class="sp-price">${expected}</span>`);
      expect(invPrice(html, 'L2')).toBe(expected);
    });

    it('un slot réservé est « pris » des deux côtés, jamais « libre » d’un seul', () => {
      const options = { liveSlots: { L2: { status: 'reserved' } } };
      const html = page(options);
      const rail = renderRail('left', pageCtx(options));
      expect(hasClass(itemFor(html, 'L2'), 'taken')).toBe(true);
      const card = rail.match(/<(?:a|div)[^>]*data-slot="L2"[^>]*>.*?<\/(?:a|div)>/s)[0];
      expect(card).toContain(fullUi.site.sponsor.takenLabel);
      expect(card).not.toContain(fullUi.site.sponsor.bookCta);
    });

    it('les places défilantes suivent le même barème que leur ligne d’inventaire', () => {
      const options = { liveSlots: { T01: { status: 'paid' } } };
      const html = page(options);
      const tape = renderTape('top', pageCtx(options));
      const expected = usd(TAPE_LADDER_USD[1], 'fr');
      expect(tape).toContain(expected);
      expect(invPrice(html, 'T02')).toBe(expected);
    });
  });

  // Round de revue (voir audienceFigures) : `liveSlots` traverse une
  // frontière HTTP, un payload présent mais partiel ou mal formé est donc un
  // cas réel. Chaque champ absent ou du mauvais type ne doit dégrader que sa
  // propre valeur — jamais planter le build, jamais afficher NaN, jamais
  // inventer un prix.
  describe('inventaire — charge utile partielle ou malformée', () => {
    it('un slot absent de la charge utile retombe sur data/sponsors.json pour ce seul slot', () => {
      const html = page({
        placements: [LIVE], // LIVE occupe L1 côté data/sponsors.json
        liveSlots: { R1: { status: 'paid', endsOn: '2026-09-01' } }, // L1 absent de la charge utile
      });
      expect(hasClass(itemFor(html, 'L1'), 'taken')).toBe(true); // repli sur data/sponsors.json
      expect(hasClass(itemFor(html, 'R1'), 'taken')).toBe(true); // vient de la charge utile
    });

    it('un statut inconnu dans la charge utile ne plante pas et retombe sur data/sponsors.json', () => {
      expect(() => page({ liveSlots: { L1: { status: 'weird' } } })).not.toThrow();
      const html = page({ liveSlots: { L1: { status: 'weird' } } });
      expect(hasClass(itemFor(html, 'L1'), 'open')).toBe(true); // aucun placement : L1 libre localement
      // Le prix reste calculable : il ne dépendait pas de la charge utile.
      expect(invPrice(html, 'L1')).toBe(usd(RAIL_LADDER_USD[0], 'fr'));
    });

    // Le prix n'est plus lu de la charge utile : un `priceCents` du mauvais
    // type ou une devise inattendue ne peuvent donc plus ni effacer le prix,
    // ni l'étiqueter de travers, ni écrire NaN.
    it('un priceCents ou une devise absurdes ne changent rien au prix affiché', () => {
      for (const entry of [
        { status: 'open', priceCents: '219', currency: 'USD' },
        { status: 'open', priceCents: 21900, currency: 'EUR' },
        { status: 'open', priceCents: Number.NaN },
        { status: 'open' },
      ]) {
        const html = page({ liveSlots: { L1: entry } });
        expect(html, JSON.stringify(entry)).not.toContain('NaN');
        expect(invPrice(html, 'L1'), JSON.stringify(entry)).toBe(usd(RAIL_LADDER_USD[0], 'fr'));
      }
    });

    it('une entrée qui n’est pas un objet retombe sur data/sponsors.json sans planter', () => {
      expect(() => page({ liveSlots: { L1: 'paid' } })).not.toThrow();
      const html = page({ liveSlots: { L1: 'paid' } });
      expect(hasClass(itemFor(html, 'L1'), 'open')).toBe(true);
    });

    it('une charge utile qui n’est pas un objet exploitable (tableau) retombe entièrement sur data/sponsors.json', () => {
      expect(() => page({ liveSlots: ['not', 'an', 'object'] })).not.toThrow();
      const html = page({ placements: [LIVE], liveSlots: ['not', 'an', 'object'] });
      expect(hasClass(itemFor(html, 'L1'), 'taken')).toBe(true);
    });

    // Inventaire plein : plus aucun slot libre, donc plus aucun prix à
    // afficher — jamais un "$0.00" de repli (nextPriceUsd rend null, et
    // aucune ligne ne l'observe puisqu'elles sont toutes prises).
    it('un compartiment plein n’affiche aucun prix, et surtout aucun zéro', () => {
      const liveSlots = Object.fromEntries(RAIL_SLOTS.map((slot) => [slot, { status: 'paid' }]));
      const html = page({ liveSlots });
      for (const slot of RAIL_SLOTS) {
        expect(hasClass(itemFor(html, slot), 'taken'), slot).toBe(true);
        expect(invPrice(html, slot), slot).toBe(null);
      }
      // Pas même un emplacement de prix vide dans ce compartiment : aucun
      // "0 $US" ne peut s'y glisser. (Le premier <ul class="sp-inv"> de la
      // page est celui des rails — voir renderSponsorPage.)
      const railList = html.match(/<ul class="sp-inv"[^>]*>.*?<\/ul>/s)[0];
      expect(railList).not.toContain('sp-inv-price');
    });
  });

});
