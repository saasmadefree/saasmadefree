import { describe, it, expect } from 'vitest';
import { renderToolPage } from '../scripts/lib/site-page-tool.mjs';

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
      fileLabel: 'Dossier',
      receivedOn: 'Reçu le',
      instructedOn: 'Instruit le',
      verifiedOn: 'Vérifié le',
      verdictRecordedOn: 'Verdict enregistré le',
      pieceTemplate: 'Pièce {letter}',
      piecesAnnexed: 'Pièces annexées',
      trackingHeading: 'Bordereau de suivi des pièces',
      receiptHeading: 'Récépissé',
      checkedNote: 'coché',
    },
    verdicts: {
      yes: { label: 'Oui', desc: 'Un agent le refait' },
      kinda: { label: 'Presque', desc: 'Une partie se refait' },
      no: { label: 'Non', desc: 'Garde ton abonnement' },
    },
    tool: {
      titleTemplate: 'Un agent peut-il remplacer {name} ? — SaaS Made Free',
      metaDescriptionTemplate: 'Un agent peut-il remplacer {name} ?',
      h1Template: 'Un prompt peut-il remplacer {name} ?',
      verdictHeading: 'Verdict',
      priceHeading: 'Prix relevé',
      priceSourceLabel: 'Source',
      priceCheckedLabel: 'Relevé le',
      yearCostLabel: 'Par an',
      yearCostNote: 'Prix mensuel actuel × 12 — pas une économie garantie.',
      buildTimeLabel: 'Temps de fabrication',
      categoryMetaLabel: 'Catégorie',
      votesMetaLabel: 'Votes',
      whatYouLoseHeading: 'Ce que tu perds',
      whyPeopleStillPayHeadingTemplate: 'Pourquoi certains continuent de payer : {moat}',
      promptHeading: 'Le prompt',
      copyButton: 'Copier le prompt',
      copiedButton: 'Copié',
      copyFailed: 'Copie impossible — sélectionne le texte ci-dessus.',
      openInAgentTemplate: 'Ouvrir dans {name}',
      promptOpenCaption: 'Ouvrir préremplit le prompt — entrée pour le lancer.',
      priorArtHeading: 'Alternatives existantes',
      licenseLabel: 'Licence',
      faqHeading: 'Questions',
      relatedHeading: 'Outils proches',
      voteHeading: 'Tu l’as déjà reconstruit toi-même ?',
      voteButton: 'Enregistrer mon vote',
      voteCountOne: '{count} vote',
      voteCountOther: '{count} votes',
      voteUnavailable: 'Compteur indisponible pour l’instant.',
      voteThanks: 'Merci — ce vote est enregistré.',
      voteAlready: 'Déjà compté depuis ce navigateur aujourd’hui.',
      voteError: 'Service de vote injoignable. Réessaie plus tard.',
      shareOnXLabel: 'Partager sur X',
      shareTextTemplate: 'Un prompt peut-il remplacer {name} ? Verdict : {verdict}.',
    },
  },
  diyTimeEstimate: { weekend: 'un week-end' },
};

const categories = {
  'dev-tools': { emoji: '🛠️', label: { fr: 'Outils pour développeurs' } },
  tasks: { label: { fr: 'Tâches' } },
};

// Un outil complet façon Linear : kinda, 10 USD, checkedOn 2026-07-30,
// 2 priorArt, 4 FAQ, 3 outils proches — buildDate 2026-08-04.
const tool = {
  slug: 'linear',
  name: 'Linear',
  category: 'dev-tools',
  subcategory: 'Issue tracking',
  verdict: 'kinda',
  moatType: 'la collaboration temps réel',
  diyTimeEstimate: 'weekend',
  pricing: {
    amount: 10,
    currency: 'USD',
    basis: 'per-seat-monthly',
    checkedOn: '2026-07-30',
    source: 'https://linear.app/pricing',
  },
  priorArt: [
    { name: 'Plane', url: 'https://github.com/makeplane/plane', license: 'AGPL-3.0' },
    { name: 'Huly', url: 'https://github.com/hcengineering/platform' },
  ],
};

const i18nEntry = {
  verdictSummary: 'Un tracker mono-utilisateur pensé clavier d’abord, c’est un projet de week-end.',
  whyPeopleStillPay: 'Linear vend de la vitesse et un contexte partagé, pas des fonctionnalités.',
  whatYouLose: [
    'Le multi-utilisateur en temps réel.',
    'Les applications natives mobile et desktop.',
    'Les intégrations bidirectionnelles GitHub, Slack, Figma.',
    'Triage, Insights et Linear Asks.',
    'La finition d’interaction.',
  ],
  // Le prompt porte volontairement < > & : l'échappement de TOUTE
  // interpolation fait partie du contrat du gabarit.
  prompt: 'Construis un tracker de tickets <perso> & rapide, pensé clavier d’abord.',
  faq: [
    { q: 'Puis-je importer mes tickets ?', a: 'Export CSV, réconciliation manuelle.' },
    { q: 'Ça marche sur mobile ?', a: 'Navigateur mobile seulement.' },
    { q: 'Combien ça coûte à faire tourner ?', a: 'Quelques dollars par mois.' },
    { q: 'Qu’est-ce qui ne survit pas ?', a: 'Le tableau partagé.' },
  ],
};

const relatedTools = [
  {
    slug: 'todoist', name: 'Todoist', verdict: 'yes', category: 'tasks',
    pricing: { amount: 7, currency: 'USD', basis: 'flat-monthly', checkedOn: '2026-07-30' },
    path: '/fr/tools/todoist',
  },
  {
    slug: 'github-copilot', name: 'GitHub Copilot', verdict: 'kinda', category: 'dev-tools',
    pricing: { amount: 10, currency: 'USD', basis: 'flat-monthly', checkedOn: '2026-07-30' },
    path: '/fr/tools/github-copilot',
  },
  {
    slug: 'cursor', name: 'Cursor', verdict: 'kinda', category: 'dev-tools',
    pricing: { amount: 20, currency: 'USD', basis: 'flat-monthly', checkedOn: '2026-07-30' },
    path: '/fr/tools/cursor',
  },
];

const agents = [
  {
    id: 'claude-web', name: 'Claude Code (web)', status: 'verified', kind: 'url',
    homepage: 'https://claude.ai', template: 'https://claude.ai/new?q={prompt}',
  },
  {
    id: 'cursor-ide', name: 'Cursor', status: 'untested', kind: 'deeplink',
    homepage: 'https://cursor.com', template: 'cursor://prompt?text={prompt}',
  },
];

function renderTool(over = {}) {
  return renderToolPage({
    lang: 'fr',
    path: '/fr/tools/linear',
    tool,
    i18nEntry,
    categories,
    ui,
    alternates: [
      { lang: 'en', path: '/en/tools/linear' },
      { lang: 'fr', path: '/fr/tools/linear' },
    ],
    xDefaultPath: '/en/tools/linear',
    homePath: '/fr/',
    categoryPath: '/fr/categories/dev-tools',
    relatedTools,
    voteCount: 12,
    favicons: { linear: '/assets/favicons/linear.png' },
    agents,
    sponsorSlots: null,
    buildDate: '2026-08-04',
    ...over,
  });
}

const html = renderTool();

describe('renderToolPage — la pièce d’instruction', () => {
  it('ouvre sur la chemise : cote slug, onglet catégorie, dateur, tampon verdict daté', () => {
    expect(html).toContain('SMF·LINEAR'); // cote slug — JAMAIS de n° séquentiel
    expect(html).toContain('class="folder-tab"');
    expect(html).toContain('class="date-ring"');
    expect(html).toContain('30.07.2026'); // dateur = pricing.checkedOn
    expect(html).toContain('04.08.2026'); // tampon verdict = date du build
    expect(html).toContain('Verdict enregistré le 04.08.2026');
  });

  it('ne porte AUCUN numéro séquentiel — l’écart assumé avec la maquette', () => {
    expect(html).not.toMatch(/n°\s*\d|SMF·ANN/);
  });

  it('tamponne le verdict en grand format .badge.badge-lg (crochet site.js intact)', () => {
    expect(html).toContain('class="badge kinda badge-lg"');
  });

  it('porte la cote sur le code-barres de la chemise', () => {
    expect(html).toContain('class="barcode"');
    expect(html).toContain('SMF·LINEAR — Linear');
  });

  it('montre l’échelle complète du verdict, une seule case cochée', () => {
    expect(html.match(/class="check-item/g)).toHaveLength(3);
    // Comptage exact, pas un simple toContain : une seule case doit jamais
    // porter is-checked, jamais deux (bug de calcul de "on" dans verdictChecks).
    expect(html.match(/check-item is-checked/g)).toHaveLength(1);
  });

  it('remplit la cartouche de références : cote, reçu, instruit, pièces, questions', () => {
    expect(html).toContain('class="ref-strip"');
    for (const cell of ['Dossier', 'Reçu le', 'Instruit le', 'Pièces annexées', 'Questions']) {
      expect(html).toContain(cell);
    }
    expect(html).toContain('<dd class="ref-val">3</dd>'); // pièces annexées
    expect(html).toContain('<dd class="ref-val">4</dd>'); // i18nEntry.faq.length
  });

  it('lettre les pièces dans l’ordre du spec §4 : A prompt, B pertes, C pourquoi payer', () => {
    const a = html.indexOf('id="prompt-heading"');
    const b = html.indexOf('id="lose-heading"');
    const c = html.indexOf('id="why-heading"');
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(-1);
    expect(c).toBeGreaterThan(-1);
    expect(a < b && b < c).toBe(true);
  });

  it('déroule le dossier : chemise, bordereau, résumé, pièces, questions, proches, récépissé', () => {
    const order = ['class="folder"', 'class="tracking-slip"', 'class="verdict-summary',
      'id="prompt-heading"', 'id="lose-heading"', 'id="why-heading"',
      'id="faq-heading"', 'id="related-heading"', 'class="receipt-label"'];
    let last = -1;
    for (const marker of order) {
      const at = html.indexOf(marker);
      expect(at, marker).toBeGreaterThan(last);
      last = at;
    }
  });

  it('rend le bordereau de suivi avec une ligne par pièce réellement rendue', () => {
    expect(html).toContain('class="tracking-slip"');
    expect(html.match(/class="pen-check"/g).length).toBeGreaterThanOrEqual(3);
    // La ligne Questions du bordereau renvoie à la section rendue.
    expect(html).toContain('href="#faq-heading"');
  });

  it('garde les crochets JS de la fiche — liste exhaustive', () => {
    for (const hook of [
      'id="copy-prompt"', 'id="prompt-text"', 'id="vote-btn"', 'id="vote-count"',
      'id="vote-status"', 'id="copy-status"', 'class="agent-btn"',
      'data-agent-id="claude-web"', 'data-mode=', 'data-copied-label=', 'data-fail-label=',
      'class="copy-btn"', 'class="vote-count-badge"', 'class="share-x-btn"',
      'data-slug="linear"', 'data-msg-thanks=', 'data-msg-already=', 'data-msg-error=',
      'data-vote-slug="linear"', 'data-lang="fr"', 'data-singular=', 'data-plural=',
      'class="prompt-block"', 'class="status"', 'role="status"', 'aria-live="polite"',
    ]) {
      expect(html).toContain(hook);
    }
  });

  it('ne montre que les agents vérifiés', () => {
    expect(html).not.toContain('cursor-ide');
  });

  it('les renvois croisés ne pointent que vers des ancres présentes', () => {
    const refs = [...html.matchAll(/href="#([a-z-]+)"/g)];
    expect(refs.length).toBeGreaterThan(0);
    for (const m of refs) {
      expect(html, `#${m[1]}`).toContain(`id="${m[1]}"`);
    }
  });

  // Arbitrage design (chore/dossier-post-merge) : la pen-note "Source : <host>"
  // de la chemise a été retirée — redondante avec la légende du prix
  // (price-source) déjà posée dans la même case de la meta-row, sur le même
  // écran. La seule pen-note qui reste est le renvoi du résumé vers la pièce B.
  it('n’annote au stylo que le renvoi vers la pièce B — plus de source en double', () => {
    expect(html.match(/class="pen-note"/g)).toHaveLength(1);
    expect(html).toMatch(/pen-note"><a href="#lose-heading">/);
    expect(html).toContain('linear.app'); // sourceHost, toujours affiché — dans la légende du prix, plus en pen-note
  });

  it('le résumé porte le filet du verdict de la fiche', () => {
    expect(html).toContain('class="verdict-summary kinda"');
  });

  // Le fixture par défaut est en "kinda" : sans ces deux cas, un bug qui ne
  // se déclenche que sur "yes" ou "no" (ex. verdictChecks qui coche la
  // mauvaise case) passerait inaperçu.
  it('couvre le filet du résumé pour un verdict "yes"', () => {
    const yesHtml = renderTool({ tool: { ...tool, verdict: 'yes' } });
    expect(yesHtml).toContain('class="verdict-summary yes"');
    expect(yesHtml.match(/check-item is-checked/g)).toHaveLength(1);
  });

  it('couvre le filet du résumé pour un verdict "no"', () => {
    const noHtml = renderTool({ tool: { ...tool, verdict: 'no' } });
    expect(noHtml).toContain('class="verdict-summary no"');
    expect(noHtml.match(/check-item is-checked/g)).toHaveLength(1);
  });

  it('échappe toute interpolation — le prompt avec < > & reste inoffensif', () => {
    expect(html).toContain('&lt;perso&gt; &amp; rapide');
    expect(html).not.toContain('<perso>');
  });

  it('enveloppe le vote dans le récépissé, étiquette du dossier en tête', () => {
    expect(html).toContain('class="vote-section receipt"');
    expect(html).toContain('Récépissé');
  });

  it('conserve JSON-LD (organization, breadcrumb, faq), alternates et favicon', () => {
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"FAQPage"');
    expect(html).toContain('"BreadcrumbList"');
    expect(html).toContain('hreflang="en"');
    expect(html).toContain('hreflang="x-default"');
    expect(html).toContain('/assets/favicons/linear.png');
  });
});
