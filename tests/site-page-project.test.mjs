import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import {
  renderProjectPage, projectPages, relatedProjects, projectDateModified,
} from '../scripts/lib/site-page-project.mjs';
import { renderToolPage } from '../scripts/lib/site-page-tool.mjs';
import { indexable, replacedTools } from '../scripts/lib/site-alternatives.mjs';
import { loadData } from '../scripts/lib/load-data.mjs';
import { sponsorContext, renderSponsorSlots } from '../scripts/lib/site-sponsors.mjs';

// Fiche projet /{lang}/oss/{slug} (Task A5, spec D2, D3, D7, D14, Ruling 20).
// Les chaînes viennent des vrais ui.json : une clé manquante en en ou fr
// casse ce test, pas seulement le build. Les textes des projets sont des
// fixtures : data/i18n/*/projects/ est encore vide (Partie B).
const uiOf = (lang) => JSON.parse(readFileSync(`data/i18n/${lang}/ui.json`, 'utf8'));
const UI = { en: uiOf('en'), fr: uiOf('fr') };

const TODAY = '2026-10-17';
const BUILD = '2026-10-17';
const LANGS = ['en', 'fr'];

const categories = {
  newsletter: { label: { en: 'Newsletters & publishing', fr: 'Newsletters et publication' } },
  tasks: { label: { en: 'Tasks', fr: 'Tâches' } },
};

const stats = (over) => ({ stars: 1000, lastCommit: '2026-10-01', createdAt: '2019-06-26', archived: false, checkedOn: '2026-10-15', ...over });
const project = (slug, over = {}) => ({
  slug, name: slug.charAt(0).toUpperCase() + slug.slice(1), homepage: `https://${slug}.example`, repo: `org/${slug}`,
  license: 'MIT', selfHostable: true, hosted: { exists: false }, deploy: [], stack: [], categories: ['newsletter'],
  markets: ['en'], stats: stats(), ...over,
});

// listmonk : chiffres frais, dépôt GitHub, déploiement et stack connus ;
// mautic : offre hébergée ; keila : chiffres périmés (77 jours) mais actif ;
// postal : pas de dépôt GitHub, donc aucun chiffre ; ghosted : archivé ;
// oldy : dernier commit il y a plus de 365 jours ; todo : autre catégorie.
const PROJECTS = new Map([
  // listmonk est le seul dont l'absence d'offre hébergée et l'auto-hébergement
  // ont été vérifiés (date et source) ; les autres gardent les valeurs par
  // défaut de la migration, qui ne s'affichent pas comme des faits.
  ['listmonk', project('listmonk', {
    name: 'Listmonk', homepage: 'https://listmonk.app', repo: 'knadh/listmonk', license: 'AGPL-3.0',
    selfHostableCheckedOn: '2026-10-12', selfHostableSource: 'https://listmonk.app/docs/installation/',
    hosted: { exists: false, checkedOn: '2026-10-12', source: 'https://listmonk.app' },
    deploy: ['docker', 'binary'], stack: ['go', 'vue', 'postgresql'],
    stats: stats({ stars: 17000, lastCommit: '2026-10-10', createdAt: '2019-06-26', checkedOn: '2026-10-16' }),
  })],
  ['mautic', project('mautic', {
    name: 'Mautic', stats: stats({ stars: 10787 }),
    hosted: { exists: true, priceFrom: 9, currency: 'USD', source: 'https://mautic.example/pricing', checkedOn: '2026-10-01' },
  })],
  ['keila', project('keila', { name: 'Keila', stats: stats({ stars: 1600, lastCommit: '2026-07-20', checkedOn: '2026-08-01' }) })],
  ['postal', project('postal', { name: 'Postal', repo: null, stats: undefined })],
  ['ghosted', project('ghosted', { name: 'Ghosted', stats: stats({ stars: 99999, archived: true }) })],
  ['oldy', project('oldy', { name: 'Oldy', stats: stats({ stars: 50000, lastCommit: '2025-03-04' }) })],
  ['sendy', project('sendy', { name: 'Sendy', stats: stats({ stars: 1600 }) })],
  ['todo', project('todo', { name: 'Todo', categories: ['tasks'], stats: stats({ stars: 80000 }) })],
]);
// postal est créé sans la clé stats (pas `stats: undefined`) : c'est la forme réelle.
delete PROJECTS.get('postal').stats;

const entry = (name, over = {}) => ({
  tagline: `${name} in one line.`,
  description: `${name} is a project.\n\nIt does things.`,
  strengths: [`${name} strength one`, `${name} strength two`, `${name} strength three`],
  limits: [`${name} limit one`, `${name} limit two`],
  bestFor: `People who want ${name}.`,
  ...over,
});
const PROJECT_I18N = new Map([
  ['en/listmonk', entry('Listmonk', { tagline: 'Self-hosted newsletter and mailing list manager.' })],
  ['fr/listmonk', entry('Listmonk', { tagline: 'Gestionnaire de newsletters auto-hébergé.', limits: ['Pas d’éditeur visuel', 'Pas d’envoi intégré'] })],
  ['en/mautic', entry('Mautic')],
  ['en/postal', entry('Postal')],
  ['en/ghosted', entry('Ghosted')],
  ['en/oldy', entry('Oldy')],
  ['en/keila', entry('Keila')],
  ['en/sendy', entry('Sendy')],
]);

const tool = (slug, over) => ({
  slug, name: slug.charAt(0).toUpperCase() + slug.slice(1), category: 'newsletter', verdict: 'kinda',
  pagePriority: 50, markets: ['en', 'fr'], relatedSlugs: [],
  pricing: { amount: 20, currency: 'USD', basis: 'flat-monthly', source: `https://${slug}.example/pricing`, checkedOn: '2026-07-30' },
  moatType: 'network', diyTimeEstimate: 'week', requirements: [], verifiedOneShot: false,
  ...over,
});
// Quatre fiches citent listmonk : le titre n'en nomme que trois, par pagePriority.
const TOOLS = new Map([
  ['mailchimp', tool('mailchimp', {
    pagePriority: 90, verdict: 'kinda',
    alternatives: [
      { project: 'listmonk', fit: 'full' }, { project: 'mautic', fit: 'partial' }, { project: 'keila', fit: 'partial' },
      { project: 'postal', fit: 'niche' }, { project: 'ghosted', fit: 'full' }, { project: 'oldy', fit: 'partial' },
    ],
  })],
  ['beehiiv', tool('beehiiv', { pagePriority: 80, verdict: 'yes', alternatives: [{ project: 'listmonk', fit: 'full' }], pricing: { amount: 39, currency: 'USD', basis: 'flat-monthly', source: 'https://beehiiv.example', checkedOn: '2026-07-30' } })],
  ['kit', tool('kit', { pagePriority: 70, verdict: 'no', alternatives: [{ project: 'listmonk', fit: 'partial' }] })],
  // Publiée en anglais seulement : pas de fiche /fr/tools/substack.
  ['substack', tool('substack', { pagePriority: 10, markets: ['en'], alternatives: [{ project: 'listmonk', fit: 'niche' }] })],
  ['todoist', tool('todoist', { category: 'tasks', alternatives: [{ project: 'todo', fit: 'full' }] })],
]);

const ctx = { projectI18n: PROJECT_I18N, tools: TOOLS, today: TODAY };
const PLAN = projectPages({ projects: PROJECTS, projectI18n: PROJECT_I18N, tools: TOOLS, langs: LANGS, today: TODAY });
const planFor = (lang, slug) => PLAN.find((p) => p.lang === lang && p.project.slug === slug);

function render(slug = 'listmonk', lang = 'en', over = {}) {
  const page = planFor(lang, slug);
  const p = PROJECTS.get(slug);
  return renderProjectPage({
    lang,
    path: `/${lang}/oss/${slug}`,
    project: p,
    i18nEntry: PROJECT_I18N.get(`${lang}/${slug}`),
    replaced: replacedTools(slug, TOOLS),
    related: relatedProjects(p, PROJECTS, TODAY),
    ui: UI[lang],
    alternates: page?.alternates ?? [],
    xDefaultPath: page?.xDefaultPath ?? null,
    homePath: `/${lang}/`,
    categories,
    categoryPath: `/${lang}/categories/${p.categories[0]}`,
    buildDate: BUILD,
    today: TODAY,
    indexable: indexable.project(p, lang, ctx),
    projectIndexable: (other) => indexable.project(other, lang, ctx),
    projectI18n: PROJECT_I18N,
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
const section = (doc, id) => doc.querySelector(`section[aria-labelledby="${id}"]`);
const factOf = (doc, label) => {
  const row = [...doc.querySelectorAll('.project-facts dl > div')].find((d) => text(d.querySelector('dt')) === label);
  return row?.querySelector('dd') ?? null;
};

const html = render();
const doc = dom(html);
const t = UI.en.site.project;
const tt = UI.en.site.tool;

describe('renderProjectPage — titre et méta', () => {
  it('title lists up to 3 replaced tools with Intl.ListFormat', () => {
    expect(doc.querySelector('title').textContent).toBe('Listmonk: Free Open Source Alternative to Mailchimp, Beehiiv, and Kit (2026)');
    const fr = dom(render('listmonk', 'fr'));
    expect(fr.querySelector('title').textContent).toBe('Listmonk : alternative open source gratuite à Mailchimp, Beehiiv et Kit (2026)');
  });

  it('l’année du titre vient de la date de build, jamais d’une constante', () => {
    const later = dom(render('listmonk', 'en', { buildDate: '2027-01-02' }));
    expect(later.querySelector('title').textContent).toContain('(2027)');
  });

  it('un seul outil remplacé : un seul nom, sans conjonction', () => {
    const one = dom(render('listmonk', 'en', { replaced: [TOOLS.get('kit')] }));
    expect(one.querySelector('title').textContent).toBe('Listmonk: Free Open Source Alternative to Kit (2026)');
  });

  it('aucun outil remplacé : la page se rend sans planter, sans section « Replaces »', () => {
    const none = dom(render('listmonk', 'en', { replaced: [] }));
    expect(none.querySelector('h1')).not.toBeNull();
    expect(section(none, 'replaces-heading')).toBeNull();
  });

  it('aucun outil remplacé : titre et description de repli avec la catégorie (Ruling 21)', () => {
    const en = dom(render('listmonk', 'en', { replaced: [] }));
    expect(en.querySelector('title').textContent).toBe('Listmonk: Free Open Source Newsletters & publishing Tool (2026)');
    expect(en.querySelector('meta[name="description"]').getAttribute('content')).toBe(
      'Listmonk is a free, open-source tool (Newsletters & publishing). Self-hosted newsletter and mailing list manager. See its license, its GitHub activity and what it won’t do.',
    );
    const fr = dom(render('listmonk', 'fr', { replaced: [] }));
    expect(fr.querySelector('title').textContent).toBe('Listmonk : outil open source gratuit (Newsletters et publication, 2026)');
    expect(fr.querySelector('meta[name="description"]').getAttribute('content')).toBe(
      'Listmonk est un outil gratuit et open source (Newsletters et publication). Gestionnaire de newsletters auto-hébergé. Sa licence, son activité sur GitHub et ce qu’il ne fera pas pour toi.',
    );
  });

  it('méta-description : le nom, les outils remplacés et l’accroche', () => {
    const desc = doc.querySelector('meta[name="description"]').getAttribute('content');
    expect(desc).toContain('Listmonk');
    expect(desc).toContain('Mailchimp, Beehiiv, and Kit');
    expect(desc).toContain('Self-hosted newsletter and mailing list manager.');
  });

  it('H1 = le nom du projet ; accroche en lede, description ensuite', () => {
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
    expect(text(doc.querySelector('h1'))).toBe('Listmonk');
    expect(text(doc.querySelector('.lede'))).toBe('Self-hosted newsletter and mailing list manager.');
    const paras = [...doc.querySelectorAll('.project-about p')].map(text);
    expect(paras).toEqual(['Listmonk is a project.', 'It does things.']);
  });

  it('fil d’Ariane annuaire › catégorie › projet, plus BreadcrumbList', () => {
    const crumbs = doc.querySelector('nav.crumbs');
    expect([...crumbs.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['/en/', '/en/categories/newsletter']);
    expect(text(crumbs.querySelector('[aria-current="page"]'))).toBe('Listmonk');
    const bc = jsonLd(doc).find((d) => d['@type'] === 'BreadcrumbList');
    expect(bc.itemListElement.map((i) => i.name)).toEqual([UI.en.site.directoryLabel, 'Newsletters & publishing', 'Listmonk']);
  });

  it('catégorie sans page dans la langue : le fil d’Ariane la nomme sans lien', () => {
    const noCat = dom(render('listmonk', 'en', { categoryPath: null }));
    expect([...noCat.querySelectorAll('nav.crumbs a')].map((a) => a.getAttribute('href'))).toEqual(['/en/']);
    expect(text(noCat.querySelector('nav.crumbs'))).toContain('Newsletters & publishing');
  });

  it('page indexable : aucune balise robots ; hreflang sur les seules langues rédigées', () => {
    expect(doc.querySelector('meta[name="robots"]')).toBeNull();
    expect(doc.querySelector('link[rel="alternate"][hreflang="fr"]').getAttribute('href')).toBe('https://saasmadefree.com/fr/oss/listmonk');
    expect(doc.querySelector('link[rel="alternate"][hreflang="x-default"]').getAttribute('href')).toBe('https://saasmadefree.com/en/oss/listmonk');
  });
});

describe('renderProjectPage — JSON-LD', () => {
  it('json-ld SoftwareApplication with license and codeRepository', () => {
    const app = jsonLd(doc).find((d) => d['@type'] === 'SoftwareApplication');
    expect(app.name).toBe('Listmonk');
    expect(app.url).toBe('https://saasmadefree.com/en/oss/listmonk');
    expect(app.sameAs).toBe('https://listmonk.app');
    expect(app.license).toBe('https://spdx.org/licenses/AGPL-3.0.html');
    expect(app.codeRepository).toBe('https://github.com/knadh/listmonk');
    expect(app.applicationCategory).toBe('Newsletters & publishing');
    // Pas d'offre hébergée : gratuit, comme sur la fiche outil.
    expect(app.offers).toEqual({ '@type': 'Offer', price: 0, priceCurrency: 'USD' });
  });

  it('codeRepository absent quand repo vaut null', () => {
    const app = jsonLd(dom(render('postal'))).find((d) => d['@type'] === 'SoftwareApplication');
    expect(app).toBeDefined();
    expect('codeRepository' in app).toBe(false);
  });

  it('offre hébergée : aucun prix gratuit affirmé', () => {
    const app = jsonLd(dom(render('mautic'))).find((d) => d['@type'] === 'SoftwareApplication');
    expect(app.offers).toBeUndefined();
  });

  it('« pas d’offre hébergée » jamais vérifié : aucun prix gratuit affirmé non plus', () => {
    const app = jsonLd(dom(render('keila'))).find((d) => d['@type'] === 'SoftwareApplication');
    expect(app.offers).toBeUndefined();
    const list = jsonLd(doc).find((d) => d['@type'] === 'ItemList');
    expect(list.itemListElement.every((i) => i.item.offers === undefined)).toBe(true);
  });

  it('WebPage daté du relevé le plus récent (chiffres GitHub ou prix hébergé), pas du build', () => {
    const page = jsonLd(doc).find((d) => d['@type'] === 'WebPage');
    expect(page.dateModified).toBe('2026-10-16');
    expect(projectDateModified(PROJECTS.get('mautic'))).toBe('2026-10-15');
    expect(projectDateModified(PROJECTS.get('postal'))).toBeNull();
    const postalPage = jsonLd(dom(render('postal'))).find((d) => d['@type'] === 'WebPage');
    expect('dateModified' in postalPage).toBe(false);
  });

  it('les projets liés en ItemList de SoftwareApplication', () => {
    const list = jsonLd(doc).find((d) => d['@type'] === 'ItemList');
    expect(list.itemListElement.map((i) => i.item.name)).toEqual(['Mautic', 'Keila', 'Sendy', 'Postal']);
  });
});

describe('renderProjectPage — faits en tête', () => {
  it('licence, étoiles, dernier commit, âge, self-host, offre hébergée, site et dépôt', () => {
    const facts = doc.querySelector('.project-facts');
    expect(facts).not.toBeNull();
    expect(html.indexOf('class="project-facts"')).toBeLessThan(html.indexOf('id="replaces-heading"'));
    expect(text(factOf(doc, tt.colLicense))).toBe('AGPL-3.0');
    expect(text(factOf(doc, tt.colStars))).toBe('17K');
    expect(text(factOf(doc, tt.colLastCommit))).toBe('Oct 2026');
    expect(text(factOf(doc, t.startedLabel))).toBe('Jun 2019');
    expect(text(factOf(doc, tt.colSelfHost))).toBe(tt.selfHostYes);
    expect(text(factOf(doc, tt.colHosted))).toContain(tt.hostedNone);
    expect(factOf(doc, tt.colHosted).querySelector('a').getAttribute('href')).toBe('https://listmonk.app');
    expect(text(factOf(doc, tt.colHosted))).toContain(tt.checkedOnTemplate.replace('{date}', 'October 12, 2026'));
    expect(factOf(doc, t.websiteLabel).querySelector('a').getAttribute('href')).toBe('https://listmonk.app');
    expect(factOf(doc, t.repoLabel).querySelector('a').getAttribute('href')).toBe('https://github.com/knadh/listmonk');
    expect(text(factOf(doc, t.deployLabel))).toBe('docker, binary');
    expect(text(factOf(doc, t.stackLabel))).toBe('go, vue, postgresql');
    expect(text(facts)).toContain(interpolateAsOf('October 16, 2026'));
  });

  it('chiffres périmés (> 45 jours) : un tiret avec un title, jamais 0 ni le vieux chiffre', () => {
    const keila = dom(render('keila'));
    for (const label of [tt.colStars, tt.colLastCommit]) {
      const dd = factOf(keila, label);
      expect(text(dd)).toBe('—');
      expect(dd.querySelector('[title]').getAttribute('title')).toBe(interpolateAsOf('August 1, 2026'));
    }
    expect(text(keila.querySelector('.project-facts'))).not.toContain('1.6K');
  });

  it('pas de dépôt GitHub : tirets titrés, ni dépôt ni âge, jamais 0', () => {
    const postal = dom(render('postal'));
    for (const label of [tt.colStars, tt.colLastCommit]) {
      const dd = factOf(postal, label);
      expect(text(dd)).toBe('—');
      expect(dd.querySelector('[title]').getAttribute('title')).toBe(tt.noGithubFigures);
    }
    expect(factOf(postal, t.repoLabel)).toBeNull();
    expect(factOf(postal, t.startedLabel)).toBeNull();
    expect(text(postal.querySelector('.project-facts'))).not.toMatch(/\b0\b/);
  });

  it('offre hébergée : prix, source cliquable et date de vérification ; listes vides tues', () => {
    const mautic = dom(render('mautic'));
    const dd = factOf(mautic, tt.colHosted);
    expect(text(dd)).toContain('From $9');
    expect(dd.querySelector('a').getAttribute('href')).toBe('https://mautic.example/pricing');
    expect(text(dd)).toContain('October 1, 2026');
    expect(factOf(mautic, t.deployLabel)).toBeNull();
    expect(factOf(mautic, t.stackLabel)).toBeNull();
  });
});

function interpolateAsOf(date) {
  return tt.statsAsOf.replace('{date}', date);
}

describe('renderProjectPage — pièces A à D', () => {
  it('replaces links point to tool pages', () => {
    const replaces = section(doc, 'replaces-heading');
    expect(text(replaces.querySelector('h2'))).toBe(t.replacesHeading);
    const links = [...replaces.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/en/tools/mailchimp', '/en/tools/beehiiv', '/en/tools/kit', '/en/tools/substack']);
  });

  it('chaque outil remplacé porte son verdict (forme et mot), son prix et l’adéquation', () => {
    const items = [...section(doc, 'replaces-heading').querySelectorAll('li')];
    expect(items).toHaveLength(4);
    expect(items[0].querySelector('.badge.kinda')).not.toBeNull();
    expect(text(items[0])).toContain(UI.en.site.verdicts.kinda.label);
    expect(text(items[0])).toContain('$20/mo');
    expect(items[0].querySelector('.fit-tag[data-fit="full"]')).not.toBeNull();
    expect(text(items[1])).toContain(UI.en.site.verdicts.yes.label);
    expect(text(items[1])).toContain('$39/mo');
    expect(text(items[2])).toContain(UI.en.site.verdicts.no.label);
  });

  it('un outil remplacé sans fiche dans la langue est nommé, sans lien mort', () => {
    const fr = dom(render('listmonk', 'fr'));
    const replaces = section(fr, 'replaces-heading');
    expect([...replaces.querySelectorAll('a')].map((a) => a.getAttribute('href')))
      .toEqual(['/fr/tools/mailchimp', '/fr/tools/beehiiv', '/fr/tools/kit']);
    expect(text(replaces)).toContain('Substack');
    expect(text(replaces)).toContain(UI.fr.site.verdicts.kinda.label);
  });

  it('forces : toutes, dans l’ordre', () => {
    const items = [...section(doc, 'strengths-heading').querySelectorAll('li')].map(text);
    expect(items).toEqual(['Listmonk strength one', 'Listmonk strength two', 'Listmonk strength three']);
  });

  it('limits section always rendered', () => {
    for (const [slug, lang] of [['listmonk', 'en'], ['listmonk', 'fr'], ['postal', 'en'], ['ghosted', 'en']]) {
      const d = dom(render(slug, lang));
      const limits = section(d, 'limits-heading');
      expect(limits, `${lang}/${slug}`).not.toBeNull();
      expect(text(limits.querySelector('h2'))).toBe(UI[lang].site.project.limitsHeading);
      expect([...limits.querySelectorAll('li')].map(text)).toEqual(PROJECT_I18N.get(`${lang}/${slug}`).limits);
    }
  });

  it('pour qui : la phrase bestFor', () => {
    expect(text(section(doc, 'bestfor-heading'))).toContain('People who want Listmonk.');
  });

  it('ordre : faits → remplace → forces → limites → pour qui → projets liés', () => {
    const order = ['class="project-facts"', 'id="replaces-heading"', 'id="strengths-heading"', 'id="limits-heading"', 'id="bestfor-heading"', 'id="related-heading"']
      .map((needle) => html.indexOf(needle));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('aucun panneau moutarde : la moutarde appartient aux verdicts des fiches outil', () => {
    expect(doc.querySelector('.verdict-badge')).toBeNull();
  });
});

describe('renderProjectPage — projets liés', () => {
  it('même catégorie, affichables, sans soi, par étoiles décroissantes puis slug, 6 au plus', () => {
    const related = relatedProjects(PROJECTS.get('listmonk'), PROJECTS, TODAY);
    expect(related.map((p) => p.slug)).toEqual(['mautic', 'keila', 'sendy', 'postal']);
    const many = new Map(PROJECTS);
    for (let i = 0; i < 9; i += 1) many.set(`p${i}`, project(`p${i}`, { stats: stats({ stars: i }) }));
    expect(relatedProjects(PROJECTS.get('listmonk'), many, TODAY)).toHaveLength(6);
  });

  it('titre « Other projects in {category} » et lien vers /oss/ seulement si indexable, sinon site en nofollow', () => {
    const rel = section(doc, 'related-heading');
    expect(text(rel.querySelector('h2'))).toBe(t.relatedHeading.replace('{category}', 'Newsletters & publishing'));
    const anchors = [...rel.querySelectorAll('a')];
    const mautic = anchors.find((a) => text(a).includes('Mautic'));
    expect(mautic.getAttribute('href')).toBe('/en/oss/mautic');
    expect(mautic.getAttribute('rel')).toBeNull();
    // sendy : rédigé mais cité par aucune fiche, donc pas indexable.
    const sendy = anchors.find((a) => text(a).includes('Sendy'));
    expect(sendy.getAttribute('href')).toBe('https://sendy.example');
    expect(sendy.getAttribute('rel')).toContain('nofollow');
  });

  it('aucun projet lié : pas de section', () => {
    const none = dom(render('listmonk', 'en', { related: [] }));
    expect(section(none, 'related-heading')).toBeNull();
  });
});

describe('renderProjectPage — projets inactifs (Ruling 20)', () => {
  it('archivé : noindex,follow et un avis en tête', () => {
    const d = dom(render('ghosted'));
    expect(d.querySelector('meta[name="robots"]').getAttribute('content')).toBe('noindex,follow');
    const notice = d.querySelector('.project-notice');
    expect(text(notice)).toBe(t.archivedNotice);
    expect(render('ghosted').indexOf('class="project-notice"')).toBeLessThan(render('ghosted').indexOf('class="project-facts"'));
  });

  it('sans commit depuis plus de 365 jours : noindex,follow et le mois du dernier commit', () => {
    const d = dom(render('oldy'));
    expect(d.querySelector('meta[name="robots"]').getAttribute('content')).toBe('noindex,follow');
    expect(text(d.querySelector('.project-notice'))).toBe(t.staleNoticeTemplate.replace('{date}', 'March 2025'));
    const fr = UI.fr.site.project.staleNoticeTemplate;
    expect(fr).toContain('{date}');
  });

  it('projet actif : aucun avis', () => {
    expect(doc.querySelector('.project-notice')).toBeNull();
  });

  it('rédigé et actif mais cité par aucune fiche : noindex, sans avis', () => {
    const d = dom(render('sendy', 'en', { replaced: [] }));
    expect(d.querySelector('meta[name="robots"]').getAttribute('content')).toBe('noindex,follow');
    expect(d.querySelector('.project-notice')).toBeNull();
  });
});

describe('renderProjectPage — langue sans texte', () => {
  it('noindex when no i18n text in lang', () => {
    // Sans texte dans la langue, la page n'est pas générée du tout.
    expect(render('mautic', 'fr', { i18nEntry: undefined })).toBeNull();
    expect(planFor('fr', 'mautic')).toBeUndefined();
    expect(planFor('en', 'mautic').alternates).toEqual([{ lang: 'en', path: '/en/oss/mautic', indexable: true }]);
  });
});

describe('renderProjectPage — habillage', () => {
  it('emplacements vendus conservés, sans le mot « Sponsor »', async () => {
    const data = await loadData(process.cwd());
    const slots = renderSponsorSlots(sponsorContext({
      placements: data.sponsors.placements, today: TODAY, lang: 'en', ui: UI.en, favicons: {}, sponsorHref: '/en/sponsor',
    }));
    const withSlots = render('listmonk', 'en', { sponsorSlots: slots });
    for (const part of ['railLeft', 'railRight', 'tapeBottom', 'fallback']) {
      if (slots[part]) expect(withSlots, part).toContain(slots[part]);
    }
    const body = withSlots.slice(withSlots.indexOf('<main'), withSlots.indexOf('</main>'));
    expect(body).not.toMatch(/sponsor/i);
  });

  it('échappe toute donnée interpolée', () => {
    const evil = { ...PROJECTS.get('listmonk'), name: 'A<b>&"' };
    const out = render('listmonk', 'en', { project: evil, i18nEntry: entry('X', { tagline: '<script>x</script>', limits: ['<i>no</i>', 'b'] }) });
    expect(out).not.toContain('<b>&"');
    expect(out).not.toContain('<script>x</script>');
    expect(out).not.toContain('<i>no</i>');
    expect(out).toContain('A&lt;b&gt;&amp;&quot;');
  });

  it('aucun élément de texte vide dans <main>', () => {
    for (const slug of ['listmonk', 'postal', 'mautic', 'ghosted']) {
      const h = render(slug);
      const main = h.slice(h.indexOf('<main'), h.indexOf('</main>'));
      expect(main.match(/<(p|h2|h3|li|span|dd)([^>]*)>\s*<\/\1>/g), slug).toBeNull();
    }
  });
});

describe('projectPages — ensemble des pages et cohérence avec les fiches', () => {
  it('une page par langue publiée où le texte existe, indexable selon indexable.project', () => {
    const keys = PLAN.map((p) => `${p.lang}/${p.project.slug}`).sort();
    expect(keys).toEqual(['en/ghosted', 'en/keila', 'en/listmonk', 'en/mautic', 'en/oldy', 'en/postal', 'en/sendy', 'fr/listmonk']);
    for (const page of PLAN) {
      expect(page.path).toBe(`/${page.lang}/oss/${page.project.slug}`);
      expect(page.indexable).toBe(indexable.project(page.project, page.lang, ctx));
      expect(page.i18nEntry).toBe(PROJECT_I18N.get(`${page.lang}/${page.project.slug}`));
    }
    expect(planFor('en', 'ghosted').indexable).toBe(false);
    expect(planFor('en', 'sendy').indexable).toBe(false);
    expect(planFor('en', 'listmonk').indexable).toBe(true);
    expect(planFor('en', 'listmonk').alternates).toEqual([{ lang: 'en', path: '/en/oss/listmonk', indexable: true }, { lang: 'fr', path: '/fr/oss/listmonk', indexable: true }]);
    expect(planFor('fr', 'listmonk').xDefaultPath).toBe('/en/oss/listmonk');
  });

  it('un texte dans une langue non publiée ne crée aucune page', () => {
    const i18n = new Map([...PROJECT_I18N, ['de/listmonk', entry('Listmonk')]]);
    const plan = projectPages({ projects: PROJECTS, projectI18n: i18n, tools: TOOLS, langs: LANGS, today: TODAY });
    expect(plan.some((p) => p.lang === 'de')).toBe(false);
    expect(plan.find((p) => p.lang === 'en' && p.project.slug === 'listmonk').alternates.map((a) => a.lang)).toEqual(['en', 'fr']);
  });

  it('chaque lien /oss/ d’une fiche outil ou d’une page projet pointe vers une page générée', () => {
    const generated = new Set(PLAN.map((p) => p.path));
    const links = [];
    for (const lang of LANGS) {
      const projectIndexable = (p) => indexable.project(p, lang, ctx);
      for (const tl of [...TOOLS.values()].filter((x) => x.markets.includes(lang))) {
        const out = renderToolPage({
          lang, path: `/${lang}/tools/${tl.slug}`, tool: tl,
          i18nEntry: {
            verdictSummary: 's', coreLoopDIY: 'c', whatYouLose: ['l'], whyPeopleStillPay: 'w', prompt: 'p',
            faq: [{ q: 'q', a: 'a' }],
          },
          categories, ui: UI[lang], alternates: [], xDefaultPath: null, homePath: `/${lang}/`,
          categoryPath: `/${lang}/categories/${tl.category}`, relatedTools: [], voteCount: null, favicons: {},
          agents: [], sponsorSlots: null, buildDate: BUILD, projects: PROJECTS, projectI18n: PROJECT_I18N,
          today: TODAY, projectIndexable,
        });
        links.push(...[...out.matchAll(/href="(\/[a-z]{2}\/oss\/[^"]+)"/g)].map((m) => m[1]));
      }
    }
    for (const page of PLAN) {
      const out = render(page.project.slug, page.lang);
      links.push(...[...out.matchAll(/href="(\/[a-z]{2}\/oss\/[^"]+)"/g)].map((m) => m[1]));
    }
    // build-site lie une fiche à une page projet d'après cet ensemble : il
    // doit coïncider avec la porte indexable.project pour chaque paire.
    const indexablePaths = new Set(PLAN.filter((p) => p.indexable).map((p) => p.path));
    for (const lang of LANGS) {
      for (const p of PROJECTS.values()) {
        expect(indexablePaths.has(`/${lang}/oss/${p.slug}`), `${lang}/${p.slug}`).toBe(indexable.project(p, lang, ctx));
      }
    }
    expect(links.length).toBeGreaterThan(0);
    expect(links).toContain('/en/oss/listmonk');
    expect(links).toContain('/fr/oss/listmonk');
    for (const href of links) expect(generated.has(href), href).toBe(true);
  });
});

describe('renderProjectPage — valeurs non vérifiées (finding 2)', () => {
  it('auto-hébergeable et offre hébergée par défaut : un tiret titré, jamais « Oui » ni « Aucune »', () => {
    const keila = dom(render('keila'));
    for (const label of [tt.colSelfHost, tt.colHosted]) {
      expect(text(factOf(keila, label))).toBe('—');
      expect(factOf(keila, label).querySelector('[title]').getAttribute('title')).toBe(tt.notCheckedYet);
    }
  });

  it('une offre hébergée vérifiée garde son prix, même sans auto-hébergement vérifié', () => {
    const mautic = dom(render('mautic'));
    expect(text(factOf(mautic, tt.colHosted))).toContain(tt.hostedFromTemplate.replace('{price}', '$9'));
    expect(text(factOf(mautic, tt.colSelfHost))).toBe('—');
  });
});

// Ruling 34 : le pied de page ne lie une collection que si build-site l'a
// déclarée indexable dans la langue (collectionPlan) — et toujours le hub.
describe('Ruling 34 — liens de collection du pied de page', () => {
  const footer = (page) => page.slice(page.indexOf('<footer'), page.indexOf('</footer>'));
  it('self-hosted noindex : aucun lien ; indexable : lié ; build-tonight lié s’il est indexable', () => {
    const off = footer(render('listmonk', 'en', { collectionLinks: ['build-tonight'] }));
    expect(off).not.toContain('/collections/self-hosted');
    expect(off).toContain('/collections/build-tonight');
    expect(off).toContain('/alternatives/"');
    const on = footer(render('listmonk', 'en', { collectionLinks: ['self-hosted', 'build-tonight'] }));
    expect(on).toContain('/collections/self-hosted');
    expect(on).toContain('/collections/build-tonight');
  });
});
