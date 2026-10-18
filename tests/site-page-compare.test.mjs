import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import {
  renderComparePage, buildComparePages, compareLinksFor, compareDateModified, compareCategory,
} from '../scripts/lib/site-page-compare.mjs';
import { renderToolPage } from '../scripts/lib/site-page-tool.mjs';
import { renderProjectPage } from '../scripts/lib/site-page-project.mjs';
import { indexable } from '../scripts/lib/site-alternatives.mjs';
import { loadData } from '../scripts/lib/load-data.mjs';
import { sponsorContext, renderSponsorSlots } from '../scripts/lib/site-sponsors.mjs';

// Comparatifs /{lang}/compare/{a}-vs-{b} (Task A6, spec D4, D7, D14).
// Chaînes : les vrais ui.json en et fr. Paires et textes : des fixtures,
// data/compare.json est encore vide (Partie B).
const uiOf = (lang) => JSON.parse(readFileSync(`data/i18n/${lang}/ui.json`, 'utf8'));
const UI = { en: uiOf('en'), fr: uiOf('fr') };

const TODAY = '2026-10-17';
const BUILD = '2026-10-17';
const LANGS = ['en', 'fr'];

const categories = {
  newsletter: { label: { en: 'Newsletters & publishing', fr: 'Newsletters et publication' } },
};

const stats = (over) => ({ stars: 17000, lastCommit: '2026-10-10', createdAt: '2019-06-26', archived: false, checkedOn: '2026-10-16', ...over });
const project = (slug, over = {}) => ({
  slug, name: slug.charAt(0).toUpperCase() + slug.slice(1), homepage: `https://${slug}.example`, repo: `org/${slug}`,
  license: 'AGPL-3.0', selfHostable: true, hosted: { exists: false }, deploy: [], stack: [], categories: ['newsletter'],
  markets: ['en', 'fr'], stats: stats(), ...over,
});
// listmonk : actif, chiffres frais ; keila : chiffres périmés (77 jours) ;
// postal : sans dépôt GitHub ; ghosted : archivé ; mautic : offre hébergée.
const PROJECTS = new Map([
  // Seul listmonk a son auto-hébergement et son absence d'offre hébergée
  // vérifiés ; les autres portent les valeurs par défaut de la migration.
  ['listmonk', project('listmonk', {
    name: 'Listmonk', homepage: 'https://listmonk.app', repo: 'knadh/listmonk',
    selfHostableCheckedOn: '2026-10-12', selfHostableSource: 'https://listmonk.app/docs/installation/',
    hosted: { exists: false, checkedOn: '2026-10-12', source: 'https://listmonk.app' },
  })],
  ['keila', project('keila', { name: 'Keila', stats: stats({ stars: 1600, lastCommit: '2026-07-20', checkedOn: '2026-08-01' }) })],
  ['postal', project('postal', { name: 'Postal', repo: null })],
  ['ghosted', project('ghosted', { name: 'Ghosted', stats: stats({ archived: true }) })],
  ['mautic', project('mautic', {
    name: 'Mautic', hosted: { exists: true, priceFrom: 9, currency: 'USD', source: 'https://mautic.example/pricing', checkedOn: '2026-10-01' },
  })],
]);
delete PROJECTS.get('postal').stats;

const tool = (slug, over) => ({
  slug, name: slug.charAt(0).toUpperCase() + slug.slice(1), domains: [`${slug}.example`], category: 'newsletter', verdict: 'kinda',
  pagePriority: 50, markets: ['en', 'fr'], relatedSlugs: [],
  pricing: { amount: 20, currency: 'USD', basis: 'flat-monthly', source: `https://${slug}.example/pricing`, checkedOn: '2026-07-30' },
  moatType: 'network', diyTimeEstimate: 'weekend', requirements: [], verifiedOneShot: false,
  ...over,
});
const TOOLS = new Map([
  ['mailchimp', tool('mailchimp', { name: 'Mailchimp', alternatives: [{ project: 'listmonk', fit: 'full' }] })],
  // Publiée en anglais seulement.
  ['substack', tool('substack', { markets: ['en'], pricing: { amount: 0, currency: 'USD', basis: 'one-time', source: 'https://substack.example', checkedOn: '2026-09-01' } })],
]);

const PROJECT_I18N = new Map([
  ['en/listmonk', { tagline: 'Self-hosted newsletter manager.', description: 'x', strengths: ['a', 'b', 'c'], limits: ['a', 'b'], bestFor: 'x' }],
  ['fr/listmonk', { tagline: 'Gestionnaire de newsletters auto-hébergé.', description: 'x', strengths: ['a', 'b', 'c'], limits: ['a', 'b'], bestFor: 'x' }],
]);
const TOOL_I18N = new Map([['en/mailchimp', { tagline: 'Email marketing for small teams.' }]]);

const SUMMARY = 'Pick Listmonk if you can run a server: it costs nothing and sends as much as you want. Stay on Mailchimp if you need the visual editor and do not want to touch a server.';
const compareEntry = (over = {}) => ({
  summary: SUMMARY,
  pickAIf: ['You want a drag-and-drop editor', 'You never want to run a server'],
  pickBIf: ['You can run Docker', 'You send a lot of email', 'You want your data on your own server'],
  faq: [
    { q: 'Is Listmonk really free?', a: 'Yes, under AGPL-3.0.' },
    { q: 'Can I import my Mailchimp list?', a: 'Yes, as CSV.' },
    { q: 'Does Listmonk send the email itself?', a: 'No, it needs an SMTP provider.' },
  ],
  ...over,
});

const PAIRS = [
  { a: 'mailchimp', b: 'listmonk', kindA: 'tool', kindB: 'project', volume: { us: 90 }, checkedOn: '2026-10-15' },
  { a: 'listmonk', b: 'keila', kindA: 'project', kindB: 'project', volume: { us: 40 }, checkedOn: '2026-10-15' },
  { a: 'listmonk', b: 'ghosted', kindA: 'project', kindB: 'project', volume: { us: 30 }, checkedOn: '2026-10-15' },
  { a: 'substack', b: 'postal', kindA: 'tool', kindB: 'project', volume: { us: 30 }, checkedOn: '2026-10-15' },
  { a: 'mailchimp', b: 'mautic', kindA: 'tool', kindB: 'project', volume: { us: 50 }, checkedOn: '2026-10-15' },
];
const COMPARE_I18N = new Map([
  ['en/mailchimp-vs-listmonk', compareEntry()],
  ['fr/mailchimp-vs-listmonk', compareEntry({ summary: 'Prends Listmonk si tu sais faire tourner un serveur.' })],
  ['en/listmonk-vs-keila', compareEntry()],
  ['en/listmonk-vs-ghosted', compareEntry()],
  ['en/substack-vs-postal', compareEntry()],
  ['fr/substack-vs-postal', compareEntry()],
  // mailchimp-vs-mautic : aucun texte, donc aucune page.
]);

const projectCtx = { projectI18n: PROJECT_I18N, tools: TOOLS, today: TODAY };
const projectIndexableIn = (lang) => (p) => indexable.project(p, lang, projectCtx);
const PLAN = buildComparePages({ compare: PAIRS, compareI18n: COMPARE_I18N, tools: TOOLS, projects: PROJECTS, langs: LANGS, today: TODAY });
const planFor = (lang, key) => PLAN.find((p) => p.lang === lang && p.key === key);

function sideOf(side, lang) {
  const texts = side.kind === 'tool' ? TOOL_I18N : PROJECT_I18N;
  return { ...side, i18n: texts.get(`${lang}/${side.entity.slug}`) };
}

function render(key = 'mailchimp-vs-listmonk', lang = 'en', over = {}) {
  const page = planFor(lang, key);
  return renderComparePage({
    lang,
    path: page.path,
    left: sideOf(page.left, lang),
    right: sideOf(page.right, lang),
    i18nEntry: page.i18nEntry,
    ui: UI[lang],
    alternates: page.alternates,
    xDefaultPath: page.xDefaultPath,
    homePath: `/${lang}/`,
    categories,
    categoryPath: `/${lang}/categories/newsletter`,
    buildDate: BUILD,
    today: TODAY,
    indexable: page.indexable,
    projectIndexable: projectIndexableIn(lang),
    sponsorSlots: null,
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
const ofType = (doc, type) => jsonLd(doc).find((x) => x['@type'] === type);
/** Les deux cellules (côté A, côté B) de la ligne du tableau dont l'en-tête vaut `label`. */
const rowOf = (doc, label) => {
  const row = [...doc.querySelectorAll('.compare-table tbody tr')].find((tr) => text(tr.querySelector('th')) === label);
  return row ? [...row.querySelectorAll('td')] : null;
};
const t = UI.en.site.tool;
const c = UI.en.site.compare;

describe('buildComparePages — ensemble des pages', () => {
  it('rejects compare pair with unknown side', () => {
    const bad = [{ a: 'mailchimp', b: 'nope', kindA: 'tool', kindB: 'project', volume: { us: 30 }, checkedOn: '2026-10-15' }];
    expect(() => buildComparePages({ compare: bad, compareI18n: new Map(), tools: TOOLS, projects: PROJECTS, langs: LANGS, today: TODAY }))
      .toThrow(/nope/);
    // Le côté existe, mais pas sous ce type : même refus.
    const wrongKind = [{ a: 'listmonk', b: 'keila', kindA: 'tool', kindB: 'project', volume: { us: 30 }, checkedOn: '2026-10-15' }];
    expect(() => buildComparePages({ compare: wrongKind, compareI18n: new Map(), tools: TOOLS, projects: PROJECTS, langs: LANGS, today: TODAY }))
      .toThrow(/listmonk/);
  });

  it('page not generated in a lang without compare i18n', () => {
    const keys = PLAN.map((p) => `${p.lang}/${p.key}`).sort();
    expect(keys).toEqual([
      'en/listmonk-vs-ghosted', 'en/listmonk-vs-keila', 'en/mailchimp-vs-listmonk', 'en/substack-vs-postal',
      'fr/mailchimp-vs-listmonk',
    ]);
    expect(PLAN.some((p) => p.key === 'mailchimp-vs-mautic')).toBe(false);
    // La langue sans texte sort aussi des hreflang.
    expect(planFor('en', 'listmonk-vs-keila').alternates).toEqual([{ lang: 'en', path: '/en/compare/listmonk-vs-keila', indexable: true }]);
    expect(planFor('fr', 'mailchimp-vs-listmonk').alternates.map((a) => a.lang)).toEqual(['en', 'fr']);
    expect(planFor('fr', 'mailchimp-vs-listmonk').xDefaultPath).toBe('/en/compare/mailchimp-vs-listmonk');
    // Et le gabarit, sans texte, ne rend rien.
    expect(render('mailchimp-vs-listmonk', 'en', { i18nEntry: undefined })).toBeNull();
  });

  it('Ruling 24 : pas de page dans une langue où une fiche outil du comparatif n’est pas publiée', () => {
    // substack-vs-postal est rédigé en fr, mais Substack n'est publié qu'en en.
    expect(COMPARE_I18N.has('fr/substack-vs-postal')).toBe(true);
    expect(planFor('fr', 'substack-vs-postal')).toBeUndefined();
    const en = planFor('en', 'substack-vs-postal');
    expect(en.alternates).toEqual([{ lang: 'en', path: '/en/compare/substack-vs-postal', indexable: true }]);
    expect(en.xDefaultPath).toBe('/en/compare/substack-vs-postal');
    // Ni lien français depuis la page projet de Postal, ni depuis aucune fiche.
    expect(compareLinksFor(PLAN, { lang: 'fr', kind: 'project', slug: 'postal', ui: UI.fr })).toEqual([]);
    expect(compareLinksFor(PLAN, { lang: 'fr', kind: 'tool', slug: 'substack', ui: UI.fr })).toEqual([]);
    expect(compareLinksFor(PLAN, { lang: 'en', kind: 'project', slug: 'postal', ui: UI.en }).map((l) => l.href))
      .toEqual(['/en/compare/substack-vs-postal']);
  });

  it('un texte dans une langue non publiée ne crée aucune page', () => {
    const i18n = new Map([...COMPARE_I18N, ['de/mailchimp-vs-listmonk', compareEntry()]]);
    const plan = buildComparePages({ compare: PAIRS, compareI18n: i18n, tools: TOOLS, projects: PROJECTS, langs: LANGS, today: TODAY });
    expect(plan.some((p) => p.lang === 'de')).toBe(false);
  });

  it('chemin, côtés résolus, porte indexable.compare + côtés affichables', () => {
    const page = planFor('en', 'mailchimp-vs-listmonk');
    expect(page.path).toBe('/en/compare/mailchimp-vs-listmonk');
    expect(page.left).toEqual({ kind: 'tool', entity: TOOLS.get('mailchimp') });
    expect(page.right).toEqual({ kind: 'project', entity: PROJECTS.get('listmonk') });
    expect(page.i18nEntry).toBe(COMPARE_I18N.get('en/mailchimp-vs-listmonk'));
    for (const p of PLAN) {
      const displayable = [p.left, p.right].every((s) => s.kind === 'tool' || s.entity.slug !== 'ghosted');
      expect(p.indexable, p.key).toBe(indexable.compare(p.pair, p.lang, { compareI18n: COMPARE_I18N }) && displayable);
    }
    expect(planFor('en', 'listmonk-vs-ghosted').indexable).toBe(false);
    expect(planFor('en', 'listmonk-vs-ghosted').inactive.map((x) => x.slug)).toEqual(['ghosted']);
    expect(planFor('en', 'listmonk-vs-keila').indexable).toBe(true);
  });

  it('aucune paire (data/compare.json absent) : aucune page', () => {
    expect(buildComparePages({ compare: [], compareI18n: new Map(), tools: TOOLS, projects: PROJECTS, langs: LANGS, today: TODAY })).toEqual([]);
  });
});

describe('renderComparePage — titre, en-tête, résumé', () => {
  it('titre « {a} vs {b} ({year}): Which One Should You Use? », année du build', () => {
    const doc = dom(render());
    expect(text(doc.querySelector('title'))).toBe('Mailchimp vs Listmonk (2026): Which One Should You Use?');
    expect(text(dom(render('mailchimp-vs-listmonk', 'en', { buildDate: '2031-02-01' })).querySelector('title'))).toContain('(2031)');
    expect(text(doc.querySelector('h1'))).toBe('Mailchimp vs Listmonk');
    expect(text(dom(render('mailchimp-vs-listmonk', 'fr')).querySelector('title'))).toBe('Mailchimp vs Listmonk (2026) : lequel choisir ?');
  });

  it('summary paragraph rendered verbatim from i18n', () => {
    const doc = dom(render());
    expect(text(doc.querySelector('.compare-summary'))).toBe(SUMMARY);
    expect(text(dom(render('mailchimp-vs-listmonk', 'fr')).querySelector('.compare-summary'))).toBe('Prends Listmonk si tu sais faire tourner un serveur.');
  });

  it('« Pick {name} if… » des deux côtés, chaque raison dans l’ordre', () => {
    const doc = dom(render());
    const heads = [...doc.querySelectorAll('.pro-con h2')].map(text);
    expect(heads).toEqual(['Pick Mailchimp if…', 'Pick Listmonk if…']);
    const lists = [...doc.querySelectorAll('.pro-con ul')].map((ul) => [...ul.querySelectorAll('li')].map(text));
    expect(lists).toEqual([compareEntry().pickAIf, compareEntry().pickBIf]);
    expect(text(dom(render('mailchimp-vs-listmonk', 'fr')).querySelector('.pro-con h2'))).toBe('Prends Mailchimp si…');
  });

  it('fil d’Ariane annuaire › catégorie du côté A › « A vs B », plus BreadcrumbList', () => {
    const doc = dom(render());
    expect(text(doc.querySelector('.crumbs'))).toBe('Directory / Newsletters & publishing / Mailchimp vs Listmonk');
    const crumbs = ofType(doc, 'BreadcrumbList').itemListElement.map((i) => i.name);
    expect(crumbs).toEqual(['Directory', 'Newsletters & publishing', 'Mailchimp vs Listmonk']);
    // Catégorie sans page dans la langue : nommée sans lien, absente du JSON-LD.
    const noCat = dom(render('mailchimp-vs-listmonk', 'en', { categoryPath: null }));
    expect(noCat.querySelector('.crumbs a[href="/en/categories/newsletter"]')).toBeNull();
    expect(ofType(noCat, 'BreadcrumbList').itemListElement.map((i) => i.name)).toEqual(['Directory', 'Mailchimp vs Listmonk']);
  });

  it('page indexable : aucune balise robots, hreflang des langues rédigées', () => {
    const html = render();
    expect(html).not.toContain('name="robots"');
    expect(html).toContain('hreflang="fr"');
    expect(compareCategory({ kind: 'tool', entity: TOOLS.get('mailchimp') })).toBe('newsletter');
    expect(compareCategory({ kind: 'project', entity: PROJECTS.get('listmonk') })).toBe('newsletter');
  });
});

describe('renderComparePage — tableau des faits', () => {
  it('outil contre projet : verdict, prix sourcé et daté, coût annuel, temps DIY ; licence, étoiles, commit, self-host, hébergé', () => {
    const doc = dom(render());
    const heads = [...doc.querySelectorAll('.compare-table thead th')].slice(1).map((th) => text(th.querySelector('a')));
    expect(heads).toEqual(['Mailchimp', 'Listmonk']);

    const [vA, vB] = rowOf(doc, c.rowVerdict);
    expect(vA.querySelector('.badge.kinda')).not.toBeNull();
    expect(text(vA)).toContain('Almost');
    expect(text(vB)).toBe('—');
    expect(vB.querySelector('span[title]').getAttribute('title')).toBe(c.notApplicable);

    const [pA] = rowOf(doc, c.rowPrice);
    expect(text(pA)).toContain('$20/mo');
    expect(pA.querySelector('a[href="https://mailchimp.example/pricing"]')).not.toBeNull();
    expect(text(pA)).toContain('July 30, 2026');
    expect(text(rowOf(doc, t.yearCostLabel)[0])).toContain('$240');
    expect(text(rowOf(doc, t.buildTimeLabel)[0])).toBe('A weekend');

    expect(rowOf(doc, t.colLicense).map(text)).toEqual([t.licenseProprietary, 'AGPL-3.0']);
    expect(text(rowOf(doc, t.colStars)[1])).toBe('17K');
    expect(text(rowOf(doc, t.colLastCommit)[1])).toBe('Oct 2026');
    expect(rowOf(doc, t.colSelfHost).map(text)).toEqual([t.selfHostNo, t.selfHostYes]);
    expect(text(rowOf(doc, t.colHosted)[1])).toContain(t.hostedNone);
    expect(text(rowOf(doc, t.colHosted)[1])).toContain('October 12, 2026');
    expect(text(rowOf(doc, UI.en.site.project.websiteLabel)[0])).toBe('mailchimp.example');
    expect(text(rowOf(doc, UI.en.site.project.repoLabel)[1])).toBe('knadh/listmonk');
    // L'accroche de chaque côté, sous son nom.
    expect(text(doc.querySelector('.compare-table thead'))).toContain('Email marketing for small teams.');
    expect(text(doc.querySelector('.compare-table thead'))).toContain('Self-hosted newsletter manager.');
  });

  it('side-by-side facts table never shows 0 for missing stats', () => {
    // keila : chiffres périmés ; postal : aucun dépôt GitHub.
    for (const key of ['listmonk-vs-keila', 'substack-vs-postal']) {
      const doc = dom(render(key));
      const stale = rowOf(doc, t.colStars)[1];
      expect(text(stale), key).toBe('—');
      expect(stale.querySelector('span[title]'), key).not.toBeNull();
      expect(text(rowOf(doc, t.colLastCommit)[1]), key).toBe('—');
      const cells = [...doc.querySelectorAll('.compare-table td')].map(text);
      expect(cells.filter((x) => /^0$|^0 /.test(x)), key).toEqual([]);
    }
    // Le vieux chiffre de keila (1 600 étoiles) n'apparaît nulle part.
    expect(text(dom(render('listmonk-vs-keila')).querySelector('.compare-table'))).not.toMatch(/1\.6K|1,600/);
  });

  it('deux projets : aucune ligne propre aux outils (verdict, prix, DIY)', () => {
    const doc = dom(render('listmonk-vs-keila'));
    expect(rowOf(doc, c.rowVerdict)).toBeNull();
    expect(rowOf(doc, c.rowPrice)).toBeNull();
    expect(rowOf(doc, t.buildTimeLabel)).toBeNull();
    expect(rowOf(doc, t.colStars)).not.toBeNull();
  });

  it('prix non mensuel : pas de coût annuel inventé', () => {
    const doc = dom(render('substack-vs-postal'));
    expect(rowOf(doc, t.yearCostLabel)).toBeNull();
  });

  it('offre hébergée : prix, source cliquable et date', () => {
    const page = buildComparePages({
      compare: PAIRS, compareI18n: new Map([...COMPARE_I18N, ['en/mailchimp-vs-mautic', compareEntry()]]),
      tools: TOOLS, projects: PROJECTS, langs: LANGS, today: TODAY,
    }).find((p) => p.key === 'mailchimp-vs-mautic');
    const doc = dom(render('mailchimp-vs-listmonk', 'en', {
      path: page.path, left: sideOf(page.left, 'en'), right: sideOf(page.right, 'en'), i18nEntry: page.i18nEntry,
    }));
    const hosted = rowOf(doc, t.colHosted)[1];
    expect(text(hosted)).toContain('From $9');
    expect(hosted.querySelector('a[href="https://mautic.example/pricing"]')).not.toBeNull();
    expect(text(hosted)).toContain('October 1, 2026');
    // JSON-LD : aucune offre gratuite affirmée pour un projet à offre hébergée.
    const items = ofType(doc, 'ItemList').itemListElement.map((i) => i.item);
    expect(items[1].offers).toBeUndefined();
  });
});

describe('renderComparePage — liens et JSON-LD', () => {
  it('links back to both entity pages', () => {
    const doc = dom(render());
    expect(doc.querySelector('.compare-table thead a[href="/en/tools/mailchimp"]')).not.toBeNull();
    expect(doc.querySelector('.compare-table thead a[href="/en/oss/listmonk"]')).not.toBeNull();
    // Projet sans page indexable : son site, en nofollow.
    const noOss = dom(render('mailchimp-vs-listmonk', 'en', { projectIndexable: () => false }));
    const link = noOss.querySelector('.compare-table thead a[href="https://listmonk.app"]');
    expect(link.getAttribute('rel')).toContain('nofollow');
  });

  it('invariant : rendre un comparatif dont la fiche outil n’est pas publiée dans la langue casse le build', () => {
    // Le plan l'exclut (Ruling 24) ; un appel direct qui le contourne échoue en nommant la paire et la langue.
    expect(() => render('substack-vs-postal', 'en', { lang: 'fr', path: '/fr/compare/substack-vs-postal', ui: UI.fr }))
      .toThrow(/\/fr\/compare\/substack-vs-postal.*"substack".*\bfr\b/);
  });

  it('FAQPage 3 questions', () => {
    const doc = dom(render());
    const faq = ofType(doc, 'FAQPage');
    expect(faq.mainEntity).toHaveLength(3);
    expect(faq.mainEntity.map((q) => q.name)).toEqual(compareEntry().faq.map((x) => x.q));
    expect([...doc.querySelectorAll('.faq details summary')].map(text)).toEqual(compareEntry().faq.map((x) => x.q));
  });

  it('WebPage, BreadcrumbList et ItemList des deux SoftwareApplication', () => {
    const doc = dom(render());
    const types = jsonLd(doc).map((x) => x['@type']);
    expect(types).toEqual(expect.arrayContaining(['WebPage', 'BreadcrumbList', 'FAQPage', 'ItemList']));
    const items = ofType(doc, 'ItemList').itemListElement.map((i) => i.item);
    expect(items.map((i) => i['@type'])).toEqual(['SoftwareApplication', 'SoftwareApplication']);
    expect(items.map((i) => i.name)).toEqual(['Mailchimp', 'Listmonk']);
    expect(items[0].url).toBe('https://saasmadefree.com/en/tools/mailchimp');
    expect(items[1].url).toBe('https://saasmadefree.com/en/oss/listmonk');
    // Prix 0 : seulement le projet sans offre hébergée, jamais l'outil payant.
    expect(items[0].offers).toBeUndefined();
    expect(items[1].offers).toEqual({ '@type': 'Offer', price: 0, priceCurrency: 'USD' });
    expect(ofType(doc, 'WebPage').dateModified).toBe('2026-10-16');
  });

  it('date de modification : le relevé le plus récent des deux côtés', () => {
    const page = planFor('en', 'mailchimp-vs-listmonk');
    expect(compareDateModified(page.left, page.right)).toBe('2026-10-16');
    const sp = planFor('en', 'substack-vs-postal');
    expect(compareDateModified(sp.left, sp.right)).toBe('2026-09-01');
  });
});

describe('renderComparePage — côté inactif', () => {
  it('projet archivé : page générée en noindex,follow, avis qui nomme le côté', () => {
    const html = render('listmonk-vs-ghosted');
    expect(html).toContain('<meta name="robots" content="noindex,follow">');
    const doc = dom(html);
    const notice = text(doc.querySelector('[role="note"]'));
    expect(notice).toContain('Ghosted');
    expect(notice).toContain('archived');
    expect(notice).not.toContain('Listmonk');
  });

  it('sans commit depuis plus de 365 jours : l’avis donne le mois', () => {
    const old = { kind: 'project', entity: project('oldy', { name: 'Oldy', stats: stats({ lastCommit: '2025-03-04' }) }) };
    const doc = dom(render('listmonk-vs-keila', 'en', { right: old, indexable: false }));
    expect(text(doc.querySelector('[role="note"]'))).toBe('Oldy has had no commit since March 2025. It may no longer be maintained.');
  });

  it('deux côtés actifs : aucun avis', () => {
    expect(dom(render()).querySelector('[role="note"]')).toBeNull();
  });
});

describe('renderComparePage — habillage', () => {
  it('emplacements vendus conservés, sans le mot « Sponsor »', async () => {
    const data = await loadData(process.cwd());
    const slots = renderSponsorSlots(sponsorContext({
      placements: data.sponsors.placements, today: TODAY, lang: 'en', ui: UI.en, favicons: {}, sponsorHref: '/en/sponsor',
    }));
    const html = render('mailchimp-vs-listmonk', 'en', { sponsorSlots: slots });
    for (const part of ['railLeft', 'railRight', 'tapeBottom', 'fallback']) {
      if (slots[part]) expect(html, part).toContain(slots[part]);
    }
    const body = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    expect(body).not.toMatch(/sponsor/i);
  });

  it('échappe toute donnée interpolée', () => {
    const evil = { kind: 'project', entity: { ...PROJECTS.get('listmonk'), name: 'A<b>&"' } };
    const html = render('mailchimp-vs-listmonk', 'en', {
      right: evil,
      i18nEntry: compareEntry({
        summary: '<script>x</script>', pickAIf: ['<i>no</i>', 'b'], pickBIf: ['<u>pb</u>', 'c'],
        faq: [{ q: '<em>q1</em>', a: '<img src=x onerror=1>' }, { q: 'q2', a: 'a2' }, { q: 'q3', a: 'a3' }],
      }),
    });
    expect(html).not.toContain('<b>&"');
    expect(html).not.toContain('<script>x</script>');
    expect(html).not.toContain('<i>no</i>');
    expect(html).not.toContain('<u>pb</u>');
    expect(html).not.toContain('<em>q1</em>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;u&gt;pb&lt;/u&gt;');
    expect(html).toContain('&lt;em&gt;q1&lt;/em&gt;');
    expect(html).toContain('A&lt;b&gt;&amp;&quot;');
  });

  it('aucun élément de texte vide dans <main>', () => {
    for (const key of ['mailchimp-vs-listmonk', 'listmonk-vs-keila', 'listmonk-vs-ghosted', 'substack-vs-postal']) {
      const h = render(key);
      const main = h.slice(h.indexOf('<main'), h.indexOf('</main>'));
      expect(main.match(/<(p|h2|h3|li|span|dd|th)([^>]*)>\s*<\/\1>/g), key).toBeNull();
    }
  });
});

describe('liens « Comparisons » des fiches outil et projet', () => {
  const toolEntry = {
    verdictSummary: 's', coreLoopDIY: 'c', whatYouLose: ['l'], whyPeopleStillPay: 'w', prompt: 'p', faq: [{ q: 'q', a: 'a' }],
  };
  const renderTool = (slug, lang, comparisons) => renderToolPage({
    lang, path: `/${lang}/tools/${slug}`, tool: TOOLS.get(slug), i18nEntry: toolEntry, categories, ui: UI[lang],
    alternates: [], xDefaultPath: null, homePath: `/${lang}/`, categoryPath: `/${lang}/categories/newsletter`,
    relatedTools: [], voteCount: null, favicons: {}, agents: [], sponsorSlots: null, buildDate: BUILD,
    projects: PROJECTS, projectI18n: PROJECT_I18N, today: TODAY, projectIndexable: projectIndexableIn(lang), comparisons,
  });
  const renderProject = (slug, lang, comparisons) => renderProjectPage({
    lang, path: `/${lang}/oss/${slug}`, project: PROJECTS.get(slug), i18nEntry: PROJECT_I18N.get(`${lang}/${slug}`),
    replaced: [TOOLS.get('mailchimp')], related: [], ui: UI[lang], alternates: [], homePath: `/${lang}/`, categories,
    buildDate: BUILD, today: TODAY, indexable: true, comparisons,
  });

  it('compareLinksFor : les comparatifs générés dans la langue où l’entité figure, dans l’ordre de compare.json', () => {
    expect(compareLinksFor(PLAN, { lang: 'en', kind: 'project', slug: 'listmonk', ui: UI.en })).toEqual([
      { href: '/en/compare/mailchimp-vs-listmonk', label: 'Mailchimp vs Listmonk' },
      { href: '/en/compare/listmonk-vs-keila', label: 'Listmonk vs Keila' },
      { href: '/en/compare/listmonk-vs-ghosted', label: 'Listmonk vs Ghosted' },
    ]);
    // En français, seule la paire rédigée en français.
    expect(compareLinksFor(PLAN, { lang: 'fr', kind: 'project', slug: 'listmonk', ui: UI.fr }))
      .toEqual([{ href: '/fr/compare/mailchimp-vs-listmonk', label: 'Mailchimp vs Listmonk' }]);
    // mailchimp-vs-mautic n'a pas de texte : jamais lié.
    expect(compareLinksFor(PLAN, { lang: 'en', kind: 'tool', slug: 'mailchimp', ui: UI.en }).map((l) => l.href))
      .toEqual(['/en/compare/mailchimp-vs-listmonk']);
    // Le type compte : un projet et un outil peuvent porter le même slug.
    expect(compareLinksFor(PLAN, { lang: 'en', kind: 'tool', slug: 'listmonk', ui: UI.en })).toEqual([]);
  });

  it('la fiche outil et la page projet listent leurs comparatifs sous « Comparisons »', () => {
    for (const [html, lang] of [
      [renderTool('mailchimp', 'en', compareLinksFor(PLAN, { lang: 'en', kind: 'tool', slug: 'mailchimp', ui: UI.en })), 'en'],
      [renderProject('listmonk', 'fr', compareLinksFor(PLAN, { lang: 'fr', kind: 'project', slug: 'listmonk', ui: UI.fr })), 'fr'],
    ]) {
      const doc = dom(html);
      const section = doc.querySelector('section[aria-labelledby="compare-links-heading"]');
      expect(section, lang).not.toBeNull();
      expect(text(section.querySelector('h2'))).toBe(UI[lang].site.compare.linksHeading);
      const link = section.querySelector(`a[href="/${lang}/compare/mailchimp-vs-listmonk"]`);
      expect(text(link)).toBe('Mailchimp vs Listmonk');
    }
  });

  it('aucun comparatif : rien n’est rendu', () => {
    for (const html of [renderTool('substack', 'en', []), renderTool('mailchimp', 'en', undefined), renderProject('listmonk', 'en', [])]) {
      expect(html).not.toContain('compare-links-heading');
      expect(html).not.toContain('/compare/');
    }
  });

  it('chaque lien /compare/ d’une fiche ou d’une page projet pointe vers une page générée dans cette langue', () => {
    const generated = new Set(PLAN.map((p) => p.path));
    const links = [];
    for (const lang of LANGS) {
      for (const tl of [...TOOLS.values()].filter((x) => x.markets.includes(lang))) {
        const out = renderTool(tl.slug, lang, compareLinksFor(PLAN, { lang, kind: 'tool', slug: tl.slug, ui: UI[lang] }));
        links.push(...[...out.matchAll(/href="(\/([a-z]{2})\/compare\/[^"]+)"/g)].map((m) => [m[1], m[2], lang]));
      }
      // Les pages projet rédigées dans la langue, avec le même PLAN.
      for (const pr of [...PROJECTS.values()].filter((x) => PROJECT_I18N.has(`${lang}/${x.slug}`))) {
        const out = renderProject(pr.slug, lang, compareLinksFor(PLAN, { lang, kind: 'project', slug: pr.slug, ui: UI[lang] }));
        links.push(...[...out.matchAll(/href="(\/([a-z]{2})\/compare\/[^"]+)"/g)].map((m) => [m[1], m[2], lang]));
      }
    }
    expect(links.length).toBeGreaterThan(0);
    // Les liens des pages projet sont bien comptés (listmonk : 3 en, 1 fr).
    expect(links.filter(([href]) => href.includes('vs-keila'))).toHaveLength(1);
    expect(links.filter(([, , lang]) => lang === 'fr').map(([href]) => href))
      .toEqual(['/fr/compare/mailchimp-vs-listmonk', '/fr/compare/mailchimp-vs-listmonk']);
    for (const [href, hrefLang, lang] of links) {
      expect(generated.has(href), href).toBe(true);
      expect(hrefLang).toBe(lang);
    }
  });
});

describe('renderComparePage — valeurs non vérifiées (finding 2)', () => {
  it('keila : auto-hébergement et offre hébergée par défaut = tiret titré, et aucun prix 0 en JSON-LD', () => {
    const doc = dom(render('listmonk-vs-keila'));
    for (const label of [t.colSelfHost, t.colHosted]) {
      const [, keila] = rowOf(doc, label);
      expect(text(keila)).toBe('—');
      expect(keila.querySelector('[title]').getAttribute('title')).toBe(t.notCheckedYet);
    }
    expect(text(rowOf(doc, t.colSelfHost)[0])).toBe(t.selfHostYes);
    const items = ofType(doc, 'ItemList').itemListElement.map((i) => i.item);
    expect(items[0].offers).toEqual({ '@type': 'Offer', price: 0, priceCurrency: 'USD' });
    expect(items[1].offers).toBeUndefined();
  });
});

// Ruling 34 : le pied de page ne lie une collection que si build-site l'a
// déclarée indexable dans la langue (collectionPlan) — et toujours le hub.
describe('Ruling 34 — liens de collection du pied de page', () => {
  const footer = (page) => page.slice(page.indexOf('<footer'), page.indexOf('</footer>'));
  it('self-hosted noindex : aucun lien ; indexable : lié ; build-tonight lié s’il est indexable', () => {
    const off = footer(render('mailchimp-vs-listmonk', 'en', { collectionLinks: ['build-tonight'] }));
    expect(off).not.toContain('/collections/self-hosted');
    expect(off).toContain('/collections/build-tonight');
    expect(off).toContain('/alternatives/"');
    const on = footer(render('mailchimp-vs-listmonk', 'en', { collectionLinks: ['self-hosted', 'build-tonight'] }));
    expect(on).toContain('/collections/self-hosted');
    expect(on).toContain('/collections/build-tonight');
  });
});

// Ruling 44 : la nature d'une licence non libre suit son nom dans les faits.
describe('renderComparePage — nature de la licence (Ruling 44)', () => {
  it('côté projet : licence puis nature, avec son explication en title ; open-source : le nom seul', () => {
    const page = planFor('en', 'mailchimp-vs-listmonk');
    const right = { ...page.right, entity: { ...page.right.entity, licenseKind: 'source-available', licenseSource: 'https://listmonk.app/LICENSE' } };
    const d = dom(render('mailchimp-vs-listmonk', 'en', { right: sideOf(right, 'en') }));
    const [, cell] = rowOf(d, t.colLicense);
    expect(text(cell)).toBe('AGPL-3.0 Source-available');
    expect(cell.querySelector('.license-kind').getAttribute('title')).toBe(t.licenseKindNotes['source-available']);
    const open = { ...page.right, entity: { ...right.entity, licenseKind: 'open-source' } };
    const o = dom(render('mailchimp-vs-listmonk', 'en', { right: sideOf(open, 'en') }));
    expect(rowOf(o, t.colLicense).map(text)).toEqual([t.licenseProprietary, 'AGPL-3.0']);
  });
});
