import { describe, it, expect } from 'vitest';
import {
  RAIL_SLOTS, TAPE_TOP_SLOTS, TAPE_BOTTOM_SLOTS,
  RAIL_LADDER_USD, TAPE_LADDER_USD,
  selectSponsors, nextPriceUsd,
} from '../scripts/lib/site-sponsors.mjs';
import { sponsorContext, renderRail, renderTape, renderRailFallback } from '../scripts/lib/site-sponsors.mjs';

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
      label: 'Sponsor', heading: 'Sponsors', openLabel: 'Slot libre',
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

  it('marque le lien comme sponsorisé et sûr', () => {
    expect(html()).toContain('rel="sponsored noopener"');
    expect(html()).toContain('target="_blank"');
  });

  it('porte les UTM du slot', () => {
    expect(html()).toContain('utm_source=saasmadefree');
    expect(html()).toContain('utm_campaign=sponsor_L1');
  });

  it('affiche la mention Sponsor en clair, pas seulement dans rel', () => {
    expect(html()).toContain('>Sponsor<');
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
