import { describe, it, expect } from 'vitest';
import { renderToolTable } from '../scripts/lib/site-table.mjs';

// `ui` minimal pour la table — n'expose que les clés lues par renderToolTable
// (voir scripts/lib/site-table.mjs) : site.tool.voteCountOne/Other/voteUnavailable,
// site.verdicts.*, site.home.listCaption/colName/colCategory/colPrice/colVerdict/colVotes.
const ui = {
  site: {
    tool: {
      voteCountOne: '{count} vote',
      voteCountOther: '{count} votes',
      voteUnavailable: 'Vote count unavailable',
    },
    verdicts: {
      yes: { label: 'Yes' },
      kinda: { label: 'Partly' },
      no: { label: 'No' },
    },
    home: {
      listCaption: 'Full catalogue',
      colName: 'Name',
      colCategory: 'Category',
      colPrice: 'Price',
      colVerdict: 'Verdict',
      colVotes: 'Votes',
    },
  },
};

const categories = {
  analytics: { label: { en: 'Analytics' } },
  design: { label: { en: 'Design' } },
};

// Deux fiches minimales : une en EUR à base mensuelle (verrouille l'affichage
// via Intl — §9.9 du spec), une en paiement unique en USD (verrouille
// l'absence de "/mo" inventé pour une périodicité qui n'existe pas).
const tools = [
  {
    slug: 'euro-tool',
    name: 'Euro Tool',
    category: 'analytics',
    subcategory: null,
    tagline: 'Un outil facturé en euros',
    path: '/en/tools/euro-tool',
    pricing: { amount: 29, currency: 'EUR', basis: 'flat-monthly' },
    verdict: 'yes',
    pagePriority: 80,
  },
  {
    slug: 'onetime-tool',
    name: 'Onetime Tool',
    category: 'design',
    subcategory: null,
    tagline: 'Un outil payé une seule fois',
    path: '/en/tools/onetime-tool',
    pricing: { amount: 199, currency: 'USD', basis: 'one-time' },
    verdict: 'kinda',
    pagePriority: 50,
  },
];

const html = renderToolTable(tools, { lang: 'en', ui, categories, voteCounts: null, favicons: {} });

describe('renderToolTable — registre', () => {
  it('porte la classe .registry sur le wrapper .table-scroll (Task 4)', () => {
    expect(html).toContain('class="table-scroll registry"');
  });

  it('conserve tous les crochets de site.js', () => {
    for (const hook of ['id="tool-table"', 'id="tool-rows"', 'data-vote-cell',
      'data-verdict=', 'data-search=', 'class="badge', 'class="cat"', 'class="price"']) {
      expect(html).toContain(hook);
    }
  });

  it('ne rend AUCUN numéro de rang dans le HTML (compteur CSS)', () => {
    expect(html).toMatch(/<td class="rank" aria-hidden="true"><\/td>/);
  });

  it('une fiche EUR affiche l’euro, une one-time n’affiche pas /mo', () => {
    expect(html).toContain('€'); // fiche EUR via Intl
    const rowChunks = html.split('<tr').filter((chunk) => chunk.includes('data-slug="onetime-tool"'));
    expect(rowChunks).toHaveLength(1);
    expect(rowChunks[0]).not.toMatch(/\/mo\b/); // pas de périodicité inventée pour un paiement unique
  });

  it('l’en-tête de prix est neutre', () => {
    expect(html).toContain('>Price</th>');
    expect(html).not.toContain('$/mo');
  });
});
