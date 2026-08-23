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

  it('ne porte plus de bandeau de service', () => {
    expect(html).not.toContain('class="service-band"');
    expect(html).not.toContain("Service de l&#39;instruction des abonnements");
  });

  it('ne rend plus de cartouche de références sur l’accueil', () => {
    // Retirée le 20.08.2026 : elle répétait en tête, en plus grand, ce que le
    // récapitulatif dit plus bas — nombre de fiches et de catégories — et
    // repoussait le titre sous la ligne de flottaison. Elle reste sur la
    // fiche outil, où ses cellules ne figurent nulle part ailleurs.
    expect(html).not.toContain('class="ref-strip"');
  });

  it('ne tamponne plus le catalogue par sa pire fiche', () => {
    // Retiré le 20.08.2026. Le cachet portait un vrai fait — la plus ANCIENNE
    // date de relevé du catalogue — mais chaque fiche affiche déjà sa propre
    // date de vérification à côté de sa source, là où elle sert. En pied
    // d'accueil, il ne faisait que dater les 530 fiches par la plus vieille.
    expect(html).not.toContain('stamp-verif');
    expect(html).not.toContain('Prix tous vérifiés depuis le');
  });

  it('suit la structure du Verdict : héro, bande de répartition, recherche, récapitulatif, registre, signature', () => {
    // La recherche est passée DANS le héro, au-dessus de la bande : c'est le
    // premier geste d'un visiteur venu pour un outil précis.
    const order = ['class="hero"', 'class="search-frame"', 'class="verdict-band"', 'class="recap"',
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
      'class="search-combo"', 'class="chips-nav"', 'class="chips"', 'verdict-chip',
      'data-verdict="all"', 'data-verdict="yes"', 'data-verdict="kinda"', 'data-verdict="no"',
      'aria-pressed="true"', 'aria-pressed="false"', 'id="no-results"', 'class="field"',
      'data-view-all-template=', 'data-no-results=', 'data-home-path=',
      'id="tool-table"', 'id="tool-rows"']) {
      expect(html).toContain(hook);
    }
  });

  it('étiquette le champ pour les lecteurs d’écran, sans cartouche visible', () => {
    // Le cartouche « Recherche au registre » était un meuble du dossier. Dans
    // le héro, le placeholder et le contexte suffisent à l'œil ; l'étiquette
    // reste, en visually-hidden, parce qu'un champ sans <label> n'a pas de nom.
    expect(html).toContain('<label for="q" class="visually-hidden">');
    expect(html).not.toContain('<label for="q">Recherche au registre</label>');
  });

  it('le héro affirme, et le champ de recherche n’existe qu’une seule fois', () => {
    // La fausse ligne à remplir DANS le h1 est partie avec le dossier : elle
    // se lisait comme un bug de gabarit, et le vrai champ vivait quatre cents
    // pixels plus bas. Le titre est maintenant les deux lignes de heroLine.
    expect(html).not.toContain('hero-blank');
    expect(html).toContain('class="hero-rot"');
    // Un seul champ sur toute la page : c'est la duplication qui était le bug.
    expect((html.match(/<input/g) ?? []).length).toBe(1);
    // Et il est DANS le héro, au-dessus de la bande — plus quatre cents
    // pixels plus bas.
    expect(html.indexOf('id="q"')).toBeLessThan(html.indexOf('class="verdict-band"'));
  });

  it('le titre à trou ne montre jamais deux noms à la fois', () => {
    // Le nombre de noms et la fenêtre de visibilité des keyframes sont liés :
    // huit noms, donc 12,5 % du cycle chacun. Une fenêtre plus large fait se
    // chevaucher deux noms, ce qui se lit comme un défaut d'affichage — vu en
    // recette le 20.08.2026. Ce test tient les deux bouts ensemble.
    const shown = [...html.matchAll(/class="hero-rot-item"/g)].length;
    const names = [...html.matchAll(/class="hero-rot"[^>]*style="--rot-count:(\d+)"/g)];
    expect(names.length).toBeGreaterThan(0);
    for (const [, count] of names) {
      expect(Number(count), 'jamais plus de 8 : au-delà, la fenêtre de 12,5 % se chevauche')
        .toBeLessThanOrEqual(8);
    }
    // Un seul rotateur depuis que le prix est devenu un badge volant.
    expect(shown).toBe(Number(names[0][1]));
    // Et les prix voyagent en données, pour que site.js puisse en semer
    // plusieurs à la fois.
    expect(html).toContain('class="hero-savings"');
    expect(html).toMatch(/data-savings="[^"]*\$/);
  });

  it('aucun emoji de catégorie sur la page — le libellé se suffit', () => {
    // data/categories.json porte toujours un emoji (l'extension s'en sert),
    // et le fixture aussi (analytics: 📈). Le site, lui, ne le pose plus :
    // un emoji est un rendu système, il change de dessin et de couleur d'un
    // appareil à l'autre, ce qu'une palette fermée ne peut pas absorber.
    expect(categories.analytics.emoji).toBe('📈'); // la donnée existe bien
    expect(html).not.toContain('📈');
    expect(html).toContain('Analytics'); // le libellé, lui, est là
  });

  it('la bande de répartition compte les verdicts sur les données, et pilote le filtre', () => {
    const band = html.slice(html.indexOf('class="verdict-band"'), html.indexOf('class="recap"'));
    // Le fixture porte deux fiches : une "yes", une "kinda" (voir TOOLS).
    expect(band).toContain('data-verdict="yes"');
    expect(band).toContain('data-verdict="kinda"');
    expect(band).toContain('data-verdict="no"');
    // flex-grow porte la proportion réelle, jamais une largeur en dur.
    expect(band).toContain('flex-grow:1'); // yes  : 1 fiche
    expect(band).toContain('flex-grow:0'); // no   : aucune fiche
    // Le verdict n'est jamais la couleur seule : le libellé est dans le nom
    // accessible ET dans le segment.
    expect(band).toContain('aria-label="Oui — 1 (50');
    expect(band).toContain('class="vb-label"');
    // Le bouton de remise à zéro reste un .verdict-chip, donc site.js le câble.
    expect(band).toContain('class="verdict-chip vb-reset is-active" data-verdict="all"');
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
