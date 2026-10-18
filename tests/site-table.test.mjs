import { describe, it, expect } from 'vitest';
import { renderToolGrid } from '../scripts/lib/site-table.mjs';

// `ui` minimal pour la grille — n'expose que les clés lues par renderToolGrid
// (voir scripts/lib/site-table.mjs).
const ui = {
  site: {
    tool: {
      voteCountOne: '{count} vote',
      voteCountOther: '{count} votes',
      voteUnavailable: 'Vote count unavailable',
    },
    verdicts: {
      yes: { label: 'Yes' },
      kinda: { label: 'Almost' },
      no: { label: 'Not yet' },
    },
    home: {
      listHeading: 'The directory',
      cardDiyTemplate: 'DIY: {time}',
      cardAltsLabel: 'Free alternatives:',
    },
  },
  diyTimeEstimate: { weekend: 'A weekend', week: 'A week' },
};

const categories = {
  analytics: { label: { en: 'Analytics' } },
  design: { label: { en: 'Design' } },
};

// Deux fiches minimales : une en EUR à base mensuelle (verrouille l'affichage
// via Intl), une en paiement unique en USD (verrouille l'absence de "/mo"
// inventé pour une périodicité qui n'existe pas).
const tools = [
  {
    slug: 'euro-tool',
    name: 'Euro Tool',
    category: 'analytics',
    subcategory: null,
    tagline: 'Un outil facturé en euros',
    path: '/en/tools/euro-tool',
    pricing: { amount: 29, currency: 'EUR', basis: 'flat-monthly' },
    diyTimeEstimate: 'weekend',
    verdict: 'yes',
    pagePriority: 80,
    alternativeNames: ['Plausible', 'Umami'],
  },
  {
    slug: 'onetime-tool',
    name: 'Onetime Tool',
    category: 'design',
    subcategory: null,
    tagline: 'Un outil payé une seule fois',
    path: '/en/tools/onetime-tool',
    pricing: { amount: 199, currency: 'USD', basis: 'one-time' },
    diyTimeEstimate: 'week',
    verdict: 'kinda',
    pagePriority: 50,
  },
];

const render = (over = {}) => renderToolGrid(tools, { lang: 'en', ui, categories, voteCounts: null, favicons: {}, ...over });
const cardOf = (html, slug) => html.split('<li class="card"').find((chunk) => chunk.includes(`data-slug="${slug}"`));

describe('renderToolGrid — grille de cartes', () => {
  const html = render();

  it('conserve les crochets de site.js, posés sur les cartes', () => {
    for (const hook of ['id="tool-table"', 'id="tool-rows"', 'class="tool-grid"', 'data-vote-cell',
      'data-slug="euro-tool"', 'data-verdict="yes"', 'data-priority=', 'class="badge yes"',
      'class="cat"', 'class="price"', 'class="fav" src="',
      'class="card-name"><a href="/en/tools/euro-tool">Euro Tool</a>']) {
      expect(html).toContain(hook);
    }
  });

  // Poids de l'accueil (Task A8) : 530 cartes dans le HTML (spec D14). Les
  // attributs qui recopiaient un texte déjà visible (nom, catégorie,
  // accroche, icône) sont retirés ; site.js lit la carte elle-même. Seule la
  // sous-catégorie, cherchable mais non affichée, garde un attribut.
  it('ne recopie pas en attribut un texte déjà visible sur la carte', () => {
    for (const dup of ['data-search=', 'data-name=', 'data-cat=', 'data-favicon=', 'data-vote-slug=']) {
      expect(html).not.toContain(dup);
    }
    expect(html).not.toContain('data-sub=');
    const sub = renderToolGrid([{ ...tools[0], subcategory: 'Email Marketing' }], {
      lang: 'en', ui, categories, voteCounts: null, favicons: {},
    });
    expect(sub).toContain('data-sub="email marketing"');
  });

  it('rend une carte par fiche, toutes visibles dans le HTML', () => {
    expect(html.match(/<li class="card"/g)).toHaveLength(2);
    expect(html).not.toMatch(/<li class="card"[^>]*\shidden/);
  });

  it('une fiche EUR affiche l’euro, une one-time n’affiche pas /mo', () => {
    expect(cardOf(html, 'euro-tool')).toContain('€');
    expect(cardOf(html, 'onetime-tool')).not.toMatch(/\/mo\b/);
  });

  it('ne pose un prix de tri que sur une base mensuelle — jamais un paiement unique comparé à un mois', () => {
    expect(cardOf(html, 'euro-tool')).toContain('data-price="29"');
    expect(cardOf(html, 'onetime-tool')).not.toContain('data-price=');
  });

  it('affiche le temps de fabrication et les alternatives libres quand il y en a', () => {
    expect(cardOf(html, 'euro-tool')).toContain('DIY: A weekend');
    expect(cardOf(html, 'euro-tool')).toContain('<p class="alts"><span>Free alternatives:</span> Plausible, Umami</p>');
    expect(cardOf(html, 'onetime-tool')).not.toContain('class="alts"');
  });

  it('rend les trois états du compteur de votes sans jamais inventer un zéro', () => {
    // Service muet au build : ni chiffre ni zéro, la mention reste lisible
    // au lecteur d'écran, et aucune donnée de tri par votes.
    expect(cardOf(html, 'euro-tool')).toContain('<span class="visually-hidden">Vote count unavailable</span>');
    expect(cardOf(html, 'euro-tool')).not.toContain('data-votes=');
    // Un slug absent de la réponse est un vrai zéro : il trie, mais ne
    // s'affiche qu'au lecteur d'écran — « 0 vote » sur cinq cents cartes est du bruit.
    const counted = render({ voteCounts: { 'onetime-tool': 3 } });
    expect(cardOf(counted, 'euro-tool')).toContain('data-votes="0"');
    expect(cardOf(counted, 'euro-tool')).toContain('<span class="visually-hidden">0 votes</span>');
    expect(cardOf(counted, 'onetime-tool')).toContain('data-votes="3"');
    expect(cardOf(counted, 'onetime-tool')).toMatch(/data-vote-cell>3 votes</);
  });

  it('le titre de carte suit le niveau demandé (h3 sous un h2, h2 sous le h1 d’une catégorie)', () => {
    expect(html).toContain('<h3 class="card-name">');
    expect(render({ headingLevel: 2 })).toContain('<h2 class="card-name">');
  });

  // Revue finale, finding 10 : la note de classement mentait dès qu'on
  // retriait la grille. La liste porte le titre de l'annuaire, ou celui que
  // la page lui donne.
  it('nomme la liste par le titre de l’annuaire, ou par le libellé fourni', () => {
    expect(html).toContain('<ul class="tool-grid" id="tool-rows" aria-label="The directory">');
    expect(render({ label: 'Analytics & <BI>' })).toContain('aria-label="Analytics &amp; &lt;BI&gt;"');
    expect(html).not.toContain('Ranked by');
  });
});
