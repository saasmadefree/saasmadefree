import { describe, it, expect } from 'vitest';
import { renderHomePage } from '../scripts/lib/site-page-home.mjs';
import { formatMoney } from '../scripts/lib/site-format.mjs';

// Fabrique réaliste (locale fr) : uniquement des clés qui existent dans
// data/i18n/fr/ui.json — le test verrouille le gabarit, pas les traductions.
const ui = {
  site: {
    brand: 'SaaS Made Free',
    skipToContent: 'Aller au contenu',
    directoryLabel: 'Annuaire',
    languageSwitcherLabel: 'Langue',
    themeToDark: 'Papier de nuit',
    themeToLight: 'Papier de jour',
    nav: { submitTool: 'Proposer un outil', sponsor: 'Sponsor', source: 'Code source', github: 'GitHub' },
    footer: { source: 'Code source', stats: 'Statistiques', privacy: 'Confidentialité', credit: 'Crédit' },
    dossier: {
      serviceName: "Service de l'instruction des abonnements",
      registryLabel: 'Registre',
      statusArrestedOn: 'État arrêté le',
      pricesVerifiedSince: 'Prix tous vérifiés depuis le',
      searchFrameHeading: 'Recherche au registre',
    },
    verdicts: {
      yes: { label: 'Oui', desc: 'Un agent le refait' },
      kinda: { label: 'Presque', desc: 'Une partie se refait' },
      no: { label: 'Non', desc: 'Garde ton abonnement' },
    },
    tool: { voteCountOne: '{count} vote', voteCountOther: '{count} votes', voteUnavailable: 'Compteur indisponible' },
    home: {
      titleTag: 'SaaS Made Free — bordereau général',
      metaDescription: 'Le bordereau général du catalogue.',
      heroQuestion: 'Un prompt peut-il remplacer {blank} ?',
      heroLine1: 'Certains abonnements sont un vrai business.',
      heroLine2: 'D’autres ne tiennent qu’à un prompt.',
      lede: 'Un annuaire ouvert des logiciels que tu paies chaque mois.',
      searchLabel: 'Chercher dans l’annuaire',
      searchPlaceholder: 'Chercher par nom ou catégorie',
      searchClearLabel: 'Effacer la recherche',
      searchResultsLabel: 'Résultats de recherche',
      searchViewAllTemplate: '↓ Voir les {count} résultats',
      noResults: 'Aucun outil ne correspond à cette recherche.',
      categoryFilterLabel: 'Filtrer par catégorie',
      allChip: 'Tous',
      allCategoriesChip: 'Toutes les catégories →',
      listHeading: 'L’annuaire',
      listCaption: 'Tous les outils publiés, triés par votes.',
      colName: 'Outil',
      colCategory: 'Catégorie',
      colPrice: 'Prix',
      colVerdict: 'Verdict',
      colVotes: 'Votes',
      rankNote: 'Classé par votes enregistrés jusqu’ici.',
      verdictFilterAriaLabel: 'Filtrer par verdict',
      figuresAriaLabel: 'Chiffres du catalogue',
      figureToolsPublished: 'Outils publiés',
      figureCategories: 'Catégories',
      figureTotalPrice: 'Prix mensuel total du catalogue (USD)',
      mrrLabel: 'Dépense mensuelle représentée par les votes',
      mrrSrTemplate: '{amount} par mois représentés par les votes',
      mrrUnavailable: 'Chiffre en direct indisponible pour l’instant.',
      tallyOne: '{count} outil publié pour l’instant.',
      tallyOther: '{count} outils publiés pour l’instant.',
    },
  },
};

const categories = {
  analytics: { emoji: '📈', label: { fr: 'Analytics' } },
  design: { label: { fr: 'Design' } },
};

// Deux fiches : le plancher du cachet est le min des checkedOn (2026-07-28),
// jamais la plus récente — voir oldestCheckedOn dans site-data.mjs.
const toolViews = [
  {
    slug: 'outil-a',
    name: 'Outil A',
    category: 'analytics',
    subcategory: null,
    tagline: 'Un outil de mesure',
    path: '/fr/tools/outil-a',
    pricing: { amount: 9, currency: 'USD', basis: 'flat-monthly', checkedOn: '2026-07-30' },
    verdict: 'yes',
    pagePriority: 80,
  },
  {
    slug: 'outil-b',
    name: 'Outil B',
    category: 'design',
    subcategory: null,
    tagline: 'Un outil de dessin',
    path: '/fr/tools/outil-b',
    pricing: { amount: 20, currency: 'USD', basis: 'per-seat-monthly', checkedOn: '2026-07-28' },
    verdict: 'no',
    pagePriority: 50,
  },
];

function renderHome(over = {}) {
  return renderHomePage({
    lang: 'fr',
    path: '/fr/',
    toolViews,
    topCategorySlugs: ['analytics', 'design'],
    categories,
    voteCounts: null,
    favicons: {},
    figures: { toolsPublished: 2, categories: 2, languages: 1, totalMonthlyUsd: 29, prompts: 2 },
    mrrTotal: null,
    ui,
    alternates: [{ lang: 'en', path: '/en/' }, { lang: 'fr', path: '/fr/' }],
    xDefaultPath: '/en/',
    sponsorSlots: null,
    buildDate: '2026-08-03',
    ...over,
  });
}

const html = renderHome();

describe('renderHomePage — bordereau général', () => {
  it('ne contient plus aucune occurrence de ticker', () => {
    expect(html.toLowerCase()).not.toContain('ticker');
  });

  it('porte le bandeau de service via renderLayout', () => {
    expect(html).toContain('class="service-band"');
    expect(html).toContain("Service de l&#39;instruction des abonnements");
  });

  it('rend la cartouche de références : registre, catégories, état arrêté le (date du build)', () => {
    expect(html).toContain('class="ref-strip"');
    expect(html).toContain('Registre');
    expect(html).toContain('Catégories');
    expect(html).toContain('État arrêté le');
    expect(html).toContain('03.08.2026'); // formatStampDate(buildDate)
  });

  it('tamponne l’état récapitulatif avec la garantie plancher — le min des checkedOn', () => {
    expect(html).toContain('stamp-verif');
    expect(html).toContain('Prix tous vérifiés depuis le');
    expect(html).toContain('28.07.2026'); // min(2026-07-30, 2026-07-28), jamais le plus récent
    expect(html).not.toContain('30.07.2026');
  });

  it('suit la structure du bordereau : héro, cadre recherche, récapitulatif, registre, signature', () => {
    const order = ['class="hero sheet"', 'class="search-frame sheet"', 'class="recap sheet"',
      'class="list-head"', 'class="table-scroll registry"', 'class="sign-row"'];
    let last = -1;
    for (const marker of order) {
      const at = html.indexOf(marker);
      expect(at, marker).toBeGreaterThan(last);
      last = at;
    }
  });

  it('conserve tous les crochets fonctionnels de site.js', () => {
    for (const hook of ['id="q"', 'id="search-panel"', 'id="search-clear"', 'class="search-shell"',
      'class="search-combo"', 'class="chips-nav"', 'class="chips"', 'chip verdict-chip',
      'data-verdict="all"', 'data-verdict="yes"', 'data-verdict="kinda"', 'data-verdict="no"',
      'aria-pressed="true"', 'aria-pressed="false"', 'id="no-results"', 'class="field"',
      'data-view-all-template=', 'data-no-results=', 'data-home-path=',
      'id="tool-table"', 'id="tool-rows"']) {
      expect(html).toContain(hook);
    }
  });

  it('titre le cadre recherche avec dossier.searchFrameHeading, en étiquette du champ', () => {
    expect(html).toContain('<label for="q">Recherche au registre</label>');
  });

  it('la ligne à remplir du héro est statique, placeholder italique dans le cadre', () => {
    expect(html).toContain('class="hero-blank"');
    // Scopé à la section héro (avant le cadre recherche, qui lui porte le
    // vrai <input type="search">) : "pas d'<input type=\"text\">" laissait
    // passer n'importe quel autre type de champ, et ne vérifiait rien sur sa
    // position — un <input> ailleurs avant le cadre recherche serait passé
    // inaperçu.
    const heroSegment = html.slice(0, html.indexOf('class="search-frame'));
    expect(heroSegment).not.toContain('<input'); // jamais un champ dans le héro
  });

  it('sans compteur de votes, la ligne MRR n’apparaît pas — texte simple à la place', () => {
    expect(html).not.toContain('Dépense mensuelle représentée par les votes');
    expect(html).toContain('Chiffre en direct indisponible pour l’instant.');
  });

  it('avec un total calculable, la ligne MRR est une ligne de bordereau sobre', () => {
    const withMrr = renderHome({ mrrTotal: 3065 });
    expect(withMrr).toContain('Dépense mensuelle représentée par les votes');
    // Le montant via formatMoney (séparateur de milliers Intl fr : espace
    // fine insécable) — jamais de digit boxes.
    expect(withMrr).toContain(formatMoney(3065, 'USD', 'fr'));
    expect(withMrr).not.toContain('digit-box');
    expect(withMrr).not.toContain('Chiffre en direct indisponible');
  });

  it('conserve JSON-LD et alternates', () => {
    expect(html).toContain('application/ld+json');
    expect(html).toContain('hreflang="en"');
    expect(html).toContain('hreflang="x-default"');
  });
});
