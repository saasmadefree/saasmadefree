import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { renderToolPage } from '../scripts/lib/site-page-tool.mjs';
import { formatMonthlyPrice } from '../scripts/lib/site-format.mjs';
import { loadData } from '../scripts/lib/load-data.mjs';
import { sponsorContext, renderSponsorSlots } from '../scripts/lib/site-sponsors.mjs';

// Fiche outil = page « alternatives » (Task A4, spec D1, D7, D9, D14).
// Les chaînes viennent des vrais ui.json : une clé manquante dans une langue
// publiée casse ce test, pas seulement le build.
const uiOf = (lang) => JSON.parse(readFileSync(`data/i18n/${lang}/ui.json`, 'utf8'));
const UI = { en: uiOf('en'), fr: uiOf('fr') };

const categories = {
  newsletter: { label: { en: 'Newsletters & publishing', fr: 'Newsletters et publication' } },
  tasks: { label: { en: 'Tasks', fr: 'Tâches' } },
};

const TODAY = '2026-10-17';

// Quatre alternatives affichables sur cinq citées : une archivée est écartée.
// listmonk : chiffres frais, page projet indexable, et seul projet dont
// « pas d'offre hébergée » et « auto-hébergeable » ont été vérifiés (date et
// source) ; les autres portent les valeurs par défaut de la migration, qui ne
// sont pas des faits (finding 2 de la revue finale) ; mautic : chiffres frais,
// version hébergée ; keila : chiffres périmés (77 jours) ; postal : pas de
// dépôt GitHub, donc pas de chiffres du tout.
const stats = (over) => ({ stars: 1000, lastCommit: '2026-10-01', createdAt: '2019-01-01', archived: false, checkedOn: '2026-10-15', ...over });
const PROJECTS = new Map([
  ['listmonk', {
    slug: 'listmonk', name: 'Listmonk', homepage: 'https://listmonk.app', repo: 'knadh/listmonk', license: 'AGPL-3.0',
    selfHostable: true, selfHostableCheckedOn: '2026-10-12', selfHostableSource: 'https://listmonk.app/docs/installation/',
    hosted: { exists: false, checkedOn: '2026-10-12', source: 'https://listmonk.app' },
    categories: ['newsletter'], stats: stats({ stars: 17000, lastCommit: '2026-10-10' }),
  }],
  ['mautic', {
    slug: 'mautic', name: 'Mautic', homepage: 'https://github.com/mautic/mautic', repo: 'mautic/mautic',
    selfHostable: true, categories: ['newsletter'], stats: stats({ stars: 10787, checkedOn: '2026-10-16' }),
    hosted: { exists: true, priceFrom: 9, currency: 'USD', source: 'https://mautic.example/pricing', checkedOn: '2026-10-01' },
  }],
  ['keila', {
    slug: 'keila', name: 'Keila', homepage: 'https://keila.io', repo: 'pentacent/keila', license: 'AGPL-3.0',
    selfHostable: true, hosted: { exists: false }, categories: ['newsletter'],
    stats: stats({ stars: 1600, lastCommit: '2026-07-20', checkedOn: '2026-08-01' }),
  }],
  ['postal', {
    slug: 'postal', name: 'Postal', homepage: 'https://postalserver.io', repo: null, license: 'MIT',
    selfHostable: true, hosted: { exists: false }, categories: ['newsletter'],
  }],
  ['ghosted', {
    slug: 'ghosted', name: 'Ghosted', homepage: 'https://ghosted.example', repo: 'x/ghosted', license: 'MIT',
    selfHostable: true, hosted: { exists: false }, categories: ['newsletter'], stats: stats({ archived: true }),
  }],
  // Dernier commit il y a plus de 365 jours : cité, mais plus affiché dans n.
  ['oldy', {
    slug: 'oldy', name: 'Oldy', homepage: 'https://oldy.example', repo: 'x/oldy', license: 'MIT',
    selfHostable: true, hosted: { exists: false }, categories: ['newsletter'], stats: stats({ lastCommit: '2025-03-04' }),
  }],
]);

const PROJECT_I18N = new Map([
  ['en/listmonk', { tagline: 'Self-hosted newsletter and mailing list manager.' }],
  ['fr/listmonk', { tagline: 'Gestionnaire de newsletters auto-hébergé.' }],
  ['en/mautic', { tagline: 'Open-source marketing automation.' }],
  ['en/postal', { tagline: 'A mail delivery platform.' }],
]);

const tool = {
  slug: 'mailchimp',
  name: 'Mailchimp',
  category: 'newsletter',
  subcategory: 'email marketing',
  verdict: 'kinda',
  moatType: 'deliverability/compliance/integrations',
  diyTimeEstimate: 'week',
  requirements: ['hosting', 'email-provider'],
  verifiedOneShot: false,
  pricing: {
    amount: 20, currency: 'USD', plan: 'Standard', basis: 'usage-based',
    source: 'https://mailchimp.com/pricing/marketing/', checkedOn: '2026-07-30',
  },
  alternatives: [
    { project: 'listmonk', fit: 'full' },
    { project: 'ghosted', fit: 'full' },
    { project: 'mautic', fit: 'partial' },
    { project: 'keila', fit: 'partial' },
    { project: 'postal', fit: 'niche' },
    { project: 'oldy', fit: 'partial' },
  ],
  relatedSlugs: ['beehiiv', 'todoist', 'kit'],
  markets: ['en', 'fr'],
};

const faq6 = [
  { q: 'Can I import my audience?', a: 'Yes, by CSV.' },
  { q: 'Will it work on my phone?', a: 'In the browser.' },
  { q: 'What does it cost to run?', a: 'A few dollars.' },
  { q: 'What does not survive?', a: 'Sending reputation.' },
  { q: 'What’s the best free Mailchimp alternative?', a: 'Listmonk, for most newsletters.' },
  { q: 'Can I move to Listmonk without losing subscribers?', a: 'Yes, keep the unsubscribed flagged.' },
];

const entryEn = {
  verdictSummary: 'A small-list campaign sender is a real weekend build.',
  coreLoopDIY: 'A contact list with tags, a Markdown composer, and sends through an email API.',
  whatYouLose: ['deliverability', 'the drag-and-drop editor', 'automation journeys'],
  whyPeopleStillPay: 'Email is business-critical, so people pay for inbox placement.',
  notes: 'A classic hidden-moat example.',
  // < > & : l'échappement de TOUTE interpolation fait partie du contrat.
  prompt: 'Build a <small> & fast campaign tool.',
  faq: faq6.slice(0, 4),
};

const entryEnRich = {
  ...entryEn,
  alternativesIntro: 'For most newsletters the best pick is Listmonk: one small server plus a sending API.',
  alternativeNotes: { listmonk: 'Covers campaigns and lists; no visual journeys.' },
  faq: faq6,
};

const entryFr = {
  verdictSummary: 'Un envoyeur de campagnes pour petite liste, c’est un vrai projet de week-end.',
  coreLoopDIY: 'Une liste de contacts, un éditeur Markdown, un envoi par API.',
  whatYouLose: ['la délivrabilité', 'l’éditeur glisser-déposer'],
  whyPeopleStillPay: 'L’email est critique, donc on paie pour arriver en boîte de réception.',
  notes: 'Un fossé caché classique.',
  prompt: 'Construis un outil de campagnes.',
  faq: faq6.slice(0, 4),
};

const relatedTools = [
  { slug: 'beehiiv', name: 'Beehiiv', verdict: 'yes', category: 'newsletter',
    pricing: { amount: 39, currency: 'USD', basis: 'flat-monthly', checkedOn: '2026-07-30' }, path: '/en/tools/beehiiv' },
  { slug: 'todoist', name: 'Todoist', verdict: 'no', category: 'tasks',
    pricing: { amount: 4, currency: 'USD', basis: 'flat-monthly', checkedOn: '2026-07-30' }, path: '/en/tools/todoist' },
  { slug: 'kit', name: 'Kit', verdict: 'kinda', category: 'newsletter',
    pricing: { amount: 25, currency: 'USD', basis: 'flat-monthly', checkedOn: '2026-07-30' }, path: '/en/tools/kit' },
];

const agents = [
  { id: 'claude-web', name: 'Claude Code (web)', status: 'verified', kind: 'url',
    homepage: 'https://claude.ai', template: 'https://claude.ai/new?q={prompt}' },
  { id: 'cursor-ide', name: 'Cursor', status: 'untested', kind: 'deeplink',
    homepage: 'https://cursor.com', template: 'cursor://prompt?text={prompt}' },
];

// Les vrais emplacements vendus du jour, comme au build.
const data = await loadData(process.cwd());
const sponsorSlotsFor = (lang) => renderSponsorSlots(sponsorContext({
  placements: data.sponsors.placements, today: TODAY, lang, ui: UI[lang], favicons: {}, sponsorHref: `/${lang}/sponsor`,
}));

function render(over = {}) {
  const lang = over.lang ?? 'en';
  return renderToolPage({
    lang,
    path: `/${lang}/tools/mailchimp`,
    tool,
    i18nEntry: lang === 'fr' ? entryFr : entryEn,
    categories,
    ui: UI[lang],
    alternates: [{ lang: 'en', path: '/en/tools/mailchimp' }, { lang: 'fr', path: '/fr/tools/mailchimp' }],
    xDefaultPath: '/en/tools/mailchimp',
    homePath: `/${lang}/`,
    categoryPath: `/${lang}/categories/newsletter`,
    relatedTools,
    voteCount: 12,
    favicons: { mailchimp: '/assets/favicons/mailchimp.png' },
    agents,
    sponsorSlots: null,
    buildDate: TODAY,
    projects: PROJECTS,
    projectI18n: PROJECT_I18N,
    today: TODAY,
    projectIndexable: (project) => project.slug === 'listmonk',
    ...over,
  });
}

function dom(html) {
  const win = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  win.document.write(html);
  return win.document;
}

const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const jsonLd = (doc) => [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent));
// Élément de texte vide dans <main>, hors régions live (role="status"),
// vides par nature jusqu'à ce que le script y écrive.
const emptyElements = (h) => [...h.slice(h.indexOf('<main'), h.indexOf('</main>')).matchAll(/<(p|h2|h3|li|span|dd)([^>]*)>\s*<\/\1>/g)]
  .filter((m) => !m[2].includes('role="status"')).map((m) => m[0]);
const section = (doc, id) => doc.querySelector(`section[aria-labelledby="${id}"]`);

const html = render();
const doc = dom(html);
const t = UI.en.site.tool;

// ---------------------------------------------------------------------------
// Step 0 — inventaire D14 « Fiche outil » : un test par élément, chacun rouge
// si son élément manque.
// ---------------------------------------------------------------------------
describe('D14 — zéro perte d’information sur la fiche', () => {
  it('fil d’Ariane annuaire › catégorie › outil, au-dessus de l’eyebrow, plus BreadcrumbList', () => {
    const crumbs = doc.querySelector('nav.crumbs');
    expect(crumbs).not.toBeNull();
    expect([...crumbs.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['/en/', '/en/categories/newsletter']);
    expect(text(crumbs.querySelector('[aria-current="page"]'))).toBe('Mailchimp');
    expect(html.indexOf('class="crumbs"')).toBeLessThan(html.indexOf('class="eyebrow"'));
    const bc = jsonLd(doc).find((d) => d['@type'] === 'BreadcrumbList');
    expect(bc.itemListElement.map((i) => i.name)).toEqual([UI.en.site.directoryLabel, 'Newsletters & publishing', 'Mailchimp']);
  });

  it('catégorie ET sous-catégorie dans l’eyebrow, avec la date de mise à jour', () => {
    const eyebrow = doc.querySelector('.eyebrow');
    expect(eyebrow.querySelector('a').getAttribute('href')).toBe('/en/categories/newsletter');
    expect(text(eyebrow)).toContain('Newsletters & publishing');
    expect(text(eyebrow)).toContain('email marketing');
    expect(text(eyebrow)).toContain(t.lastUpdatedLabel);
  });

  it('favicon de l’outil à côté du H1', () => {
    const img = doc.querySelector('h1 img.tool-favicon');
    expect(img?.getAttribute('src')).toBe('/assets/favicons/mailchimp.png');
    expect(img.getAttribute('alt')).toBe('');
  });

  it('panneau de verdict : verdict, date d’arrêt du verdict (build) et date de relevé du prix', () => {
    const panel = doc.querySelector('.verdict-badge');
    expect(panel.getAttribute('data-verdict')).toBe('kinda');
    expect(text(panel.querySelector('.vb-word'))).toBe('Almost');
    expect(text(panel)).toContain(`${t.verdictRecordedLabel} October 17, 2026`);
    expect(text(panel)).toContain('July 30, 2026');
  });

  it('panneau de verdict : prix, base de facturation, plan, source cliquable et date de vérification', () => {
    const price = doc.querySelector('.verdict-badge .vb-price');
    expect(text(price)).toContain('$20/mo');
    expect(text(price)).toContain(UI.en.pricingBasis['usage-based']);
    expect(text(price)).toContain('Standard');
    const source = price.querySelector('a');
    expect(source.getAttribute('href')).toBe('https://mailchimp.com/pricing/marketing/');
    expect(text(source)).toBe('mailchimp.com');
    expect(text(price)).toContain(`${t.priceCheckedLabel} July 30, 2026`);
  });

  it('coût annuel sous le prix, seulement pour un prix mensuel récurrent', () => {
    const panel = doc.querySelector('.verdict-badge');
    expect(text(panel)).toContain(t.yearCostLabel);
    expect(text(panel)).toContain('$240');
    const oneTime = dom(render({ tool: { ...tool, pricing: { ...tool.pricing, basis: 'one-time' } } }));
    expect(text(oneTime.querySelector('.verdict-badge'))).not.toContain(t.yearCostLabel);
  });

  it('légende repliable « How we judge » : les trois verdicts, le courant marqué par le texte', () => {
    const legend = doc.querySelector('details.verdict-legend');
    expect(legend).not.toBeNull();
    expect(legend.hasAttribute('open')).toBe(false);
    expect(text(legend.querySelector('summary'))).toBe(t.howWeJudge);
    const items = legend.querySelectorAll('li');
    expect(items).toHaveLength(3);
    for (const v of ['yes', 'kinda', 'no']) expect(text(legend)).toContain(UI.en.site.verdicts[v].desc);
    const current = legend.querySelectorAll('li[aria-current="true"]');
    expect(current).toHaveLength(1);
    expect(current[0].querySelector('.badge.kinda')).not.toBeNull();
    expect(text(current[0])).toContain(t.currentVerdictNote);
    // La légende vit sous le panneau, pas ailleurs dans la page.
    expect(html.indexOf('verdict-legend')).toBeGreaterThan(html.indexOf('class="verdict-badge"'));
  });

  it('verdictSummary en lede quand la fiche n’a pas encore d’intro d’alternatives', () => {
    expect(text(doc.querySelector('.page-head .lede'))).toBe(entryEn.verdictSummary);
  });

  it('verdictSummary reste affiché quand l’intro d’alternatives prend le lede', () => {
    const rich = dom(render({ i18nEntry: entryEnRich }));
    expect(text(rich.querySelector('.page-head .lede'))).toBe(entryEnRich.alternativesIntro);
    expect(text(section(rich, 'prompt-heading'))).toContain(entryEn.verdictSummary);
  });

  it('bloc « Build it yourself » : temps DIY, prérequis, verifiedOneShot, coreLoopDIY', () => {
    const build = text(section(doc, 'prompt-heading'));
    expect(build).toContain(t.buildTimeLabel);
    expect(build).toContain(UI.en.diyTimeEstimate.week);
    expect(build).toContain(t.requirementsLabel);
    expect(build).toContain(UI.en.requirements.hosting);
    expect(build).toContain(UI.en.requirements['email-provider']);
    expect(build).toContain(t.oneShotLabel);
    expect(build).toContain(t.oneShotNo);
    expect(build).toContain(entryEn.coreLoopDIY);
    const tested = text(section(dom(render({ tool: { ...tool, verifiedOneShot: true } })), 'prompt-heading'));
    expect(tested).toContain(t.oneShotYes);
  });

  it('bloc « Build it yourself » : prompt, Copier, boutons des agents vérifiés, prompt brut, légende', () => {
    const build = section(doc, 'prompt-heading');
    expect(build.querySelector('#prompt-text')).not.toBeNull();
    expect(build.querySelector('#copy-prompt')).not.toBeNull();
    const agentsBtns = build.querySelectorAll('.agent-btn');
    expect(agentsBtns).toHaveLength(1);
    expect(agentsBtns[0].getAttribute('data-agent-id')).toBe('claude-web');
    expect(agentsBtns[0].getAttribute('href')).toContain('https://claude.ai/new?q=');
    expect(build.querySelector('a[href="/feed/v1/en/prompts/mailchimp.txt"]')).not.toBeNull();
    expect(text(build)).toContain(t.promptOpenCaption);
  });

  it('section « What you lose » : chaque perte', () => {
    const lose = text(section(doc, 'lose-heading'));
    for (const item of entryEn.whatYouLose) expect(lose).toContain(item);
  });

  it('section « Why people still pay » : le texte, le moatType en libellé, les notes', () => {
    const why = section(doc, 'why-heading');
    expect(text(why)).toContain(entryEn.whyPeopleStillPay);
    expect(text(why)).toContain(tool.moatType);
    expect(text(why)).toContain(entryEn.notes);
    // Pas de paragraphe vide quand la fiche n'a pas de notes.
    const noNotes = render({ i18nEntry: { ...entryEn, notes: undefined } });
    expect(noNotes).not.toContain('undefined');
    expect(section(dom(noNotes), 'why-heading').querySelector('.quote-note')).toBeNull();
  });

  it('FAQ : 4 entrées rendues telles quelles', () => {
    const faq = section(doc, 'faq-heading');
    expect(faq.querySelectorAll('details')).toHaveLength(4);
    expect(jsonLd(doc).find((d) => d['@type'] === 'FAQPage').mainEntity).toHaveLength(4);
  });

  it('chaque alternative citée par la fiche apparaît quelque part sur la page (Ruling 19)', () => {
    const main = text(doc.querySelector('main'));
    for (const { project: slug } of tool.alternatives) expect(main, slug).toContain(PROJECTS.get(slug).name);
  });

  it('alternatives existantes : tableau et fiches projet', () => {
    const alt = section(doc, 'alternatives-heading');
    expect(alt.querySelector('table.alt-table')).not.toBeNull();
    expect(alt.querySelectorAll('article.alt-card')).toHaveLength(4);
  });

  it('vote : compteur, bouton (merci / déjà voté / erreur), partage sur X, entre FAQ et fin ; compteur aussi au panneau', () => {
    const vote = section(doc, 'vote-heading');
    const btn = vote.querySelector('#vote-btn');
    for (const attr of ['data-msg-thanks', 'data-msg-already', 'data-msg-error']) expect(btn.getAttribute(attr)).toBeTruthy();
    expect(text(vote.querySelector('#vote-count'))).toContain('12 votes');
    expect(text(vote.querySelector('#vote-heading'))).toBe(t.voteHeading);
    expect(vote.querySelector('a.share-x-btn').getAttribute('href')).toMatch(/^https:\/\/twitter\.com\/intent\/tweet\?/);
    expect(html.indexOf('id="vote-heading"')).toBeGreaterThan(html.indexOf('id="faq-heading"'));
    const facts = [...doc.querySelectorAll('.verdict-badge dl div')].map((d) => [text(d.querySelector('dt')), text(d.querySelector('dd'))]);
    expect(facts).toContainEqual([t.votesMetaLabel, '12 votes']);
  });

  it('outils liés : les trois, avec leur verdict, après la FAQ', () => {
    const related = section(doc, 'related-heading');
    const cards = related.querySelectorAll('.related-card');
    expect(cards).toHaveLength(3);
    expect(related.querySelector('.badge.yes')).not.toBeNull();
    expect(related.querySelector('.badge.no')).not.toBeNull();
    expect(related.querySelector('.badge.kinda')).not.toBeNull();
    expect(html.indexOf('id="related-heading"')).toBeGreaterThan(html.indexOf('id="faq-heading"'));
  });

  it('emplacements vendus de la fiche : mêmes rails, bandeau et repli, sans le mot « Sponsor »', () => {
    const slots = sponsorSlotsFor('en');
    const withSlots = render({ sponsorSlots: slots });
    for (const part of ['railLeft', 'railRight', 'tapeBottom', 'fallback']) {
      if (slots[part]) expect(withSlots, part).toContain(slots[part]);
    }
    expect(withSlots).toContain('class="shell has-rails"');
    const body = withSlots.slice(withSlots.indexOf('<main'), withSlots.indexOf('</main>'));
    expect(body).not.toMatch(/sponsor/i);
    for (const part of Object.values(slots)) expect(part).not.toMatch(/>\s*Sponsors?\s*</);
  });

  it('sélecteur de langue dans l’en-tête et hreflang', () => {
    const sw = doc.querySelector('header.site-header nav.lang-switch');
    expect(sw.querySelector('a[hreflang="fr"]').getAttribute('href')).toBe('/fr/tools/mailchimp');
    expect(doc.querySelector('link[rel="alternate"][hreflang="fr"]')).not.toBeNull();
    expect(doc.querySelector('link[rel="alternate"][hreflang="x-default"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Step 2 — le gabarit « alternatives »
// ---------------------------------------------------------------------------
describe('fiche « alternatives » — titre, description, tableau', () => {
  it('title uses n verified alternatives and build year', () => {
    expect(html).toContain('<title>4 Free &amp; Open Source Mailchimp Alternatives (2026) — or Build Your Own</title>');
    expect(text(doc.querySelector('h1'))).toBe('4 free alternatives to Mailchimp');
    expect(doc.querySelector('h1 .hand-underline')?.textContent).toBe('Mailchimp');
  });

  it('fallback title when fewer than 3, and the page stays indexable (no robots tag)', () => {
    const few = render({ tool: { ...tool, alternatives: tool.alternatives.slice(0, 3) } }); // listmonk + mautic
    expect(few).toContain('<title>Free Mailchimp Alternatives (2026): Self-Host or Build Your Own</title>');
    expect(text(dom(few).querySelector('h1'))).toBe('Free alternatives to Mailchimp');
    expect(few).not.toMatch(/<meta name="robots"/);
    expect(html).not.toMatch(/<meta name="robots"/);
  });

  it('fallback title in French too, from ui.json', () => {
    const fr = render({ lang: 'fr', tool: { ...tool, alternatives: tool.alternatives.slice(0, 3) } });
    const expected = UI.fr.site.tool.titleFallbackTemplate.replace('{name}', 'Mailchimp').replace('{year}', '2026');
    expect(text(dom(fr).querySelector('title'))).toBe(expected);
  });

  // n = 0 : rien à auto-héberger, le titre ne le promet pas (finding 11).
  it('zero alternatives: its own title and meta description, without "Self-Host"', () => {
    const none = dom(render({ tool: { ...tool, alternatives: [] } }));
    expect(text(none.querySelector('title'))).toBe('Free Mailchimp Alternative (2026): Build Your Own with One Prompt');
    expect(text(none.querySelector('title'))).not.toMatch(/self-host/i);
    const desc = none.querySelector('meta[name="description"]').getAttribute('content');
    expect(desc).toBe(t.metaDescriptionNoAltTemplate.replace('{name}', 'Mailchimp').replace('{build}', 'a week').replace('{price}', '$20/mo'));
    expect(desc).not.toMatch(/self-host/i);
    // Une seule alternative affichable : le repli habituel, pas celui de n = 0.
    const one = dom(render({ tool: { ...tool, alternatives: tool.alternatives.slice(0, 1) } }));
    expect(text(one.querySelector('title'))).toBe('Free Mailchimp Alternatives (2026): Self-Host or Build Your Own');
  });

  it('zero alternatives in French: titre et description de n = 0, depuis ui.json', () => {
    const fr = dom(render({ lang: 'fr', tool: { ...tool, alternatives: [] } }));
    const tf = UI.fr.site.tool;
    expect(text(fr.querySelector('title'))).toBe(tf.titleNoAltTemplate.replace('{name}', 'Mailchimp').replace('{year}', '2026'));
    expect(fr.querySelector('meta[name="description"]').getAttribute('content'))
      .toBe(tf.metaDescriptionNoAltTemplate.replace('{name}', 'Mailchimp').replace('{build}', 'une semaine').replace('{price}', formatMonthlyPrice(tool.pricing, 'fr')));
    expect(tf.titleNoAltTemplate).not.toMatch(/auto-héberge/);
  });

  it('meta description names top 3 alternatives in order', () => {
    const desc = doc.querySelector('meta[name="description"]').getAttribute('content');
    expect(desc).toBe('4 free Mailchimp alternatives, compared: Listmonk, Mautic, and Keila. Self-host one, '
      + 'build your own with a ready prompt (a week), or see why people keep paying $20/mo.');
  });

  it('alternatives table has one row per displayable project plus build row plus keep-paying row', () => {
    const rows = section(doc, 'alternatives-heading').querySelectorAll('table.alt-table tbody tr');
    expect(rows).toHaveLength(6);
    const heads = [...rows].map((r) => text(r.querySelector('th')));
    expect(heads.slice(0, 4)).toEqual(['Listmonk', 'Mautic', 'Keila', 'Postal']);
    expect(heads[4]).toBe(t.buildRowLabel);
    expect(heads[5]).toBe('Keep paying Mailchimp');
    expect(rows[4].classList.contains('other-first')).toBe(true);
    expect(rows[5].classList.contains('other')).toBe(true);
    expect(rows[4].querySelector('a[href="#prompt-heading"]')).not.toBeNull();
  });

  it('links a project to /{lang}/oss/{slug} only when indexable, else to its homepage in nofollow', () => {
    const rows = section(doc, 'alternatives-heading').querySelectorAll('table.alt-table tbody tr');
    const listmonk = rows[0].querySelector('th a');
    expect(listmonk.getAttribute('href')).toBe('/en/oss/listmonk');
    expect(listmonk.getAttribute('rel')).toBeNull();
    const keila = rows[2].querySelector('th a');
    expect(keila.getAttribute('href')).toBe('https://keila.io');
    expect(keila.getAttribute('rel')).toBe('nofollow noopener');
    // Aucune page projet n'existe encore (Task A5) : sans fonction, tout va au site.
    const noPages = dom(render({ projectIndexable: undefined }));
    expect(noPages.querySelector('a[href^="/en/oss/"]')).toBeNull();
  });

  it('fit is a shape plus a word, never colour alone', () => {
    const rows = section(doc, 'alternatives-heading').querySelectorAll('table.alt-table tbody tr');
    const fit = rows[0].querySelector('.fit-tag');
    expect(fit.getAttribute('data-fit')).toBe('full');
    expect(text(fit)).toBe(t.fitLabels.full);
    expect(text(rows[3].querySelector('.fit-tag'))).toBe(t.fitLabels.niche);
    // La ligne « le construire » porte le verdict de la fiche (forme + mot).
    expect(rows[4].querySelector('.badge.kinda')).not.toBeNull();
  });

  it('hides stars and last commit when stats are stale', () => {
    const rows = section(doc, 'alternatives-heading').querySelectorAll('table.alt-table tbody tr');
    const keilaNums = rows[2].querySelectorAll('td.num');
    expect(keilaNums).toHaveLength(2);
    const asOf = t.statsAsOf.replace('{date}', 'August 1, 2026');
    for (const cell of keilaNums) {
      expect(text(cell)).toBe('—');
      expect(cell.querySelector('[title]').getAttribute('title')).toBe(asOf);
    }
    expect([...rows[2].querySelectorAll('td.num')].map(text)).not.toContain('0');
    // Pas de dépôt GitHub : pas de chiffre non plus, jamais un zéro.
    for (const cell of rows[3].querySelectorAll('td.num')) expect(text(cell)).toBe('—');
    // Chiffres frais : affichés.
    expect(text(rows[0].querySelectorAll('td.num')[0])).toBe('17K');
    expect(text(rows[0].querySelectorAll('td.num')[1])).toBe('Oct 2026');
  });

  it('shows the GitHub figures date under the table', () => {
    expect(text(section(doc, 'alternatives-heading'))).toContain(t.statsAsOf.replace('{date}', 'October 16, 2026'));
  });

  it('licence, self-hosting and hosted price, absent values shown absent', () => {
    const rows = section(doc, 'alternatives-heading').querySelectorAll('table.alt-table tbody tr');
    const cells = (r) => [...r.querySelectorAll('td')].map(text);
    expect(cells(rows[0])[1]).toBe('AGPL-3.0');
    expect(cells(rows[1])[1]).toBe('—'); // mautic : licence inconnue
    expect(cells(rows[0])[4]).toBe(t.selfHostYes);
    expect(cells(rows[0])[5]).toContain(t.hostedNone);
    expect(cells(rows[1])[5]).toContain(t.hostedFromTemplate.replace('{price}', '$9'));
    expect(cells(rows[5])[5]).toContain('$20/mo');
  });

  // Finding 2 : selfHostable: true et hosted: {exists: false} ont été écrits
  // par la migration sur tous les projets, sans source. Non vérifiés, ce sont
  // des tirets titrés « pas encore vérifié », jamais « Oui » ni « Aucune ».
  it('unchecked self-hosting and hosted values are a titled dash, checked ones are values', () => {
    const rows = section(doc, 'alternatives-heading').querySelectorAll('table.alt-table tbody tr');
    const td = (r, i) => r.querySelectorAll('td')[i];
    for (const row of [rows[2], rows[3]]) { // keila, postal : valeurs par défaut
      for (const i of [4, 5]) {
        expect(text(td(row, i))).toBe('—');
        expect(td(row, i).querySelector('[title]').getAttribute('title')).toBe(t.notCheckedYet);
      }
    }
    expect(text(td(rows[1], 4))).toBe('—'); // mautic : offre hébergée vérifiée, auto-hébergement non
    // listmonk, vérifié : la valeur et sa date.
    expect(text(td(rows[0], 4))).toBe(t.selfHostYes);
    expect(text(td(rows[0], 5))).toContain(t.checkedOnTemplate.replace('{date}', 'October 12, 2026'));
    // « None » n'apparaît qu'une fois : sur la seule absence vérifiée.
    const hostedCells = [...rows].map((r) => td(r, 5)).filter((cell) => cell.firstChild?.textContent === t.hostedNone);
    expect(hostedCells).toHaveLength(1);
  });

  it('renders project tagline in en with lang attr when fr text missing', () => {
    const fr = dom(render({ lang: 'fr' }));
    const cards = fr.querySelectorAll('article.alt-card');
    expect(text(cards[0].querySelector('.alt-card-what'))).toBe('Gestionnaire de newsletters auto-hébergé.');
    expect(cards[0].querySelector('[lang="en"]')).toBeNull();
    const mautic = cards[1].querySelector('span[lang="en"]');
    expect(text(mautic)).toBe('Open-source marketing automation.');
    // Ni fr ni en : aucune ligne de tagline, la fiche projet reste avec son nom.
    expect(text(cards[2].querySelector('h3'))).toBe('Keila');
    expect(cards[2].querySelector('.alt-card-what')).toBeNull();
  });

  it('alternative notes and intro when the content exists, nothing empty when it does not', () => {
    const rich = dom(render({ i18nEntry: entryEnRich }));
    expect(text(rich.querySelector('#alt-listmonk'))).toContain(entryEnRich.alternativeNotes.listmonk);
    expect(rich.querySelector('#alt-mautic .alt-card-note')).toBeNull();
    expect(html).not.toContain('undefined');
    expect(emptyElements(html)).toEqual([]);
  });

  it('zero alternatives: fallback title, a plain note, build and keep-paying rows, no cards, no ItemList', () => {
    const none = render({ tool: { ...tool, alternatives: [] } });
    const d = dom(none);
    const alt = section(d, 'alternatives-heading');
    expect(text(alt)).toContain(t.noAlternatives.replace('{name}', 'Mailchimp'));
    expect(alt.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(alt.querySelectorAll('article.alt-card')).toHaveLength(0);
    expect(jsonLd(d).some((x) => x['@type'] === 'ItemList')).toBe(false);
    expect(none).not.toContain('undefined');
    expect(emptyElements(none)).toEqual([]);
  });

  it('inactive projects stay listed with their status, outside n and the table', () => {
    const alt = section(doc, 'alternatives-heading');
    const line = alt.querySelector('.inactive-projects');
    expect(line).not.toBeNull();
    expect(text(line)).toContain(t.inactiveProjectsLabel);
    expect(text(line)).toContain(`Ghosted (${t.inactiveArchived})`);
    expect(text(line)).toContain(`Oldy (${t.inactiveLastCommitTemplate.replace('{date}', 'Mar 2025')})`);
    const links = [...line.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://ghosted.example', 'https://oldy.example']);
    for (const a of links) expect(a.getAttribute('rel')).toBe('nofollow noopener');
    // Après les fiches projet, avant le bloc « le construire ».
    expect(html.indexOf('inactive-projects')).toBeGreaterThan(html.lastIndexOf('class="alt-card"'));
    expect(html.indexOf('inactive-projects')).toBeLessThan(html.indexOf('id="prompt-heading"'));
    // Hors n, hors tableau, hors ItemList, hors titre.
    expect(text(alt.querySelector('table'))).not.toMatch(/Ghosted|Oldy/);
    expect(alt.querySelectorAll('article.alt-card')).toHaveLength(4);
    const list = jsonLd(doc).find((d) => d['@type'] === 'ItemList');
    expect(list.itemListElement.map((i) => i.item.name)).not.toContain('Oldy');
    expect(text(doc.querySelector('title'))).toMatch(/^4 /);
  });

  it('no inactive line when none', () => {
    const clean = render({ tool: { ...tool, alternatives: tool.alternatives.filter((a) => !['ghosted', 'oldy'].includes(a.project)) } });
    expect(clean).not.toContain('inactive-projects');
  });

  it('inactive line in French, with French typography', () => {
    const fr = dom(render({ lang: 'fr' }));
    const line = text(fr.querySelector('.inactive-projects'));
    expect(line).toContain(UI.fr.site.tool.inactiveProjectsLabel);
    expect(line).toContain(`Ghosted (${UI.fr.site.tool.inactiveArchived})`);
    expect(text(fr.querySelector('.vb-price'))).toContain('Source : mailchimp.com');
  });

  it('the table scrolls in its own frame, labelled, focusable', () => {
    const frame = section(doc, 'alternatives-heading').querySelector('.table-scroll');
    expect(frame.getAttribute('role')).toBe('region');
    expect(frame.getAttribute('tabindex')).toBe('0');
    const label = frame.getAttribute('aria-labelledby');
    expect(doc.getElementById(label)).not.toBeNull();
  });

  it('sections follow spec D9 order', () => {
    const ids = ['alternatives-heading', 'prompt-heading', 'lose-heading', 'why-heading', 'faq-heading'];
    const at = ids.map((id) => html.indexOf(`id="${id}"`));
    expect(at.every((i) => i > -1)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('json-ld includes ItemList of SoftwareApplication and WebPage.dateModified', () => {
    const blocks = jsonLd(doc);
    const list = blocks.find((d) => d['@type'] === 'ItemList');
    expect(list.itemListElement.map((i) => i.item.name)).toEqual(['Listmonk', 'Mautic', 'Keila', 'Postal']);
    expect(list.itemListElement[0].item.url).toBe('https://saasmadefree.com/en/oss/listmonk');
    expect(list.itemListElement[2].item.url).toBe('https://keila.io');
    expect(list.itemListElement[1].item.offers).toBeUndefined(); // version hébergée payante
    expect(list.itemListElement[0].item.offers.price).toBe(0); // « pas d'offre hébergée » vérifié
    // keila, postal : hosted.exists false par défaut, jamais vérifié — pas d'offre gratuite affirmée.
    expect(list.itemListElement[2].item.offers).toBeUndefined();
    expect(list.itemListElement[3].item.offers).toBeUndefined();
    const page = blocks.find((d) => d['@type'] === 'WebPage');
    // max(pricing 2026-07-30, stats.checkedOn des projets affichés 10-15, 10-16, 08-01)
    expect(page.dateModified).toBe('2026-10-16');
    expect(doc.querySelector('.eyebrow time').getAttribute('datetime')).toBe('2026-10-16');
  });

  it('faq renders 6 entries and FAQPage has 6 questions', () => {
    const rich = dom(render({ i18nEntry: entryEnRich }));
    expect(section(rich, 'faq-heading').querySelectorAll('details')).toHaveLength(6);
    expect(jsonLd(rich).find((d) => d['@type'] === 'FAQPage').mainEntity).toHaveLength(6);
  });
});

describe('fiche « alternatives » — invariants conservés', () => {
  it('garde les crochets JS de la fiche — liste exhaustive', () => {
    for (const hook of [
      'id="copy-prompt"', 'id="prompt-text"', 'id="vote-btn"', 'id="vote-count"',
      'id="vote-status"', 'id="copy-status"', 'class="agent-btn"',
      'data-agent-id="claude-web"', 'data-mode=', 'data-copied-label=', 'data-fail-label=',
      'class="copy-btn"', 'class="vote-count-badge"', 'class="share-x-btn"',
      'data-slug="mailchimp"', 'data-msg-thanks=', 'data-msg-already=', 'data-msg-error=',
      'data-vote-slug="mailchimp"', 'data-lang="en"', 'data-singular=', 'data-plural=',
      'class="prompt-block"', 'class="status"', 'role="status"', 'aria-live="polite"',
    ]) {
      expect(html).toContain(hook);
    }
  });

  it('ne montre que les agents vérifiés', () => {
    expect(html).not.toContain('cursor-ide');
  });

  it('les renvois internes ne pointent que vers des ancres présentes', () => {
    const refs = [...html.matchAll(/href="#([a-z0-9-]+)"/g)];
    expect(refs.length).toBeGreaterThan(0);
    for (const m of refs) expect(html, `#${m[1]}`).toContain(`id="${m[1]}"`);
  });

  it('un seul h1, et plus aucun reste du dossier', () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    for (const gone of ['folder', 'tracking-slip', 'piece-tab', 'pen-check', 'receipt', 'SMF·', 'priorart', 'ref-strip']) {
      expect(html, gone).not.toContain(gone);
    }
  });

  it('le verdict du panneau suit la fiche pour "yes" et "no"', () => {
    for (const v of ['yes', 'no']) {
      const d = dom(render({ tool: { ...tool, verdict: v } }));
      expect(d.querySelector('.verdict-badge').getAttribute('data-verdict')).toBe(v);
      expect(d.querySelectorAll('details.verdict-legend li[aria-current="true"] .badge.' + v)).toHaveLength(1);
    }
  });

  it('échappe toute interpolation — le prompt avec < > & reste inoffensif', () => {
    expect(html).toContain('&lt;small&gt; &amp; fast');
    expect(html).not.toContain('<small>');
  });

  it('échappe < & " dans le nom de l’outil, d’un projet, son accroche et sa note — HTML et JSON-LD', () => {
    const evil = '<b>x</b> & "q"';
    const projects = new Map(PROJECTS);
    projects.set('listmonk', { ...PROJECTS.get('listmonk'), name: `L${evil}` });
    const html2 = render({
      tool: { ...tool, name: `M${evil}` },
      projects,
      projectI18n: new Map([...PROJECT_I18N, ['en/listmonk', { tagline: `T${evil}` }]]),
      i18nEntry: { ...entryEnRich, alternativeNotes: { listmonk: `N${evil}` } },
    });
    expect(html2).not.toContain('<b>');
    for (const prefix of ['M', 'L', 'T', 'N']) expect(html2, prefix).toContain(`${prefix}&lt;b&gt;x&lt;/b&gt; &amp; &quot;q&quot;`);
    const blocks = jsonLd(dom(html2));
    const list = blocks.find((d) => d['@type'] === 'ItemList');
    expect(list.itemListElement[0].item.name).toBe(`L${evil}`);
    expect(blocks.find((d) => d['@type'] === 'BreadcrumbList').itemListElement[2].name).toBe(`M${evil}`);
    // Dans le bloc brut, aucun < n'apparaît en clair : pas de </script> possible.
    const raw = [...html2.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('');
    expect(raw).not.toContain('<');
  });

  it('page française : tutoiement des clés, liens et prompt brut dans la langue', () => {
    const fr = dom(render({ lang: 'fr' }));
    expect(fr.documentElement.getAttribute('lang')).toBe('fr');
    expect(fr.querySelector('a[href="/feed/v1/fr/prompts/mailchimp.txt"]')).not.toBeNull();
    expect(text(fr.querySelector('.verdict-badge .vb-word'))).toBe('Presque');
    expect(fr.querySelector('a[href="/fr/oss/listmonk"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Task A7, Step 4 — « People also look for alternatives to… »
// ---------------------------------------------------------------------------
describe('fiche — People also look for alternatives to…', () => {
  const popular = Array.from({ length: 12 }, (_, i) => ({ slug: `p${i}`, name: `Popular ${i}`, path: `/en/tools/p${i}` }));

  it('renders after Related tools, one link per tool, 12 tools', () => {
    const h = render({ popularTools: popular });
    const d = dom(h);
    const sec = section(d, 'popular-heading');
    expect(text(sec.querySelector('h2'))).toBe(t.popularHeading);
    const links = [...sec.querySelectorAll('ul.link-cloud a')];
    expect(links).toHaveLength(12);
    expect(links[0].getAttribute('href')).toBe('/en/tools/p0');
    expect(text(links[0])).toBe('Popular 0');
    expect(h.indexOf('id="popular-heading"')).toBeGreaterThan(h.indexOf('id="related-heading"'));
  });

  it('nothing at all without popular tools', () => {
    expect(html).not.toContain('popular-heading');
  });

  it('never links the current tool, even if passed', () => {
    const d = dom(render({ popularTools: [{ slug: 'mailchimp', name: 'Mailchimp', path: '/en/tools/mailchimp' }, ...popular.slice(0, 2)] }));
    expect([...section(d, 'popular-heading').querySelectorAll('a')].map((a) => a.getAttribute('href')))
      .toEqual(['/en/tools/p0', '/en/tools/p1']);
  });

  it('French heading', () => {
    const d = dom(render({ lang: 'fr', popularTools: popular }));
    expect(text(section(d, 'popular-heading').querySelector('h2'))).toBe('On cherche aussi des alternatives à…');
  });
});

// Ruling 34 : le pied de page ne lie une collection que si build-site l'a
// déclarée indexable dans la langue (collectionPlan) — et toujours le hub.
describe('Ruling 34 — liens de collection du pied de page', () => {
  const footer = (page) => page.slice(page.indexOf('<footer'), page.indexOf('</footer>'));
  it('self-hosted noindex : aucun lien ; indexable : lié ; build-tonight lié s’il est indexable', () => {
    const off = footer(render({ collectionLinks: ['build-tonight'] }));
    expect(off).not.toContain('/collections/self-hosted');
    expect(off).toContain('/collections/build-tonight');
    expect(off).toContain('/alternatives/"');
    const on = footer(render({ collectionLinks: ['self-hosted', 'build-tonight'] }));
    expect(on).toContain('/collections/self-hosted');
    expect(on).toContain('/collections/build-tonight');
  });
});

// Ruling 44 : n8n, PLANKA ou Notifuse se lisent et s'auto-hébergent, mais leur
// licence n'est pas open source. La page le dit à côté de la licence, et le
// titre ne compte dans « Open Source » que les licences libres.
describe('Ruling 44 — nature de la licence', () => {
  const SOURCE = 'https://example.org/LICENSE';
  /** PROJECTS, avec une nature de licence posée sur certains slugs. */
  const withKinds = (kinds) => new Map([...PROJECTS].map(([slug, p]) => [slug, kinds[slug]
    ? { ...p, license: p.license ?? 'Custom', licenseKind: kinds[slug], licenseSource: SOURCE }
    : p]));
  const titleOf = (d) => text(d.querySelector('title'));

  it('une alternative fair-code : hors du compte « Open Source », dans le h1', () => {
    const d = dom(render({ projects: withKinds({ keila: 'fair-code' }) }));
    expect(titleOf(d)).toBe('3 Free & Open Source Mailchimp Alternatives (2026) — or Build Your Own');
    expect(text(d.querySelector('h1'))).toBe('4 free alternatives to Mailchimp');
  });

  it('open-core compte comme open source', () => {
    const d = dom(render({ projects: withKinds({ listmonk: 'open-core', mautic: 'open-core' }) }));
    expect(titleOf(d)).toBe('4 Free & Open Source Mailchimp Alternatives (2026) — or Build Your Own');
  });

  it('n ≥ 3 mais moins de 3 open source : titre chiffré sur n, sans « Open Source »', () => {
    const d = dom(render({ projects: withKinds({ keila: 'source-available', postal: 'fair-code' }) }));
    expect(titleOf(d)).toBe('4 Free Mailchimp Alternatives (2026): Self-Host One or Build Your Own');
    expect(titleOf(d)).not.toMatch(/open source/i);
  });

  it('liste entièrement source-available : jamais « Open Source » dans le titre (en et fr)', () => {
    const all = withKinds({ listmonk: 'source-available', mautic: 'source-available', keila: 'source-available', postal: 'fair-code' });
    const en = dom(render({ projects: all }));
    expect(titleOf(en)).toBe(t.titleNotOpenTemplate.replace('{n}', '4').replace('{name}', 'Mailchimp').replace('{year}', '2026'));
    expect(titleOf(en)).not.toMatch(/open source/i);
    const fr = dom(render({ lang: 'fr', projects: all }));
    const tf = UI.fr.site.tool;
    expect(titleOf(fr)).toBe(tf.titleNotOpenTemplate.replace('{n}', '4').replace('{name}', 'Mailchimp').replace('{year}', '2026'));
    expect(titleOf(fr)).not.toMatch(/open source/i);
  });

  it('moins de 3 alternatives, toutes source-available : le repli habituel, sans « Open Source »', () => {
    const few = dom(render({
      tool: { ...tool, alternatives: tool.alternatives.slice(0, 3) },
      projects: withKinds({ listmonk: 'source-available', mautic: 'source-available' }),
    }));
    expect(titleOf(few)).toBe('Free Mailchimp Alternatives (2026): Self-Host or Build Your Own');
  });

  it('tableau et fiche projet : la nature à côté de la licence, avec son explication en title', () => {
    const d = dom(render({ projects: withKinds({ listmonk: 'fair-code', keila: 'open-source' }) }));
    const rows = section(d, 'alternatives-heading').querySelectorAll('table.alt-table tbody tr');
    const cell = rows[0].querySelectorAll('td')[1];
    expect(text(cell)).toBe('AGPL-3.0 Fair-code');
    const tag = cell.querySelector('.license-kind');
    expect(tag.getAttribute('data-kind')).toBe('fair-code');
    expect(tag.getAttribute('title')).toBe(t.licenseKindNotes['fair-code']);
    // open-source : le nom seul, rien à signaler.
    expect(text(rows[2].querySelectorAll('td')[1])).toBe('AGPL-3.0');
    expect(rows[2].querySelector('.license-kind')).toBeNull();
    const card = d.querySelector('#alt-listmonk .alt-card-meta .license-kind');
    expect(text(card)).toBe(t.licenseKindLabels['fair-code']);
    expect(d.querySelector('#alt-keila .license-kind')).toBeNull();
  });

  it('libellés et explications en français', () => {
    const d = dom(render({ lang: 'fr', projects: withKinds({ listmonk: 'source-available', keila: 'open-core' }) }));
    const tf = UI.fr.site.tool;
    const tags = [...section(d, 'alternatives-heading').querySelectorAll('table.alt-table .license-kind')];
    expect(tags.map(text)).toEqual(['Source disponible', 'Open-core']);
    expect(tags.map((el) => el.getAttribute('title'))).toEqual([tf.licenseKindNotes['source-available'], tf.licenseKindNotes['open-core']]);
  });

  it('JSON-LD : rien n’y affirme « open source »', () => {
    const d = dom(render({ projects: withKinds({ listmonk: 'source-available', mautic: 'source-available', keila: 'source-available', postal: 'fair-code' }) }));
    const list = jsonLd(d).find((x) => x['@type'] === 'ItemList');
    expect(JSON.stringify(list)).not.toMatch(/open.?source/i);
  });
});

// Fix round 1 : fiche dont toutes les alternatives sont source-available ou
// fair-code — ni le titre ni les libellés de l'interface ne disent « open source ».
describe('fiche — libellés neutres (Ruling 44)', () => {
  const all = new Map([...PROJECTS].map(([slug, p]) => [slug, { ...p, license: p.license ?? 'Custom', licenseKind: 'source-available', licenseSource: 'https://example.org/LICENSE' }]));
  for (const lang of ['en', 'fr']) {
    it(`tout source-available (${lang}) : titre, menu « ways » et note sans alternative`, () => {
      const claims = lang === 'fr' ? /open[- ]source|\blibres?\b/i : /open[- ]source/i;
      const d = dom(render({ lang, projects: all }));
      expect(text(d.querySelector('title'))).not.toMatch(claims);
      expect(text(d.querySelector('nav.ways'))).not.toMatch(claims);
      expect(text(d.querySelector('#alternatives-heading'))).not.toMatch(claims);
      expect(text(d.querySelector('#alternatives-caption'))).not.toMatch(claims);
      const none = dom(render({ lang, tool: { ...tool, alternatives: [] } }));
      expect(text(section(none, 'alternatives-heading').querySelector('.intro'))).not.toMatch(claims);
    });
  }
});
