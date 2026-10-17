import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import {
  renderCategoryPage, categoryProjects, categoryInactiveProjects, categoryIndexable,
} from '../scripts/lib/site-page-category.mjs';
import { renderCategoriesIndexPage } from '../scripts/lib/site-page-categories-index.mjs';
import { loadData } from '../scripts/lib/load-data.mjs';
import { sponsorContext, renderSponsorSlots } from '../scripts/lib/site-sponsors.mjs';

// Pages de catégorie « best » (Task A7, spec D6, D7, D14) et répertoire des
// catégories. Chaînes : les vrais ui.json en et fr. Données : des fixtures.
const uiOf = (lang) => JSON.parse(readFileSync(`data/i18n/${lang}/ui.json`, 'utf8'));
const UI = { en: uiOf('en'), fr: uiOf('fr') };
const TODAY = '2026-10-17';

const categories = {
  newsletter: { label: { en: 'Newsletters & publishing', fr: 'Newsletters et publication' } },
  tasks: { label: { en: 'Tasks', fr: 'Tâches' } },
};

const stats = (over) => ({ stars: 1000, lastCommit: '2026-10-01', createdAt: '2019-01-01', archived: false, checkedOn: '2026-10-15', ...over });
const project = (slug, over = {}) => ({
  slug, name: slug.charAt(0).toUpperCase() + slug.slice(1), homepage: `https://${slug}.example`, repo: `org/${slug}`,
  license: 'MIT', selfHostable: true, hosted: { exists: false }, categories: ['newsletter'], stats: stats(), ...over,
});
// listmonk et keila : « full » quelque part ; mautic : « partial » au mieux ;
// postal : sans dépôt (pas de chiffres) ; ghosted : archivé ; oldy : sans
// commit depuis plus d'un an ; orphan : cité par une fiche d'une autre catégorie.
const PROJECTS = new Map([
  ['listmonk', project('listmonk', { name: 'Listmonk', license: 'AGPL-3.0', stats: stats({ stars: 17000 }) })],
  ['keila', project('keila', { stats: stats({ stars: 1600 }) })],
  ['mautic', project('mautic', { stats: stats({ stars: 10787 }) })],
  ['postal', project('postal', { repo: null })],
  ['ghosted', project('ghosted', { stats: stats({ archived: true }) })],
  ['oldy', project('oldy', { stats: stats({ lastCommit: '2025-03-04' }) })],
  ['orphan', project('orphan', { categories: ['tasks'] })],
]);
delete PROJECTS.get('postal').stats;

const view = (slug, over = {}) => ({
  slug, name: slug.charAt(0).toUpperCase() + slug.slice(1), category: 'newsletter', subcategory: null,
  tagline: `Tagline of ${slug}`, path: `/en/tools/${slug}`, verdict: 'kinda', pagePriority: 50, markets: ['en', 'fr'],
  pricing: { amount: 20, currency: 'USD', basis: 'flat-monthly', checkedOn: '2026-07-30' }, diyTimeEstimate: 'weekend',
  alternatives: [], ...over,
});
const VIEWS = [
  view('mailchimp', { name: 'Mailchimp', verdict: 'kinda', alternatives: [
    { project: 'mautic', fit: 'partial' }, { project: 'listmonk', fit: 'full' }, { project: 'ghosted', fit: 'full' },
  ], alternativeNames: ['Mautic', 'Listmonk'] }),
  view('beehiiv', { name: 'Beehiiv', verdict: 'yes', alternatives: [
    { project: 'listmonk', fit: 'partial' }, { project: 'keila', fit: 'full' }, { project: 'postal', fit: 'niche' },
    { project: 'oldy', fit: 'partial' },
  ] }),
  view('kit', { name: 'Kit', verdict: 'no' }),
];

function render(over = {}) {
  const lang = over.lang ?? 'en';
  return renderCategoryPage({
    lang, path: `/${lang}/categories/newsletter`, categorySlug: 'newsletter', categories,
    toolViews: VIEWS.map((v) => ({ ...v, path: `/${lang}/tools/${v.slug}` })), voteCounts: { mailchimp: 3 }, favicons: {},
    ui: UI[lang], alternates: [{ lang: 'en', path: '/en/categories/newsletter' }, { lang: 'fr', path: '/fr/categories/newsletter' }],
    xDefaultPath: '/en/categories/newsletter', homePath: `/${lang}/`, sponsorSlots: null,
    projects: PROJECTS, projectI18n: new Map([['en/listmonk', { tagline: 'Self-hosted newsletter manager.' }]]),
    today: TODAY, buildDate: TODAY, projectIndexable: (p) => p.slug === 'listmonk',
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

const html = render();
const doc = dom(html);

// ---------------------------------------------------------------------------
// D14 — inventaire de l'ancienne page de catégorie (HEAD avant A7), un test
// par élément affiché.
// ---------------------------------------------------------------------------
describe('D14 — page de catégorie : rien de ce qu’elle montrait ne disparaît', () => {
  it('fil d’Ariane annuaire › catégorie, plus BreadcrumbList', () => {
    const crumbs = doc.querySelector('nav.crumbs');
    expect(crumbs.querySelector('a').getAttribute('href')).toBe('/en/');
    expect(text(crumbs)).toBe('Directory / Newsletters & publishing');
    const bc = jsonLd(doc).find((d) => d['@type'] === 'BreadcrumbList');
    expect(bc.itemListElement.map((i) => i.name)).toEqual(['Directory', 'Newsletters & publishing']);
    expect(bc.itemListElement[1].item).toBe('https://saasmadefree.com/en/categories/newsletter');
  });

  it('un seul h1, qui nomme la catégorie', () => {
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
    expect(text(doc.querySelector('h1'))).toContain('Newsletters & publishing');
  });

  it('le nombre d’outils de la catégorie', () => {
    expect(text(doc.querySelector('main'))).toContain('3 tools');
  });

  it('la grille des SaaS : toutes les fiches, avec nom, lien, verdict, prix, accroche, votes et alternatives', () => {
    const cards = [...doc.querySelectorAll('#tool-table #tool-rows li.card')];
    expect(cards.map((c) => c.dataset.slug)).toEqual(['mailchimp', 'beehiiv', 'kit']);
    const mc = cards[0];
    expect(mc.querySelector('.card-name a').getAttribute('href')).toBe('/en/tools/mailchimp');
    expect(mc.querySelector('.badge.kinda')).not.toBeNull();
    expect(text(mc.querySelector('.price'))).toBe('$20/mo');
    expect(text(mc.querySelector('.tagline'))).toBe('Tagline of mailchimp');
    expect(text(mc.querySelector('.votes'))).toBe('3 votes');
    expect(text(mc.querySelector('.alts'))).toContain('Mautic, Listmonk');
    expect(mc.querySelector('img.fav')).not.toBeNull();
    expect(text(mc.querySelector('.cat'))).toBe('Newsletters & publishing');
  });

  it('ItemList des SaaS en JSON-LD, en plus de celle des projets', () => {
    const lists = jsonLd(doc).filter((d) => d['@type'] === 'ItemList');
    const saas = lists.find((l) => l.itemListElement[0].url);
    expect(saas.itemListElement.map((i) => i.name)).toEqual(['Mailchimp', 'Beehiiv', 'Kit']);
    expect(saas.itemListElement[0].url).toBe('https://saasmadefree.com/en/tools/mailchimp');
  });

  it('Organization en JSON-LD', () => {
    expect(jsonLd(doc).some((d) => d['@type'] === 'Organization')).toBe(true);
  });

  it('hreflang et sélecteur de langue', () => {
    expect(html).toContain('<link rel="alternate" hreflang="fr" href="https://saasmadefree.com/fr/categories/newsletter">');
    expect(html).toContain('hreflang="x-default" href="https://saasmadefree.com/en/categories/newsletter"');
    expect(doc.querySelector('nav.lang-switch a[hreflang="fr"]').getAttribute('href')).toBe('/fr/categories/newsletter');
  });

  it('la méta-description garde la question « remplacer ou continuer à payer »', () => {
    const desc = doc.querySelector('meta[name="description"]').getAttribute('content');
    expect(desc).toMatch(/coding agent can replace/);
    expect(desc).toMatch(/keep paying/);
  });

  it('emplacements vendus conservés, sans le mot « Sponsor »', async () => {
    const data = await loadData(process.cwd());
    const slots = renderSponsorSlots(sponsorContext({
      placements: data.sponsors.placements, today: TODAY, lang: 'en', ui: UI.en, favicons: {}, sponsorHref: '/en/sponsor',
    }));
    const withSlots = render({ sponsorSlots: slots });
    for (const part of ['railLeft', 'railRight', 'tapeBottom', 'fallback']) {
      if (slots[part]) expect(withSlots, part).toContain(slots[part]);
    }
    const body = withSlots.slice(withSlots.indexOf('<main'), withSlots.indexOf('</main>'));
    expect(body).not.toMatch(/sponsor/i);
  });

  it('URL canonique inchangée', () => {
    expect(doc.querySelector('link[rel="canonical"]').getAttribute('href')).toBe('https://saasmadefree.com/en/categories/newsletter');
  });
});

// ---------------------------------------------------------------------------
// Step 1 — la page « best »
// ---------------------------------------------------------------------------
describe('catégorie « best » — projets puis registre SaaS', () => {
  it('ranks projects by best fit across citing tools, then stars, then slug', () => {
    const ranked = categoryProjects(VIEWS, PROJECTS, TODAY);
    expect(ranked.map((r) => [r.project.slug, r.fit])).toEqual([
      ['listmonk', 'full'], ['keila', 'full'], ['mautic', 'partial'], ['postal', 'niche'],
    ]);
    expect(ranked[0].tools.map((t) => t.slug)).toEqual(['mailchimp', 'beehiiv']);
  });

  it('a project without GitHub figures ranks after those with figures, same fit', () => {
    const views = [view('a', { alternatives: [{ project: 'postal', fit: 'full' }, { project: 'keila', fit: 'full' }] })];
    expect(categoryProjects(views, PROJECTS, TODAY).map((r) => r.project.slug)).toEqual(['keila', 'postal']);
  });

  it('stale stars (> 45 days, hidden) do not rank: the project ranks as having no figures', () => {
    const projects = new Map(PROJECTS);
    // mautic : 10 787 étoiles relevées il y a 77 jours, donc masquées.
    projects.set('mautic', { ...PROJECTS.get('mautic'), stats: stats({ stars: 10787, checkedOn: '2026-08-01' }) });
    projects.set('cheap', project('cheap', { stats: stats({ stars: 5 }) }));
    const views = [view('a', { alternatives: [{ project: 'mautic', fit: 'partial' }, { project: 'cheap', fit: 'partial' }, { project: 'postal', fit: 'partial' }] })];
    expect(categoryProjects(views, projects, TODAY).map((r) => r.project.slug)).toEqual(['cheap', 'mautic', 'postal']);
  });

  it('n counts displayable projects only', () => {
    expect(doc.querySelector('title').textContent).toBe('4 Best Free & Open Source Newsletters & publishing Tools (2026)');
    expect(text(doc.querySelector('h1'))).toBe('4 Best Free & Open Source Newsletters & publishing Tools (2026)');
  });

  it('year comes from buildDate', () => {
    expect(dom(render({ buildDate: '2027-01-02' })).querySelector('title').textContent).toContain('(2027)');
  });

  it('category lists projects before SaaS registry', () => {
    const projects = html.indexOf('id="projects-heading"');
    const saas = html.indexOf('id="tool-table"');
    expect(projects).toBeGreaterThan(-1);
    expect(saas).toBeGreaterThan(projects);
  });

  it('one table row per displayable project, in rank order, with fit shape and word, licence and stars', () => {
    const rows = [...doc.querySelectorAll('section[aria-labelledby="projects-heading"] tbody tr')];
    expect(rows.map((r) => text(r.querySelector('th a')))).toEqual(['Listmonk', 'Keila', 'Mautic', 'Postal']);
    expect(rows[0].querySelector('.fit-tag[data-fit="full"]').textContent).toBe('Full');
    expect(text(rows[0])).toContain('AGPL-3.0');
    expect(text(rows[0])).toContain('17K');
    // Postal : pas de chiffres GitHub, un tiret titré, jamais 0.
    expect(text(rows[3])).not.toMatch(/\b0\b/);
    expect(rows[3].querySelector('span[title]')).not.toBeNull();
  });

  it('project links: /oss/ page only when indexable, else homepage in nofollow', () => {
    const links = [...doc.querySelectorAll('section[aria-labelledby="projects-heading"] tbody th a')];
    expect(links[0].getAttribute('href')).toBe('/en/oss/listmonk');
    expect(links[0].getAttribute('rel')).toBeNull();
    expect(links[1].getAttribute('href')).toBe('https://keila.example');
    expect(links[1].getAttribute('rel')).toBe('nofollow noopener');
  });

  it('each project names the SaaS of the category it replaces, linked', () => {
    const row = doc.querySelector('section[aria-labelledby="projects-heading"] tbody tr');
    const links = [...row.querySelectorAll('td a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/en/tools/mailchimp', '/en/tools/beehiiv']);
  });

  it('project tagline when written, nothing empty otherwise', () => {
    expect(text(doc.querySelector('section[aria-labelledby="projects-heading"] tbody tr th'))).toContain('Self-hosted newsletter manager.');
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    expect(main.match(/<(p|h2|h3|li|span|dd|td)([^>]*)>\s*<\/\1>/g)).toBeNull();
  });

  it('ItemList of SoftwareApplication for the projects, in rank order', () => {
    const list = jsonLd(doc).find((d) => d['@type'] === 'ItemList' && d.itemListElement[0].item);
    expect(list.itemListElement.map((i) => i.item.name)).toEqual(['Listmonk', 'Keila', 'Mautic', 'Postal']);
    expect(list.itemListElement[0].item['@type']).toBe('SoftwareApplication');
    expect(list.itemListElement[0].item.url).toBe('https://saasmadefree.com/en/oss/listmonk');
    expect(list.itemListElement[1].item.url).toBe('https://keila.example');
  });

  it('inactive cited projects: one quiet line with their status, outside n, table and JSON-LD', () => {
    const line = doc.querySelector('.inactive-projects');
    expect(text(line)).toContain('Ghosted (archived)');
    expect(text(line)).toMatch(/Oldy \(last commit Mar 2025\)/);
    expect(categoryInactiveProjects(VIEWS, PROJECTS, TODAY).map((i) => i.project.slug)).toEqual(['ghosted', 'oldy']);
    expect(html.match(/Ghosted/g).length).toBe(1);
  });

  it('fallback title under 3 projects, page still indexable while SaaS + projects ≥ 3', () => {
    const out = render({ toolViews: [VIEWS[0], VIEWS[2]] });
    const d = dom(out);
    expect(d.querySelector('title').textContent).toBe('Free & Open Source Newsletters & publishing Tools (2026)');
    expect(d.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('noindex,follow when SaaS + projects < 3', () => {
    const views = [VIEWS[2]];
    expect(categoryIndexable(views, categoryProjects(views, PROJECTS, TODAY))).toBe(false);
    expect(dom(render({ toolViews: views })).querySelector('meta[name="robots"]').getAttribute('content')).toBe('noindex,follow');
    expect(categoryIndexable(VIEWS, categoryProjects(VIEWS, PROJECTS, TODAY))).toBe(true);
    expect(doc.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('no project at all: a plain note, no table, no project ItemList', () => {
    const d = dom(render({ toolViews: [VIEWS[2]] }));
    expect(d.querySelector('section[aria-labelledby="projects-heading"] table')).toBeNull();
    expect(text(d.querySelector('section[aria-labelledby="projects-heading"]'))).toContain('No open source');
    expect(jsonLd(d).filter((x) => x['@type'] === 'ItemList')).toHaveLength(1);
  });

  it('works without projects passed (old callers): SaaS registry only', () => {
    const out = render({ projects: undefined });
    expect(dom(out).querySelectorAll('li.card')).toHaveLength(3);
  });

  it('French page: French title, tutoiement, Intl fr', () => {
    const fr = dom(render({ lang: 'fr' }));
    expect(fr.querySelector('title').textContent).toBe('Newsletters et publication : les 4 meilleurs outils gratuits et open source (2026)');
    expect(fr.documentElement.getAttribute('lang')).toBe('fr');
    expect(text(fr.querySelector('main'))).toContain('3 outils');
    expect(text(fr.querySelector('.inactive-projects'))).toContain('mars 2025');
  });

  it('escapes interpolated data', () => {
    const evil = new Map(PROJECTS);
    evil.set('listmonk', { ...PROJECTS.get('listmonk'), name: 'A<b>&"' });
    const out = render({ projects: evil });
    expect(out).not.toContain('<b>&"');
    expect(out).toContain('A&lt;b&gt;&amp;&quot;');
  });

  it('the project table scrolls in its own labelled frame', () => {
    const frame = doc.querySelector('section[aria-labelledby="projects-heading"] .table-scroll');
    expect(frame.getAttribute('role')).toBe('region');
    expect(frame.getAttribute('tabindex')).toBe('0');
    expect(doc.getElementById(frame.getAttribute('aria-labelledby'))).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Répertoire des catégories (/{lang}/categories/)
// ---------------------------------------------------------------------------
function renderIndex(over = {}) {
  const lang = over.lang ?? 'en';
  return renderCategoriesIndexPage({
    lang, path: `/${lang}/categories/`, categorySlugs: ['newsletter', 'tasks'], categories,
    countsBySlug: { newsletter: 3, tasks: 1 }, projectCountsBySlug: { newsletter: 4 },
    ui: UI[lang], alternates: [{ lang: 'en', path: '/en/categories/' }, { lang: 'fr', path: '/fr/categories/' }],
    xDefaultPath: '/en/categories/', homePath: `/${lang}/`, sponsorSlots: null, ...over,
  });
}

describe('D14 — répertoire des catégories', () => {
  const idx = dom(renderIndex());

  it('fil d’Ariane et BreadcrumbList', () => {
    expect(text(idx.querySelector('nav.crumbs'))).toBe('Directory / All categories');
    expect(jsonLd(idx).find((d) => d['@type'] === 'BreadcrumbList').itemListElement).toHaveLength(2);
  });

  it('titre, méta-description et h1', () => {
    expect(idx.querySelector('title').textContent).toBe(UI.en.categoriesIndex.titleTag);
    expect(idx.querySelector('meta[name="description"]').getAttribute('content')).toBe(UI.en.categoriesIndex.metaDescription);
    expect(text(idx.querySelector('h1'))).toBe('All categories');
  });

  it('chaque catégorie, liée à sa page (URL canonique, sans barre finale), avec son nombre d’outils', () => {
    const links = [...idx.querySelectorAll('main ul a')];
    // L'URL de la page est /en/categories/{slug} (canonical, sitemap) ; la
    // barre finale de l'ancien lien coûtait une redirection 308 (Task A8).
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/en/categories/newsletter', '/en/categories/tasks']);
    expect(text(links[0])).toContain('Newsletters & publishing');
    expect(text(links[0])).toContain('3 tools');
    expect(text(links[1])).toContain('1 tool');
  });

  it('le nombre de projets open source quand il y en a, rien sinon', () => {
    const links = [...idx.querySelectorAll('main ul a')];
    expect(text(links[0])).toContain('4 open source projects');
    expect(text(links[1])).not.toContain('open source');
  });

  it('Organization en JSON-LD, hreflang', () => {
    expect(jsonLd(idx).some((d) => d['@type'] === 'Organization')).toBe(true);
    expect(renderIndex()).toContain('hreflang="fr" href="https://saasmadefree.com/fr/categories/"');
  });

  it('emplacements vendus conservés', () => {
    const slots = { railLeft: '<aside class="sp-rail sp-left">L</aside>', railRight: '', tapeBottom: '<div class="sponsor-tape">T</div>', fallback: '' };
    const out = renderIndex({ sponsorSlots: slots });
    expect(out).toContain(slots.railLeft);
    expect(out).toContain(slots.tapeBottom);
  });

  it('en français', () => {
    const fr = dom(renderIndex({ lang: 'fr' }));
    expect(text(fr.querySelector('main ul a'))).toContain('4 projets open source');
  });
});
