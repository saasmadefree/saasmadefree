import { describe, it, expect } from 'vitest';
import {
  RAIL_SLOTS, TAPE_TOP_SLOTS, TAPE_BOTTOM_SLOTS,
  RAIL_LADDER_USD, TAPE_LADDER_USD,
  selectSponsors, nextPriceUsd,
} from '../scripts/lib/site-sponsors.mjs';
import { sponsorContext, renderRail, renderTape, renderRailFallback } from '../scripts/lib/site-sponsors.mjs';
import { renderSponsorPage } from '../scripts/lib/site-page-sponsor.mjs';

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
      heading: 'Sponsors', openLabel: 'Slot libre',
      perDays: '/ 30 jours', bookCta: 'Réserver', fullLabel: 'Complet',
      railAriaLabel: 'Sponsors', tapeAriaLabel: 'Sponsors, défilant',
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

  it('affiche la tagline de la langue rendue', () => {
    expect(html()).toContain('Programme tes posts');
    expect(html()).not.toContain('Schedule');
  });
});

describe('carte de rail libre', () => {
  it('affiche le prix du jour et pointe vers /sponsor', () => {
    const html = renderRail('left', ctx([]));
    expect(html).toContain('149');
    expect(html).toContain('href="/fr/sponsor"');
  });

  it('monte d’une marche quand un rail est déjà pris', () => {
    // L1 occupé → le prochain rail libre coûte la 2e marche.
    expect(renderRail('left', ctx([LIVE]))).toContain('219');
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
      heading: 'Sponsors', openLabel: 'Open slot', perDays: '/ 30 days', bookCta: 'Book it',
      fullLabel: 'Sold out', railAriaLabel: 'Sponsors', tapeAriaLabel: 'Sponsors, scrolling',
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

  it('publie les deux échelles de prix en clair', () => {
    const html = page();
    expect(html).toContain('149');
    expect(html).toContain('1800');
    expect(html).toContain('900');
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
