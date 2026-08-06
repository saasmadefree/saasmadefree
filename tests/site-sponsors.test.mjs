import { describe, it, expect } from 'vitest';
import {
  RAIL_SLOTS, TAPE_TOP_SLOTS, TAPE_BOTTOM_SLOTS,
  RAIL_LADDER_USD, TAPE_LADDER_USD,
  selectSponsors, nextPriceUsd,
} from '../scripts/lib/site-sponsors.mjs';
import {
  sponsorContext, renderRail, renderTape, renderRailFallback, renderSponsorSlots,
} from '../scripts/lib/site-sponsors.mjs';
import { renderSponsorPage } from '../scripts/lib/site-page-sponsor.mjs';
import { PLACEHOLDER_PATH } from '../scripts/lib/site-favicons.mjs';
import { escapeHtml } from '../scripts/lib/site-html.mjs';
import { formatMoney } from '../scripts/lib/site-format.mjs';

/** Le prix tel qu'il doit apparaître dans le HTML rendu : même formateur que
 *  le reste du site, jamais une chaîne retapée à la main dans le test. */
const usd = (amount, lang) => escapeHtml(formatMoney(amount, 'USD', lang));

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

  it("rend null pour un occupiedCount négatif", () => {
    expect(nextPriceUsd('rail', -1)).toBe(null);
    expect(nextPriceUsd('tape', -5)).toBe(null);
  });
});

const ui = {
  site: {
    sponsor: {
      openLabel: 'Slot libre',
      perDays: '/ 30 jours', bookCta: 'Réserver',
    },
  },
};

const ctx = (placements, favicons = {}) => sponsorContext({
  placements, today: '2026-08-10', lang: 'fr', ui, favicons, sponsorHref: '/fr/sponsor',
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
  const slots = renderSponsorSlots(busy);

  const cases = [
    ['rail gauche libre', renderRail('left', free)],
    ['rail droit libre', renderRail('right', free)],
    ['rail gauche occupé', renderRail('left', busy)],
    ['repli libre', renderRailFallback(free)],
    ['repli occupé', renderRailFallback(busy)],
    ['bandeau haut libre', renderTape('top', free)],
    ['bandeau haut occupé', renderTape('top', busy)],
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
      noAnalyticsHeading: 'What we cannot tell you',
      noAnalyticsBody: 'This site runs no analytics — no tracking pixel, no third-party script, nothing. So we have no traffic number to sell you, and we are not going to invent one. Everything below is computed from the catalogue itself, at build time.',
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

describe('page /sponsor', () => {
  const page = () => renderSponsorPage({
    lang: 'fr', path: '/fr/sponsor', ui: fullUi, alternates: [], xDefaultPath: null,
    homePath: '/fr/', sponsors: ctx([]), sponsorSlots: null,
    // Forme exacte retournée par catalogueFigures() dans site-data.mjs.
    figures: { toolsPublished: 529, categories: 51, languages: 2, totalMonthlyUsd: 11760.18, prompts: 529 },
  });

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

  it('dit explicitement qu’il n’y a aucun chiffre de trafic', () => {
    expect(page()).toContain('analytics');
  });

  it('affiche les chiffres calculés du catalogue', () => {
    expect(page()).toContain('529');
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

});
