import { escapeHtml, renderLayout, renderBreadcrumb, verdictBadge } from './site-html.mjs';
import { categoryLabel, SITE_ORIGIN } from './site-data.mjs';
import { formatMonthlyPrice, formatDate, interpolate } from './site-format.mjs';
import {
  organizationJsonLd, breadcrumbJsonLd, softwareItemListJsonLd, webPageJsonLd, languageVersions,
} from './site-seo.mjs';
import {
  indexable as gates, isDisplayableProject, statsAreFresh, noHostedOfferChecked, checkedDates,
} from './site-alternatives.mjs';
import {
  projectLink, projectTagline, projectStatCells, renderFactGrid, fitTag, renderCompareLinks,
  sourceHost, monthYear, externalLink as ext, hostedCell, selfHostCell,
} from './site-page-tool.mjs';

// Fiche projet /{lang}/oss/{slug} (spec D2, D3, D7, D14 ; Ruling 20).
// Calquée sur le type de page qui rapporte le plus de trafic par page à
// openalternative.co (« {P}: Free Open Source Alternative to X, Y and Z »),
// avec ce qu'ils n'ont pas : les limites du projet, toujours affichées, et le
// lien vers nos fiches outil avec leur verdict.
//
// Ordre : en-tête (fil d'Ariane, eyebrow, H1, accroche, description) avec les
// faits en colonne à droite sur grand écran → A « Ce qu'il remplace » →
// B « Forces » et C « Ce qu'il ne fera pas » côte à côte → D « Pour qui » →
// projets de la même catégorie. Page calme : aucun panneau moutarde, la
// moutarde reste aux verdicts des fiches outil.
//
// Honnêteté (D3) : un chiffre GitHub périmé (> 45 jours) ou absent s'affiche
// en tiret titré, jamais à 0 ; le prix hébergé n'apparaît que si l'offre
// existe, avec sa source et sa date ; codeRepository seulement avec un dépôt.

/** Au plus ce nombre de projets dans « Autres projets de la catégorie ». */
export const MAX_RELATED_PROJECTS = 6;

/**
 * Pages projet à générer : une par langue publiée (`langs`, dérivé de
 * siteLanguages) où le texte data/i18n/{lang}/projects/{slug}.json existe.
 * Sans texte, pas de page dans cette langue, et la langue sort des hreflang.
 * `indexable` est exactement la porte que les fiches outil consultent avant
 * de lier /{lang}/oss/{slug} (Ruling 18) : une page non indexable est
 * générée quand même, en noindex,follow et hors sitemap (D7, Ruling 20).
 * @param {{ projects: Map<string, object>, projectI18n: Map<string, object>,
 *   tools: Map<string, object>|object[], langs: string[], today: string }} ctx
 * @returns {Array<{ lang: string, project: object, i18nEntry: object, path: string,
 *   alternates: Array<{lang:string,path:string,indexable:boolean}>, xDefaultPath: string, indexable: boolean }>}
 */
export function projectPages({ projects, projectI18n, tools, langs, today }) {
  const pages = [];
  for (const project of projects.values()) {
    const written = langs.filter((lang) => projectI18n.has(`${lang}/${project.slug}`));
    if (written.length === 0) continue;
    // Chaque version porte sa porte D7 : renderLayout n'annonce en hreflang
    // que les versions indexables (Ruling 29).
    const alternates = languageVersions(
      written, (lang) => `/${lang}/oss/${project.slug}`,
      (lang) => gates.project(project, lang, { projectI18n, tools, today }),
    );
    const xDefaultPath = (alternates.find((a) => a.lang === 'en') ?? alternates[0]).path;
    for (const { lang, path, indexable } of alternates) {
      pages.push({
        lang, project, path, alternates, xDefaultPath, indexable,
        i18nEntry: projectI18n.get(`${lang}/${project.slug}`),
      });
    }
  }
  return pages;
}

/**
 * Projets de la même catégorie (la première du projet), affichables, sans
 * le projet lui-même, par étoiles décroissantes puis slug (comparaison
 * binaire : même ordre sur toutes les machines). Un projet sans chiffres
 * GitHub passe après tous ceux qui en ont : on ne lui invente pas un rang.
 * @returns {object[]} au plus MAX_RELATED_PROJECTS projets
 */
export function relatedProjects(project, projects, today, limit = MAX_RELATED_PROJECTS) {
  const category = project.categories[0];
  const stars = (p) => p.stats?.stars ?? -1;
  return [...projects.values()]
    .filter((p) => p.slug !== project.slug && p.categories.includes(category) && isDisplayableProject(p, today))
    .sort((a, b) => stars(b) - stars(a) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, limit);
}

/** Date de dernière modification réelle d'une page projet : le plus récent
 *  des relevés qu'elle affiche (chiffres GitHub, offre hébergée,
 *  auto-hébergement). null si le projet n'a aucun relevé daté : on ne met pas
 *  la date du build à la place. */
export function projectDateModified(project) {
  const dates = checkedDates(project);
  return dates.length ? dates.reduce((max, d) => (d > max ? d : max)) : null;
}

/** Ruling 20 : un projet archivé, ou sans commit depuis plus de 365 jours,
 *  garde sa page (noindex) et le dit en tête, en toutes lettres. */
function renderNotice(project, lang, p, today) {
  if (isDisplayableProject(project, today)) return '';
  const message = project.stats.archived === true
    ? p.archivedNotice
    : interpolate(p.staleNoticeTemplate, { date: monthYear(project.stats.lastCommit, lang, 'long') });
  return `    <p class="project-notice" role="note">${escapeHtml(message)}</p>\n\n`;
}

/** Les faits, en tête : tout ce que l'on sait du projet, rien d'inventé. */
function renderFacts({ project, lang, p, t, today }) {
  const { stars, commit } = projectStatCells(project, lang, t, today);
  const hosted = hostedCell(project, lang, t);
  const github = project.repo ? `https://github.com/${project.repo}` : null;
  const rows = [
    [t.colLicense, project.license ? escapeHtml(project.license) : '—'],
    [t.colStars, stars],
    [t.colLastCommit, commit],
    // La date de création ne bouge pas : elle reste vraie même quand les
    // chiffres vivants sont trop vieux pour être montrés.
    project.stats?.createdAt ? [p.startedLabel, escapeHtml(monthYear(project.stats.createdAt, lang))] : null,
    [t.colSelfHost, selfHostCell(project, t)],
    [t.colHosted, hosted],
    project.deploy?.length ? [p.deployLabel, escapeHtml(project.deploy.join(', '))] : null,
    project.stack?.length ? [p.stackLabel, escapeHtml(project.stack.join(', '))] : null,
    [p.websiteLabel, ext(project.homepage, sourceHost(project.homepage))],
    github ? [p.repoLabel, ext(github, project.repo)] : null,
  ].filter(Boolean);
  const asOf = statsAreFresh(project, today)
    ? `\n        <p class="hint">${escapeHtml(interpolate(t.statsAsOf, { date: formatDate(project.stats.checkedOn, lang) }))}.</p>`
    : '';
  return `      <div class="project-facts" role="group" aria-labelledby="facts-heading">
        <p class="label" id="facts-heading">${escapeHtml(p.factsHeading)}</p>
${renderFactGrid(rows)}${asOf}
      </div>`;
}

/** A — les fiches outil qui citent le projet, avec leur verdict (forme et
 *  mot), leur prix et l'adéquation du projet. Une fiche non publiée dans la
 *  langue est nommée sans lien : pas de lien vers une page qui n'existe pas. */
function renderReplaces({ project, replaced, lang, s, t, p }) {
  if (replaced.length === 0) return '';
  const items = replaced.map((tool) => {
    const fit = (tool.alternatives ?? []).find((alt) => alt.project === project.slug)?.fit;
    const inner = `<span class="related-card-name">${escapeHtml(tool.name)}</span>
            ${verdictBadge(tool.verdict, s.verdicts[tool.verdict].label)}
            <span class="related-card-meta">${escapeHtml(formatMonthlyPrice(tool.pricing, lang))}${fit ? ` &middot; <span title="${escapeHtml(t.fitLegend[fit])}">${fitTag(fit, t)}</span>` : ''}</span>`;
    const body = tool.markets?.includes(lang)
      ? `<a href="/${lang}/tools/${escapeHtml(tool.slug)}">
            ${inner}
          </a>`
      : `<span class="related-card-static">
            ${inner}
          </span>`;
    return `        <li class="related-card">
          ${body}
        </li>`;
  });
  return `

    <section aria-labelledby="replaces-heading">
      <h2 id="replaces-heading">${escapeHtml(p.replacesHeading)}</h2>
      <p class="intro">${escapeHtml(interpolate(p.replacesIntro, { name: project.name }))}</p>
      <ul class="related-cards">
${items.join('\n')}
      </ul>
    </section>`;
}

/** B et C côte à côte sur grand écran : les forces, puis ce que le projet ne
 *  fera pas — toujours rendu (les limites sont obligatoires au schéma). */
function renderProsCons(i18nEntry, p) {
  const list = (cls, items) => `<ul class="lose-list ${cls}">
${items.map((item) => `          <li>${escapeHtml(item)}</li>`).join('\n')}
        </ul>`;
  return `

    <div class="pro-con">
      <section aria-labelledby="strengths-heading">
        <h2 id="strengths-heading">${escapeHtml(p.strengthsHeading)}</h2>
        ${list('gain-list', i18nEntry.strengths ?? [])}
      </section>
      <section aria-labelledby="limits-heading">
        <h2 id="limits-heading">${escapeHtml(p.limitsHeading)}</h2>
        ${list('limit-list', i18nEntry.limits ?? [])}
      </section>
    </div>`;
}

function renderRelated({ related, lang, t, p, catLabel, projectI18n, isIndexable, today }) {
  if (related.length === 0) return '';
  const cards = related.map((other) => {
    const link = projectLink(other, lang, isIndexable);
    const meta = [other.license ? escapeHtml(other.license) : null];
    if (statsAreFresh(other, today)) {
      const compact = new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 });
      meta.push(escapeHtml(interpolate(t.starsTemplate, { count: compact.format(other.stats.stars) })));
    }
    const tagline = projectTagline(other, lang, projectI18n);
    const metaText = meta.filter(Boolean).join(' &middot; ');
    return `        <li class="related-card">
          <a href="${escapeHtml(link.href)}"${link.rel}>
            <span class="related-card-name">${escapeHtml(other.name)}</span>${metaText ? `
            <span class="related-card-meta">${metaText}</span>` : ''}${tagline ? `
            <span class="related-card-what">${tagline}</span>` : ''}
          </a>
        </li>`;
  });
  return `

    <section aria-labelledby="related-heading">
      <h2 id="related-heading">${escapeHtml(interpolate(p.relatedHeading, { category: catLabel }))}</h2>
      <ul class="related-cards">
${cards.join('\n')}
      </ul>
    </section>`;
}

/** SoftwareApplication du projet. Une offre gratuite n'est affirmée que
 *  si l'absence de version hébergée payante a été vérifiée, comme sur la
 *  fiche outil (finding 2) ; le dépôt
 *  seulement s'il est sur GitHub ; la licence en URL SPDX. */
function softwareApplicationJsonLd({ project, path, catLabel, description }) {
  const app = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: project.name,
    url: `${SITE_ORIGIN}${path}`,
    sameAs: project.homepage,
    description,
    applicationCategory: catLabel,
  };
  if (project.license) app.license = `https://spdx.org/licenses/${project.license}.html`;
  if (project.repo) app.codeRepository = `https://github.com/${project.repo}`;
  if (noHostedOfferChecked(project)) app.offers = { '@type': 'Offer', price: 0, priceCurrency: 'USD' };
  return app;
}

/**
 * Fiche projet. Renvoie null sans texte dans la langue (`i18nEntry` absent) :
 * la page n'est alors pas écrite du tout.
 *
 * @param {object} opts
 * @param {string} opts.lang
 * @param {string} opts.path  '/{lang}/oss/{slug}'
 * @param {object} opts.project  data/projects/{slug}.json
 * @param {object} [opts.i18nEntry]  data/i18n/{lang}/projects/{slug}.json
 * @param {object[]} opts.replaced  replacedTools(slug, tools) : fiches qui le citent
 * @param {object[]} opts.related  relatedProjects(project, projects, today)
 * @param {object} opts.ui  ui.json de la langue
 * @param {Array<{lang:string,path:string}>} opts.alternates  langues rédigées seulement
 * @param {string|null} opts.xDefaultPath
 * @param {string} opts.homePath
 * @param {object} opts.categories  data/categories.json
 * @param {string|null} [opts.categoryPath]  page de la catégorie dans la langue, null si elle n'existe pas
 * @param {string} opts.buildDate  'YYYY-MM-DD' (année du titre)
 * @param {string} opts.today  'YYYY-MM-DD' (fraîcheur des chiffres, activité)
 * @param {boolean} opts.indexable  indexable.project(project, lang, …) : sinon noindex,follow
 * @param {(project: object) => boolean} [opts.projectIndexable]  même porte, pour les projets liés
 * @param {Map<string, object>} [opts.projectI18n]  accroches des projets liés
 * @param {object|null} [opts.sponsorSlots]  emplacements vendus, rendus par renderSponsorSlots
 * @param {Array<{href:string,label:string}>} [opts.comparisons]  comparatifs générés
 *   dans la langue où le projet figure (compareLinksFor) ; vide, aucune section
 */
export function renderProjectPage({
  lang, path, project, i18nEntry, replaced = [], related = [], ui, alternates = [], xDefaultPath = null,
  homePath, categories = {}, categoryPath = null, buildDate, today, indexable = false,
  projectIndexable = () => false, projectI18n = new Map(), sponsorSlots = null, comparisons = [],
}) {
  if (!i18nEntry) return null;
  const s = ui.site;
  const p = s.project;
  const t = s.tool;
  const catLabel = categoryLabel(categories, project.categories[0], lang);

  const list = new Intl.ListFormat(lang, { style: 'long', type: 'conjunction' })
    .format(replaced.slice(0, 3).map((tool) => tool.name));
  const vars = { name: project.name, list, year: buildDate.slice(0, 4), tagline: i18nEntry.tagline, category: catLabel };
  // Aucun outil remplacé (page alors noindex) : titre de repli par la
  // catégorie plutôt qu'un « alternative to  » vide (Ruling 21).
  const fallback = replaced.length === 0;
  const title = interpolate(fallback ? p.titleFallbackTemplate : p.titleTemplate, vars);
  const description = interpolate(fallback ? p.metaDescriptionFallbackTemplate : p.metaDescriptionTemplate, vars);
  const dateModified = projectDateModified(project);

  const breadcrumbItems = [
    { label: s.directoryLabel, href: homePath },
    { label: catLabel, href: categoryPath },
    { label: project.name, href: path },
  ];
  // Catégorie sans page dans la langue : nommée, jamais liée vers un 404.
  const crumbs = renderBreadcrumb(breadcrumbItems);

  const eyebrow = [
    categoryPath ? `<a href="${escapeHtml(categoryPath)}">${escapeHtml(catLabel)}</a>` : escapeHtml(catLabel),
    project.license ? escapeHtml(project.license) : null,
    dateModified ? `${escapeHtml(t.lastUpdatedLabel)} <time datetime="${dateModified}">${escapeHtml(formatDate(dateModified, lang))}</time>` : null,
  ].filter(Boolean).join(' · ');

  const paragraphs = String(i18nEntry.description ?? '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const isIndexable = (other) => Boolean(projectIndexable?.(other));

  const head = `${renderNotice(project, lang, p, today)}    <header class="page-head project-head">
      <div class="head-text">
        ${crumbs}
        <p class="eyebrow">${eyebrow}</p>
        <h1>${escapeHtml(interpolate(p.h1Template, vars))}</h1>
      </div>
${renderFacts({ project, lang, p, t, today })}
      <p class="lede">${escapeHtml(i18nEntry.tagline)}</p>${paragraphs.length ? `
      <div class="project-about">
${paragraphs.map((para) => `        <p>${escapeHtml(para)}</p>`).join('\n')}
      </div>` : ''}
    </header>`;

  const bestFor = i18nEntry.bestFor ? `

    <section aria-labelledby="bestfor-heading">
      <h2 id="bestfor-heading">${escapeHtml(p.bestForHeading)}</h2>
      <p class="best-for">${escapeHtml(i18nEntry.bestFor)}</p>
    </section>` : '';

  const main = `${head}${renderReplaces({ project, replaced, lang, s, t, p })}${renderProsCons(i18nEntry, p)}${bestFor}${renderRelated({ related, lang, t, p, catLabel, projectI18n, isIndexable, today })}${renderCompareLinks(comparisons, s.compare.linksHeading)}`;

  const relatedList = related.length === 0 ? [] : [softwareItemListJsonLd(related.map((other) => {
    const { href } = projectLink(other, lang, isIndexable);
    return {
      name: other.name,
      url: href.startsWith('/') ? `${SITE_ORIGIN}${href}` : href,
      applicationCategory: catLabel,
      hosted: other.hosted,
    };
  }))];

  const webPage = webPageJsonLd({ path, name: title, description, lang, dateModified });
  if (!dateModified) delete webPage.dateModified;

  return renderLayout({
    lang,
    path,
    title,
    description,
    alternates,
    xDefaultPath,
    robots: indexable ? null : 'noindex,follow',
    jsonLd: [
      organizationJsonLd(),
      breadcrumbJsonLd(breadcrumbItems.filter((item) => item.href)),
      webPage,
      softwareApplicationJsonLd({ project, path, catLabel, description: i18nEntry.tagline }),
      ...relatedList,
    ],
    main,
    ui,
    homeHref: homePath,
    sponsorSlots,
  });
}
