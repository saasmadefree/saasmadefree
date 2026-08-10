import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderSponsorPage, SPONSOR_EMAIL } from '../scripts/lib/site-page-sponsor.mjs';
import {
  sponsorContext, RAIL_SLOTS, TAPE_TOP_SLOTS, TAPE_BOTTOM_SLOTS,
  RAIL_LADDER_USD, TAPE_LADDER_USD,
} from '../scripts/lib/site-sponsors.mjs';
import { SPONSOR_CHECKOUT_API_URL } from '../scripts/lib/site-data.mjs';
import { SELLABLE_MONTHS } from '../worker/src/sponsors.mjs';

// Le bouton d'achat de /sponsor. La page reste complète sans JavaScript
// (principe 5 de .impeccable.md) : ces tests vérifient donc autant ce qui est
// rendu que ce qui reste utilisable quand le script ne s'exécute jamais.
//
// Les tables de traduction ne sont PAS des fixtures ici : on rend la vraie
// page depuis data/i18n/{en,fr}/ui.json. Une clé oubliée en français produit
// alors "undefined" dans le HTML, et les tests le voient — ce qu'une fixture
// écrite à la main ne montrerait jamais.

const LANGS = ['en', 'fr'];
const UI = Object.fromEntries(
  LANGS.map((lang) => [lang, JSON.parse(readFileSync(join('data', 'i18n', lang, 'ui.json'), 'utf8'))])
);

const FIGURES = { toolsPublished: 529, categories: 51, languages: 2, totalMonthlyUsd: 11760.18, prompts: 529 };

function pageFor(lang, { placements = [], liveSlots = null, ui = UI[lang] } = {}) {
  const sponsors = sponsorContext({
    placements, today: '2026-08-10', lang, ui, favicons: {},
    sponsorHref: `/${lang}/sponsor`, liveSlots,
  });
  return renderSponsorPage({
    lang, path: `/${lang}/sponsor`, ui, alternates: [], xDefaultPath: null,
    homePath: `/${lang}/`, sponsors, sponsorSlots: null, figures: FIGURES, stats: null,
  });
}

/** Le <li> d'inventaire d'un slot donné, isolé du reste de la page. */
function itemFor(html, slot) {
  const m = html.match(new RegExp(`<li class="sp-inv-item[^>]*data-slot="${slot}"[^>]*>.*?</li>`, 's'));
  if (!m) throw new Error(`aucun <li> trouvé pour le slot ${slot}`);
  return m[0];
}

// ---------------------------------------------------------------------------
// Le contrat entre le Worker et la page : tout code d'erreur que la route de
// checkout sait rendre doit avoir un message destiné à l'acheteur. Les deux
// programmes sont séparés — rien d'autre que ce test ne les oblige à
// s'accorder, et un code sans message rendrait un clic silencieux, ce qui est
// pire que pas de bouton du tout.
// ---------------------------------------------------------------------------
const WORKER_SRC = readFileSync(join('worker', 'src', 'index.mjs'), 'utf8');

function checkoutErrorCodes() {
  const start = WORKER_SRC.indexOf('async function handleSponsorCheckout');
  const end = WORKER_SRC.indexOf('async function handleSponsorWebhook');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('handleSponsorCheckout introuvable dans worker/src/index.mjs — ce test doit être réajusté');
  }
  const body = WORKER_SRC.slice(start, end);
  const codes = new Set([...body.matchAll(/error: '([a-z_]+)'/g)].map((m) => m[1]));
  // Deux codes atteignables sur cette route sans être écrits dans sa fonction :
  // le filet global de `export default` (toute exception D1 non prévue) et le
  // garde-fou de `handle()` sur VOTE_SALT, qui précède le routage sponsors.
  codes.add('internal_error');
  codes.add('misconfigured');
  return [...codes].sort();
}

/** Nom de l'attribut qui porte le message d'un code d'erreur donné. */
const attrFor = (code) => `data-sponsor-msg-${code.replace(/_/g, '-')}`;

describe('page /sponsor — messages d’achat', () => {
  const codes = checkoutErrorCodes();

  it('la route de checkout rend bien plusieurs codes distincts', () => {
    // Garde-fou du test lui-même : si l'extraction ne trouve plus rien, les
    // assertions ci-dessous passeraient à vide.
    expect(codes.length).toBeGreaterThan(5);
    expect(codes).toContain('price_changed');
    expect(codes).toContain('slot_taken');
  });

  for (const lang of LANGS) {
    it(`${lang} : chaque code d’erreur de la route porte un message pour l’acheteur`, () => {
      const html = pageFor(lang);
      for (const code of codes) {
        expect(html, `code "${code}" sans message sur la page ${lang}`).toContain(`${attrFor(code)}="`);
      }
    });

    it(`${lang} : un message de repli couvre les échecs sans code (réseau, CORS, réponse illisible)`, () => {
      expect(pageFor(lang)).toContain('data-sponsor-msg-fallback="');
    });

    it(`${lang} : aucun message n’est vide, ni "undefined" (traduction manquante)`, () => {
      const html = pageFor(lang);
      for (const code of [...codes, 'fallback', 'opening']) {
        const m = html.match(new RegExp(`${attrFor(code)}="([^"]*)"`));
        expect(m, `attribut ${attrFor(code)} absent en ${lang}`).not.toBe(null);
        expect(m[1].trim(), `${attrFor(code)} vide en ${lang}`).not.toBe('');
        expect(m[1], `${attrFor(code)} non traduit en ${lang}`).not.toContain('undefined');
      }
    });

    it(`${lang} : le message de dérive de prix annonce le nouveau montant et nomme le slot`, () => {
      const m = pageFor(lang).match(new RegExp(`${attrFor('price_changed')}="([^"]*)"`));
      // {price} et {slot} sont substitués côté client, au moment du refus :
      // le montant réel n'existe pas au build.
      expect(m[1]).toContain('{price}');
      expect(m[1]).toContain('{slot}');
    });
  }

  it('n’écrit jamais un message brut dans le HTML — tout passe par escapeHtml', () => {
    const hostile = { ...UI.en, site: { ...UI.en.site, sponsor: { ...UI.en.site.sponsor,
      buyErrorSlotTaken: '"><script>alert(1)</script>' } } };
    const html = pageFor('en', { ui: hostile });
    expect(html).not.toContain('"><script>alert(1)');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
  });
});

describe('page /sponsor — le bouton d’achat', () => {
  it('pointe vers la route de checkout du Worker', () => {
    expect(pageFor('en')).toContain(`data-sponsor-checkout-endpoint="${SPONSOR_CHECKOUT_API_URL}"`);
  });

  it('pose un bouton sur chaque emplacement libre', () => {
    const html = pageFor('en');
    for (const slot of [...RAIL_SLOTS, ...TAPE_TOP_SLOTS, ...TAPE_BOTTOM_SLOTS]) {
      expect(itemFor(html, slot), slot).toContain('class="sp-inv-buy"');
      expect(itemFor(html, slot), slot).toContain(`data-slot="${slot}"`);
    }
  });

  it('reprend le verbe déjà affiché sur les cartes, jamais une seconde traduction', () => {
    expect(itemFor(pageFor('fr'), 'L1')).toContain(UI.fr.site.sponsor.bookCta);
    expect(itemFor(pageFor('en'), 'L1')).toContain(UI.en.site.sponsor.bookCta);
  });

  it('reste masqué tant que le script ne l’a pas activé — un contrôle mort est pire qu’absent', () => {
    const li = itemFor(pageFor('en'), 'L1');
    expect(li).toMatch(/<button[^>]*\bhidden\b/);
  });

  // Vingt-huit boutons portant tous le même mot sont indistinguables au
  // clavier et au lecteur d'écran, sur une page où le moins cher vaut 75 $US
  // et le plus cher 1 800 $US. Le nom accessible doit porter l'emplacement.
  // Le nom RÉSOLU est vérifié dans un DOM par tests/sponsor-checkout-client.test.mjs ;
  // ici on verrouille les identifiants qui le composent.
  it('compose son nom accessible avec l’identifiant de l’emplacement', () => {
    const li = itemFor(pageFor('en'), 'R4');
    expect(li).toContain('id="sp-buy-R4"');
    expect(li).toContain('aria-labelledby="sp-buy-R4 sp-slot-R4"');
    expect(li).toContain('id="sp-slot-R4"');
  });

  it('décrit le prix sans le mettre dans le nom — il change, le nom ne doit pas', () => {
    const li = itemFor(pageFor('en'), 'R4');
    expect(li).toContain('aria-describedby="sp-price-R4"');
    expect(li).toContain('id="sp-price-R4"');
  });

  it('n’émet aucun identifiant en double sur la page', () => {
    const ids = [...pageFor('en').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size, `identifiants dupliqués : ${ids.join(', ')}`).toBe(ids.length);
  });

  it('n’existe pas sur un emplacement pris — il n’y a rien à vendre', () => {
    const placements = [{
      slot: 'L1', name: 'Postiz', domain: 'postiz.com', url: 'https://postiz.com',
      tagline: { en: 'x', fr: 'x' }, startsOn: '2026-08-01', endsOn: '2026-09-01',
    }];
    const html = pageFor('en', { placements });
    expect(itemFor(html, 'L1')).not.toContain('sp-inv-buy');
    expect(itemFor(html, 'L2')).toContain('sp-inv-buy');
  });

  it('n’existe pas non plus sur un slot que le Worker dit pris, même absent de data/sponsors.json', () => {
    // C'est le cas inverse du sponsor commité à la main : la charge utile
    // promeut le slot vers « pris », le bouton doit disparaître avec le prix.
    const html = pageFor('en', { liveSlots: { L1: { status: 'paid' }, L2: { status: 'reserved' } } });
    expect(itemFor(html, 'L1')).not.toContain('sp-inv-buy');
    expect(itemFor(html, 'L2')).not.toContain('sp-inv-buy');
    expect(itemFor(html, 'L3')).toContain('sp-inv-buy');
  });
});

describe('page /sponsor — le prix envoyé au Worker', () => {
  it('publie le prix du compartiment en centimes, à côté du barème', () => {
    const html = pageFor('en');
    const lists = [...html.matchAll(/<ul class="sp-inv"[^>]*>/g)].map((m) => m[0]);
    expect(lists).toHaveLength(3);
    // Rails, bandeau haut, bandeau bas — dans l'ordre de renderSponsorPage.
    expect(lists[0]).toContain(`data-sponsor-price-cents="${RAIL_LADDER_USD[0] * 100}"`);
    expect(lists[1]).toContain(`data-sponsor-price-cents="${TAPE_LADDER_USD[0] * 100}"`);
    expect(lists[2]).toContain(`data-sponsor-price-cents="${TAPE_LADDER_USD[0] * 100}"`);
  });

  it('monte d’une marche quand un slot du compartiment est vendu — même barème que le Worker', () => {
    const html = pageFor('en', { liveSlots: { L1: { status: 'paid' } } });
    const lists = [...html.matchAll(/<ul class="sp-inv"[^>]*>/g)].map((m) => m[0]);
    expect(lists[0]).toContain(`data-sponsor-price-cents="${RAIL_LADDER_USD[1] * 100}"`);
  });

  it('n’annonce aucun prix en centimes quand le compartiment est plein — jamais un zéro', () => {
    const liveSlots = Object.fromEntries(RAIL_SLOTS.map((slot) => [slot, { status: 'paid' }]));
    const html = pageFor('en', { liveSlots });
    const lists = [...html.matchAll(/<ul class="sp-inv"[^>]*>/g)].map((m) => m[0]);
    expect(lists[0]).not.toContain('data-sponsor-price-cents');
  });
});

describe('page /sponsor — la durée vendue', () => {
  it('n’offre que les durées que le Worker accepte de facturer', () => {
    const html = pageFor('en');
    const values = [...html.matchAll(/name="sp-months"[^>]*value="(\d+)"/g)].map((m) => Number(m[1]));
    expect(values.sort()).toEqual([...SELLABLE_MONTHS].sort());
  });

  it('reste masquée sans JavaScript — le choix ne servirait à rien', () => {
    expect(pageFor('en')).toMatch(/<fieldset class="sp-duration"[^>]*\bhidden\b/);
  });

  it('dit ce qui sera facturé pour chacune des deux durées', () => {
    const html = pageFor('fr');
    expect(html).toContain(UI.fr.site.sponsor.buyDurationNoteOne);
    expect(html).toContain(`data-note-three="${UI.fr.site.sponsor.buyDurationNoteThree}"`);
  });
});

describe('page /sponsor — sans JavaScript', () => {
  for (const lang of LANGS) {
    it(`${lang} : l’inventaire, les prix et le barème restent dans le HTML servi`, () => {
      const html = pageFor(lang);
      for (const slot of RAIL_SLOTS) expect(html, slot).toContain(`data-slot="${slot}"`);
      expect(html).toContain('sp-inv-price');
      expect(html).toContain('sp-ladder');
    });

    it(`${lang} : garde un chemin de contact qui ne dépend d’aucun script`, () => {
      expect(pageFor(lang)).toContain(`href="mailto:${SPONSOR_EMAIL}"`);
    });

    it(`${lang} : dit franchement au lecteur sans JavaScript où écrire`, () => {
      const html = pageFor(lang);
      const noscript = html.match(/<noscript>(.*?)<\/noscript>/s);
      expect(noscript, 'aucun <noscript> sur la page').not.toBe(null);
      expect(noscript[1]).toContain(SPONSOR_EMAIL);
    });
  }
});

describe('page /sponsor — retour depuis le paiement', () => {
  for (const lang of LANGS) {
    it(`${lang} : porte la note de retour, masquée tant que ?paid=1 n’est pas là`, () => {
      const html = pageFor(lang);
      expect(html).toMatch(/<p class="sp-paid-note"[^>]*\bhidden\b/);
      expect(html).toContain(UI[lang].site.sponsor.paidReturnNote);
    });

    it(`${lang} : n’affirme jamais que CE visiteur a payé — la redirection n’a aucune autorité`, () => {
      // Le webhook signé est la seule preuve de paiement : n'importe qui peut
      // taper ?paid=1 à la main. La note doit donc renvoyer au reçu Stripe
      // plutôt que de confirmer un encaissement.
      const note = UI[lang].site.sponsor.paidReturnNote;
      expect(note).toContain('Stripe');
    });
  }
});

describe('data/i18n — les deux langues publiées disent la même chose', () => {
  it('en et fr portent exactement les mêmes clés sous site.sponsor', () => {
    const en = Object.keys(UI.en.site.sponsor).sort();
    const fr = Object.keys(UI.fr.site.sponsor).sort();
    expect(fr, 'clés site.sponsor divergentes entre en et fr').toEqual(en);
  });

  it('décrit le parcours en trois étapes dans les deux langues', () => {
    for (const lang of LANGS) {
      expect(UI[lang].site.sponsor.howSteps, lang).toHaveLength(3);
    }
  });
});

describe('scripts/assets/site.js — garde-fous statiques', () => {
  const SITE_JS = readFileSync(join('scripts', 'assets', 'site.js'), 'utf8');

  it('n’écrit jamais de HTML : tout texte venant du réseau passe par textContent', () => {
    // Les messages d'erreur d'achat viennent d'attributs rendus au build, mais
    // le slot et le montant traversent une réponse HTTP. Un innerHTML dans ce
    // fichier rouvrirait une injection que tout le reste du site ferme.
    expect(SITE_JS).not.toContain('innerHTML');
    expect(SITE_JS).not.toContain('outerHTML');
    expect(SITE_JS).not.toContain('insertAdjacentHTML');
  });

  it('ne porte aucune URL littérale vers un tiers (principe 4)', () => {
    // On inspecte les chaînes littérales, pas le texte brut : les commentaires
    // du fichier citent volontairement des hôtes hostiles (l'exemple
    // `https://checkout.stripe.com@evil.example/` qui explique pourquoi la
    // garde de redirection lit l'hôte et non le préfixe). Les faire échouer ici
    // pousserait à retirer l'explication plutôt que le défaut.
    //
    // La contrepartie comportementale — « aucune requête ne part ailleurs » —
    // est vérifiée par tests/sponsor-checkout-client.test.mjs, qui enregistre
    // chaque appel réellement émis.
    const literals = [...SITE_JS.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
    const urls = literals.filter((value) => value.indexOf('://') !== -1);
    expect(urls.length, 'aucune URL littérale trouvée — le test ne vérifie plus rien').toBeGreaterThan(0);
    for (const url of urls) {
      expect(new URL(url).hostname.endsWith('saasmadefree.com'), url).toBe(true);
    }
  });
});
