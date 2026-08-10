import { describe, it, expect, beforeEach } from 'vitest';
import { Window } from 'happy-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderSponsorPage } from '../scripts/lib/site-page-sponsor.mjs';
import {
  sponsorContext, renderSponsorSlots, RAIL_LADDER_USD, TAPE_LADDER_USD,
} from '../scripts/lib/site-sponsors.mjs';
import { formatMoney } from '../scripts/lib/site-format.mjs';

// scripts/assets/site.js exécuté pour de vrai, dans un DOM, contre le HTML que
// le build produit vraiment.
//
// Ce fichier existe parce que la revue a refusé la justification « zéro
// dépendance » : la règle vise le code LIVRÉ (le site n'embarque toujours
// aucune dépendance), pas le banc d'essai — package.json portait déjà ajv et
// vitest en devDependencies. happy-dom est donc une devDependency de plus.
//
// Les gardes statiques de tests/sponsor-checkout-page.test.mjs restent utiles,
// mais aucune n'attrape un `res.ok` inversé, un `btn.disabled` supprimé, une
// relance automatique au nouveau prix, ou un `location.href` posé sur une
// réponse en échec. Ceux-ci, oui.
//
// site.js est une IIFE non modulaire : on ne peut pas l'importer. On l'évalue
// en lui passant ses globales en paramètres — ce qui donne au passage un
// `location` sous contrôle, donc une navigation observable au lieu d'une
// navigation subie.

const SITE_JS = readFileSync(join('scripts', 'assets', 'site.js'), 'utf8');
const UI = Object.fromEntries(
  ['en', 'fr'].map((lang) => [lang, JSON.parse(readFileSync(join('data', 'i18n', lang, 'ui.json'), 'utf8'))])
);
const FIGURES = { toolsPublished: 529, categories: 51, languages: 2, totalMonthlyUsd: 11760.18, prompts: 529 };

function renderPage(lang, { placements = [], liveSlots = null } = {}) {
  const ui = UI[lang];
  const sponsors = sponsorContext({
    placements, today: '2026-08-10', lang, ui, favicons: {},
    sponsorHref: `/${lang}/sponsor`, liveSlots,
  });
  return renderSponsorPage({
    lang, path: `/${lang}/sponsor`, ui, alternates: [], xDefaultPath: null,
    homePath: `/${lang}/`, sponsors, sponsorSlots: renderSponsorSlots(sponsors),
    figures: FIGURES, stats: null,
  });
}

/** Réponse minimale : site.js ne lit que `ok` et `json()`. */
function reply(status, body, { raw = false } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => (raw ? Promise.reject(new SyntaxError('corps illisible')) : Promise.resolve(body)),
  };
}

function mount({ lang = 'fr', search = '', placements = [], liveSlots = null, slots = {}, holds = null } = {}) {
  const win = new Window({
    url: `https://saasmadefree.com/${lang}/sponsor${search}`,
    settings: {
      disableJavaScriptEvaluation: true,
      disableJavaScriptFileLoading: true,
      disableCSSFileLoading: true,
    },
  });
  const doc = win.document;
  doc.write(renderPage(lang, { placements, liveSlots }));
  doc.close();

  if (holds) win.sessionStorage.setItem('smf:sponsor-holds', JSON.stringify(holds));

  const calls = [];
  const state = { next: reply(200, { url: 'https://checkout.stripe.com/c/pay/test' }) };
  const location = { search, href: `https://saasmadefree.com/${lang}/sponsor${search}`, pathname: `/${lang}/sponsor` };

  const fetchStub = (input, init) => {
    const url = String(input);
    calls.push({ url, body: init && init.body ? JSON.parse(init.body) : null, init });
    if (url.indexOf('/sponsors/checkout') !== -1) {
      return state.next instanceof Error ? Promise.reject(state.next) : Promise.resolve(state.next);
    }
    if (url.indexOf('/sponsors/slots') !== -1) return Promise.resolve(reply(200, slots));
    return Promise.resolve(reply(200, {}));
  };

  // `new Function` avec, pour corps, le fichier du dépôt qu'on teste — lu du
  // disque, jamais construit par concaténation et jamais issu d'une entrée.
  // C'est la seule façon d'exécuter une IIFE non modulaire en lui imposant ses
  // globales, et c'est ce qui rend `location` observable : une vraie
  // navigation ne se vérifie pas, une affectation sur un objet à nous, si.
  const run = new Function(
    'window', 'document', 'location', 'fetch', 'navigator', 'localStorage',
    'sessionStorage', 'setTimeout', 'URLSearchParams', 'Intl', 'URL', 'console', SITE_JS
  );
  run(win, doc, location, fetchStub, win.navigator, win.localStorage, win.sessionStorage,
    setTimeout, URLSearchParams, Intl, URL, console);

  const section = doc.querySelector('[data-sponsor-slots-endpoint]');
  const item = (slot) => section.querySelector(`.sp-inv-item[data-slot="${slot}"]`);
  const button = (slot) => item(slot).querySelector('.sp-inv-buy');
  const group = (slot) => item(slot).closest('.sp-inv-group');

  return {
    win, doc, location, calls, state, section, item, button, group,
    status: (slot) => group(slot).querySelector('.sp-inv-status').textContent,
    checkoutCalls: () => calls.filter((c) => c.url.indexOf('/sponsors/checkout') !== -1),
    click: (slot) => button(slot).click(),
    pickMonths: (m) => {
      const radio = doc.getElementById(`sp-months-${m}`);
      radio.checked = true;
      radio.dispatchEvent(new win.Event('change', { bubbles: true }));
    },
    flush: async () => {
      for (let i = 0; i < 6; i += 1) await new Promise((r) => setTimeout(r, 0));
    },
  };
}

/** Le message attendu, lu de la table de traduction — jamais retapé ici. */
function expected(lang, key, vars = {}) {
  let text = UI[lang].site.sponsor[key];
  for (const [name, value] of Object.entries(vars)) {
    text = text.split(`{${name}}`).join(value);
  }
  return text;
}

const usd = (amount, lang) => formatMoney(amount, 'USD', lang);

describe('site.js — la requête de checkout', () => {
  it('envoie les quatre champs de la route, et rien d’autre', async () => {
    const page = mount();
    page.click('L1');
    await page.flush();
    const call = page.checkoutCalls()[0];
    expect(call.url).toBe('https://votes.saasmadefree.com/api/v1/sponsors/checkout');
    expect(call.init.method).toBe('POST');
    expect(Object.keys(call.body).sort()).toEqual(['expectedPriceCents', 'lang', 'months', 'slot']);
    expect(call.body).toEqual({
      slot: 'L1', months: 1, expectedPriceCents: RAIL_LADDER_USD[0] * 100, lang: 'fr',
    });
  });

  it('n’émet aucune requête ailleurs que vers le Worker du projet (principe 4)', async () => {
    const page = mount();
    page.click('L1');
    await page.flush();
    expect(page.calls.length).toBeGreaterThan(0);
    for (const call of page.calls) {
      expect(new URL(call.url).hostname, call.url).toBe('votes.saasmadefree.com');
    }
  });

  it('envoie la langue de la page, pas une constante — sinon l’acheteur revient sur la mauvaise', async () => {
    const en = mount({ lang: 'en' });
    en.click('L1');
    await en.flush();
    expect(en.checkoutCalls()[0].body.lang).toBe('en');
  });

  it('triple le montant attendu quand trois mois sont choisis', async () => {
    const page = mount();
    page.pickMonths(3);
    page.click('T01');
    await page.flush();
    expect(page.checkoutCalls()[0].body).toMatchObject({
      months: 3, expectedPriceCents: TAPE_LADDER_USD[0] * 100 * 3,
    });
  });
});

describe('site.js — chaque échec de la route est dit à l’acheteur', () => {
  const cases = [
    ['slot_taken', 409, 'buyErrorSlotTaken'],
    ['rate_limited', 429, 'buyErrorRateLimited'],
    ['too_many_reservations', 429, 'buyErrorTooManyReservations'],
    ['inventory_full', 409, 'buyErrorInventoryFull'],
    ['misconfigured', 500, 'buyErrorUnavailable'],
    ['forbidden_origin', 403, 'buyErrorUnavailable'],
    ['stripe_unavailable', 502, 'buyErrorStripe'],
    ['unknown_slot', 400, 'buyError'],
    ['unsold_duration', 400, 'buyError'],
    ['invalid_json', 400, 'buyError'],
    ['method_not_allowed', 405, 'buyError'],
    ['internal_error', 500, 'buyError'],
  ];

  for (const [code, status, key] of cases) {
    it(`${code} → message dédié, bouton réactivé, page inchangée`, async () => {
      const page = mount();
      page.state.next = reply(status, { error: code });
      page.click('L2');
      await page.flush();
      expect(page.status('L2')).toBe(expected('fr', key, { slot: 'L2' }));
      // `slot_taken` retire le bouton avec le prix : il n'y a plus rien à
      // réactiver. Tous les autres échecs laissent l'emplacement vendable.
      if (code !== 'slot_taken') expect(page.button('L2').disabled).toBe(false);
      expect(page.location.href).toContain('/fr/sponsor');
    });
  }

  it('un code que la page ne connaît pas encore retombe sur le message de repli', async () => {
    const page = mount();
    page.state.next = reply(418, { error: 'a_brand_new_code' });
    page.click('L2');
    await page.flush();
    expect(page.status('L2')).toBe(expected('fr', 'buyError', { slot: 'L2' }));
  });

  it('un corps illisible ne passe pas pour un succès', async () => {
    const page = mount();
    page.state.next = reply(500, null, { raw: true });
    page.click('L2');
    await page.flush();
    expect(page.status('L2')).toBe(expected('fr', 'buyError', { slot: 'L2' }));
    expect(page.location.href).toContain('/fr/sponsor');
  });

  it('une coupure réseau ne laisse jamais l’acheteur sans réponse', async () => {
    const page = mount();
    page.state.next = new TypeError('Failed to fetch');
    page.click('L2');
    await page.flush();
    expect(page.status('L2')).toBe(expected('fr', 'buyError', { slot: 'L2' }));
    expect(page.button('L2').disabled).toBe(false);
  });

  it('un 200 sans URL ne navigue nulle part et le dit', async () => {
    const page = mount();
    page.state.next = reply(200, { received: true });
    page.click('L2');
    await page.flush();
    expect(page.location.href).toContain('/fr/sponsor');
    expect(page.status('L2')).toBe(expected('fr', 'buyError', { slot: 'L2' }));
  });

  it('slot_taken retire l’emplacement de la vente PARTOUT, pas seulement dans sa ligne', async () => {
    const page = mount();
    page.state.next = reply(409, { error: 'slot_taken' });
    page.click('L3');
    await page.flush();

    const row = page.item('L3');
    expect(row.className).toContain('taken');
    expect(row.querySelector('.sp-inv-buy')).toBe(null);
    expect(row.querySelector('.sp-inv-price')).toBe(null);

    const card = page.doc.querySelector('.sp-card[data-slot="L3"]');
    expect(card.className).toContain('taken');
    expect(card.getAttribute('href')).toBe(null);
    expect(card.textContent).toBe(UI.fr.site.sponsor.takenLabel);
  });

  it('rend le focus au bouton après un échec — le désactiver le lui avait pris', async () => {
    const page = mount();
    page.button('L2').focus();
    page.state.next = reply(502, { error: 'stripe_unavailable' });
    page.click('L2');
    await page.flush();
    expect(page.doc.activeElement).toBe(page.button('L2'));
  });
});

describe('site.js — dérive de prix', () => {
  it('montre le nouveau montant, la durée, et réaligne tout le compartiment', async () => {
    const page = mount();
    page.state.next = reply(409, { error: 'price_changed', priceCents: RAIL_LADDER_USD[1] * 100, currency: 'USD' });
    page.click('L2');
    await page.flush();

    const price = usd(RAIL_LADDER_USD[1], 'fr');
    expect(page.status('L2')).toBe(
      expected('fr', 'buyErrorPriceChanged', { slot: 'L2', price, duration: UI.fr.site.sponsor.buyDurationOne })
    );
    expect(page.item('L2').querySelector('.sp-inv-price').textContent).toBe(price);
    expect(page.item('R1').querySelector('.sp-inv-price').textContent).toBe(price);
    expect(page.doc.querySelector('.sp-card[data-slot="R1"] .sp-price').textContent).toBe(price);
    // Le bandeau suit son propre barème : il ne doit PAS bouger.
    expect(page.doc.querySelector('.sp-tape-item[data-slot="T01"] .sp-tape-price').textContent)
      .toBe(usd(TAPE_LADDER_USD[0], 'fr'));
  });

  it('ne relance JAMAIS toute seule au nouveau prix', async () => {
    const page = mount();
    page.state.next = reply(409, { error: 'price_changed', priceCents: RAIL_LADDER_USD[1] * 100 });
    page.click('L2');
    await page.flush();
    expect(page.checkoutCalls()).toHaveLength(1);
  });

  it('le second clic — celui de l’acheteur — part au nouveau montant', async () => {
    const page = mount();
    page.state.next = reply(409, { error: 'price_changed', priceCents: RAIL_LADDER_USD[1] * 100 });
    page.click('L2');
    await page.flush();
    page.state.next = reply(409, { error: 'rate_limited' });
    page.click('L2');
    await page.flush();
    expect(page.checkoutCalls()[1].body.expectedPriceCents).toBe(RAIL_LADDER_USD[1] * 100);
  });

  it('un total non divisible par la durée montre quand même le prix et ne boucle pas', async () => {
    // Total impossible à ramener à un prix unitaire (le Worker n'en produit
    // pas, mais la page ne doit pas dépendre de ça). Sans traitement, le
    // second clic renverrait l'attente périmée, donc le même refus, sans fin.
    const page = mount();
    page.pickMonths(3);
    page.state.next = reply(409, { error: 'price_changed', priceCents: 44701 });
    page.click('L2');
    await page.flush();
    expect(page.status('L2')).toBe(
      expected('fr', 'buyErrorPriceChanged', { slot: 'L2', price: usd(447.01, 'fr'), duration: UI.fr.site.sponsor.buyDurationThree })
    );

    page.state.next = reply(409, { error: 'rate_limited' });
    page.click('L2');
    await page.flush();
    expect(page.checkoutCalls()[1].body.expectedPriceCents).toBe(44701);
  });

  it('un montant inexploitable ne fait pas inventer un prix', async () => {
    const page = mount();
    page.state.next = reply(409, { error: 'price_changed', priceCents: 'beaucoup' });
    page.click('L2');
    await page.flush();
    expect(page.status('L2')).toBe(expected('fr', 'buyError', { slot: 'L2' }));
    expect(page.item('L2').querySelector('.sp-inv-price').textContent).toBe(usd(RAIL_LADDER_USD[0], 'fr'));
  });

  it('changer de durée efface un message devenu périmé', async () => {
    const page = mount();
    page.state.next = reply(409, { error: 'price_changed', priceCents: RAIL_LADDER_USD[1] * 100 });
    page.click('L2');
    await page.flush();
    expect(page.status('L2')).not.toBe('');
    page.pickMonths(3);
    expect(page.status('L2')).toBe('');
  });
});

describe('site.js — un seul paiement en vol', () => {
  it('deux clics sur le MÊME bouton n’ouvrent qu’une session', async () => {
    const page = mount();
    page.click('L1');
    page.click('L1');
    await page.flush();
    expect(page.checkoutCalls()).toHaveLength(1);
  });

  it('deux clics sur des slots DIFFÉRENTS n’ouvrent qu’une session', async () => {
    // Sans verrou partagé, deux réservations partent, et le visiteur consomme
    // d'un coup les deux emplacements de son plafond (MAX_HOLDS_PER_VISITOR).
    const page = mount();
    page.click('L1');
    page.click('R4');
    await page.flush();
    expect(page.checkoutCalls()).toHaveLength(1);
  });

  it('rouvre tous les boutons après un échec, pas seulement celui qu’on a cliqué', async () => {
    const page = mount();
    page.state.next = reply(429, { error: 'rate_limited' });
    page.click('L1');
    await page.flush();
    expect(page.button('L1').disabled).toBe(false);
    expect(page.button('R4').disabled).toBe(false);
    page.click('R4');
    await page.flush();
    expect(page.checkoutCalls()).toHaveLength(2);
  });
});

describe('site.js — la seule navigation qui sort de la page', () => {
  it('suit l’URL de Stripe rendue par le Worker', async () => {
    const page = mount();
    page.state.next = reply(200, { url: 'https://checkout.stripe.com/c/pay/cs_test_123' });
    page.click('L1');
    await page.flush();
    expect(page.location.href).toBe('https://checkout.stripe.com/c/pay/cs_test_123');
  });

  const refused = [
    ['javascript:', 'javascript:alert(1)'],
    ['http en clair', 'http://checkout.stripe.com/c/pay/x'],
    ['un hôte étranger', 'https://evil.example/c/pay/x'],
    ['un hôte étranger déguisé en userinfo', 'https://checkout.stripe.com@evil.example/c/pay/x'],
    ['un hôte qui imite le domaine', 'https://checkout.stripe.com.evil.example/x'],
    ['une URL illisible', 'pas une url'],
  ];
  for (const [label, url] of refused) {
    it(`refuse ${label}, et le dit`, async () => {
      const page = mount();
      page.state.next = reply(200, { url });
      page.click('L1');
      await page.flush();
      expect(page.location.href).toContain('/fr/sponsor');
      expect(page.status('L1')).toBe(expected('fr', 'buyError', { slot: 'L1' }));
    });
  }
});

describe('site.js — retour par l’historique', () => {
  it('pageshow rouvre le bouton et efface un statut devenu faux', async () => {
    const page = mount();
    page.state.next = reply(200, { url: 'https://checkout.stripe.com/c/pay/cs_test_123' });
    page.click('L1');
    await page.flush();
    // Le bouton est laissé désactivé : la page part chez Stripe.
    expect(page.button('L1').disabled).toBe(true);
    expect(page.status('L1')).not.toBe('');

    page.win.dispatchEvent(new page.win.Event('pageshow'));
    expect(page.button('L1').disabled).toBe(false);
    expect(page.status('L1')).toBe('');
  });

  it('laisse repartir un paiement après le retour', async () => {
    const page = mount();
    page.state.next = reply(200, { url: 'https://checkout.stripe.com/c/pay/cs_test_123' });
    page.click('L1');
    await page.flush();
    page.win.dispatchEvent(new page.win.Event('pageshow'));
    page.state.next = reply(429, { error: 'rate_limited' });
    page.click('L1');
    await page.flush();
    expect(page.checkoutCalls()).toHaveLength(2);
  });
});

describe('site.js — la réservation du visiteur lui-même', () => {
  it('retient l’emplacement pour lequel il vient d’ouvrir un paiement', async () => {
    const page = mount();
    page.state.next = reply(200, { url: 'https://checkout.stripe.com/c/pay/cs_test_123' });
    page.click('L1');
    await page.flush();
    expect(JSON.parse(page.win.sessionStorage.getItem('smf:sponsor-holds'))).toContain('L1');
  });

  it('garde le bouton sur SA propre réservation — le Worker sait la reprendre', async () => {
    // Sans ça, recharger la page après un aller-retour chez Stripe retirait le
    // bouton pendant toute la durée de la réservation, et la branche de
    // reprise de reserveSlot devenait inatteignable depuis la page.
    const page = mount({ slots: { L1: { status: 'reserved' } }, holds: ['L1'] });
    await page.flush();
    expect(page.item('L1').className).toContain('open');
    expect(page.button('L1')).not.toBe(null);
    expect(page.button('L1').disabled).toBe(false);
  });

  it('retire le bouton sur la réservation de quelqu’un d’autre', async () => {
    const page = mount({ slots: { L1: { status: 'reserved' } } });
    await page.flush();
    expect(page.item('L1').className).toContain('taken');
    expect(page.item('L1').querySelector('.sp-inv-buy')).toBe(null);
  });

  it('ne garde rien quand le slot est passé payé — même s’il l’a payé lui-même', async () => {
    const page = mount({ slots: { L1: { status: 'paid' } }, holds: ['L1'] });
    await page.flush();
    expect(page.item('L1').className).toContain('taken');
    expect(page.item('L1').querySelector('.sp-inv-buy')).toBe(null);
  });
});

describe('site.js — retour depuis le paiement', () => {
  it('dévoile la note quand ?paid=1 est présent', async () => {
    const page = mount({ search: '?paid=1' });
    expect(page.doc.getElementById('sponsor-paid-note').hidden).toBe(false);
  });

  it('la laisse masquée sans le paramètre', async () => {
    const page = mount();
    expect(page.doc.getElementById('sponsor-paid-note').hidden).toBe(true);
  });

  it('ne la dévoile pas sur une autre valeur', async () => {
    const page = mount({ search: '?paid=oui' });
    expect(page.doc.getElementById('sponsor-paid-note').hidden).toBe(true);
  });
});

describe('site.js — nom accessible des boutons', () => {
  it('chaque bouton porte son slot dans son nom, pas seulement dans un span voisin', async () => {
    const page = mount();
    for (const slot of ['L1', 'R4', 'T01', 'B10']) {
      const btn = page.button(slot);
      const ids = btn.getAttribute('aria-labelledby').split(/\s+/);
      const name = ids.map((id) => page.doc.getElementById(id).textContent.trim()).join(' ');
      expect(name, slot).toBe(`${UI.fr.site.sponsor.bookCta} ${slot}`);
    }
  });

  it('les vingt-huit noms sont distincts', async () => {
    const page = mount();
    const names = [...page.section.querySelectorAll('.sp-inv-buy')].map((btn) =>
      btn.getAttribute('aria-labelledby').split(/\s+/)
        .map((id) => page.doc.getElementById(id).textContent.trim()).join(' ')
    );
    expect(names).toHaveLength(28);
    expect(new Set(names).size).toBe(28);
  });

  it('le prix est décrit, pas nommé — il change, le nom ne doit pas', async () => {
    const page = mount();
    const btn = page.button('L1');
    const described = page.doc.getElementById(btn.getAttribute('aria-describedby'));
    expect(described.className).toContain('sp-inv-price');
    expect(described.textContent).toBe(usd(RAIL_LADDER_USD[0], 'fr'));
  });
});
