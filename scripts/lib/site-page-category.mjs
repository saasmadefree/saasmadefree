import { escapeHtml, renderLayout, renderBreadcrumb } from './site-html.mjs';
import { categoryLabel, categoryTitleLabel, SITE_ORIGIN } from './site-data.mjs';
import { interpolate, pluralize, formatDate } from './site-format.mjs';
import { renderToolGrid } from './site-table.mjs';
import { organizationJsonLd, itemListJsonLd, breadcrumbJsonLd, softwareItemListJsonLd } from './site-seo.mjs';
import {
  alternativesFor, inactiveAlternativesFor, indexable, statsAreFresh, countsAsOpenSource, MIN_LIST_ITEMS,
} from './site-alternatives.mjs';
import {
  projectLink, projectTagline, projectStatCells, fitTag, renderInactive, selfHostCell, licenseCell,
} from './site-page-tool.mjs';

// Page de catégorie « best » (spec D6, D7, D14). URL inchangée :
// /{lang}/categories/{slug}. En tête, les projets open source cités par les
// fiches de la catégorie, classés par adéquation puis par étoiles ; en
// dessous, le registre des SaaS tel qu'il existait avant (même grille de
// cartes que l'accueil). Rien de l'ancienne page ne disparaît (D14) :
// tests/site-page-category.test.mjs en tient l'inventaire.

const FIT_RANK = { full: 0, partial: 1, niche: 2 };

/**
 * Projets affichables cités par les fiches de la catégorie (déjà filtrées
 * sur la langue), avec leur meilleure adéquation parmi ces fiches et les
 * fiches qui les citent (dans l'ordre reçu). Tri : adéquation (full >
 * partial > niche), puis étoiles décroissantes, puis slug en comparaison
 * binaire. Un projet sans chiffres GitHub frais (absents, ou relevés il y a
 * plus de 45 jours) passe après ceux qui en ont : on ne lui invente pas de
 * rang, et on ne classe pas sur un chiffre qu'on ne montre pas.
 * @param {object[]} toolViews  fiches de la catégorie dans la langue
 * @param {Map<string, object>} projects
 * @param {string} today  'YYYY-MM-DD'
 * @returns {Array<{ project: object, fit: 'full'|'partial'|'niche', tools: object[] }>}
 */
export function categoryProjects(toolViews, projects, today) {
  const bySlug = new Map();
  for (const tool of toolViews) {
    for (const { project, fit } of alternativesFor(tool, projects, today)) {
      const entry = bySlug.get(project.slug);
      if (!entry) {
        bySlug.set(project.slug, { project, fit, tools: [tool] });
        continue;
      }
      if (FIT_RANK[fit] < FIT_RANK[entry.fit]) entry.fit = fit;
      if (!entry.tools.includes(tool)) entry.tools.push(tool);
    }
  }
  // Étoiles périmées (> 45 jours) : masquées sur la page, donc sans poids
  // dans le classement — le projet passe comme s'il n'avait pas de chiffres.
  const stars = (p) => (statsAreFresh(p, today) ? p.stats.stars : -1);
  return [...bySlug.values()].sort((a, b) => FIT_RANK[a.fit] - FIT_RANK[b.fit]
    || stars(b.project) - stars(a.project)
    || (a.project.slug < b.project.slug ? -1 : a.project.slug > b.project.slug ? 1 : 0));
}

/** Projets cités par les fiches de la catégorie mais inactifs (archivés, ou
 *  sans commit depuis un an) : hors classement, nommés quand même avec leur
 *  état (D14, Ruling 19). Sans doublon, dans l'ordre de première citation. */
export function categoryInactiveProjects(toolViews, projects, today) {
  const seen = new Map();
  for (const tool of toolViews) {
    for (const entry of inactiveAlternativesFor(tool, projects, today)) {
      if (!seen.has(entry.project.slug)) seen.set(entry.project.slug, entry);
    }
  }
  return [...seen.values()];
}

/** Porte D7 d'une catégorie : au moins 3 éléments, SaaS et projets
 *  affichables confondus. En dessous, noindex,follow et hors sitemap. */
export function categoryIndexable(toolViews, ranked) {
  return indexable.list([...toolViews, ...ranked]);
}

function renderProjects({ ranked, inactive, lang, label, c, t, projectI18n, isIndexable, today }) {
  const heading = `      <h2 id="projects-heading">${escapeHtml(interpolate(c.projectsHeading, { category: label }))}</h2>`;
  if (ranked.length === 0) {
    return `    <section aria-labelledby="projects-heading">
${heading}
      <p class="intro">${escapeHtml(interpolate(c.noProjects, { category: label }))}</p>${renderInactive(inactive, lang, t)}
    </section>`;
  }
  const cols = [
    [t.colProject, ''], [c.colFit, ''], [t.colLicense, ''], [t.colStars, ' class="num"'],
    [t.colLastCommit, ' class="num"'], [t.colSelfHost, ''], [c.colReplaces, ''],
  ].map(([name, cls]) => `<th scope="col"${cls}>${escapeHtml(name)}</th>`).join('');

  const rows = ranked.map(({ project, fit, tools }) => {
    const link = projectLink(project, lang, isIndexable);
    const { stars, commit } = projectStatCells(project, lang, t, today);
    const tagline = projectTagline(project, lang, projectI18n);
    const replaces = tools.map((tool) => `<a href="${escapeHtml(tool.path)}">${escapeHtml(tool.name)}</a>`).join(', ');
    return `            <tr>
              <th scope="row"><a href="${escapeHtml(link.href)}"${link.rel}>${escapeHtml(project.name)}</a>${tagline ? `<span class="sub">${tagline}</span>` : ''}</th>
              <td>${fitTag(fit, t)}</td>
              <td>${licenseCell(project, t)}</td>
              <td class="num">${stars}</td>
              <td class="num">${commit}</td>
              <td>${selfHostCell(project, t)}</td>
              <td>${replaces}</td>
            </tr>`;
  });

  const legend = ['full', 'partial', 'niche'].map((fit) => `${fitTag(fit, t)} ${escapeHtml(t.fitLegend[fit])}`).join(' · ');
  const fresh = ranked.filter(({ project }) => statsAreFresh(project, today)).map(({ project }) => project.stats.checkedOn).sort();
  const asOf = fresh.length ? ` ${escapeHtml(interpolate(t.statsAsOf, { date: formatDate(fresh.at(-1), lang) }))}.` : '';

  return `    <section aria-labelledby="projects-heading">
${heading}
      <p class="intro">${escapeHtml(c.projectsIntro)}</p>
      <div class="table-scroll" role="region" aria-labelledby="projects-caption" tabindex="0">
        <table class="alt-table">
          <caption id="projects-caption">${escapeHtml(interpolate(c.projectsCaption, { category: label }))}</caption>
          <thead><tr>${cols}</tr></thead>
          <tbody>
${rows.join('\n')}
          </tbody>
        </table>
      </div>
      <p class="hint">${legend}.${asOf}</p>${renderInactive(inactive, lang, t)}
    </section>`;
}

/**
 * @param {object} opts  — en plus des champs historiques :
 * @param {Map<string, object>} [opts.projects]  slug → projet ; absent, pas de projets
 * @param {Map<string, object>} [opts.projectI18n]  accroches des projets
 * @param {string} opts.buildDate  'YYYY-MM-DD' (année du titre)
 * @param {string} [opts.today]  'YYYY-MM-DD' (activité, fraîcheur des chiffres) ; défaut buildDate
 * @param {(project: object) => boolean} [opts.projectIndexable]  la porte de
 *   build-site (projectIndexableIn(lang)) : lien /{lang}/oss/ seulement si vrai
 */
export function renderCategoryPage({
  collectionLinks = [],
  lang, path, categorySlug, categories, toolViews, voteCounts, favicons, ui, alternates, xDefaultPath, homePath,
  sponsorSlots, projects = new Map(), projectI18n = new Map(), buildDate, today = buildDate,
  projectIndexable = () => false,
}) {
  if (typeof buildDate !== 'string') {
    throw new TypeError("renderCategoryPage : buildDate doit être une date 'YYYY-MM-DD' (année du titre).");
  }
  const s = ui.site;
  const c = s.category;
  const t = s.tool;
  const ci = ui.categoriesIndex;
  const label = categoryLabel(categories, categorySlug, lang);
  const projectMap = projects ?? new Map();
  const ranked = categoryProjects(toolViews, projectMap, today);
  const inactive = categoryInactiveProjects(toolViews, projectMap, today);
  const isIndexable = (project) => Boolean(projectIndexable?.(project));

  const n = ranked.length;
  const fallback = !indexable.list(ranked);
  const vars = { n, category: label, year: buildDate.slice(0, 4) };
  // Le titre (et le H1, qui le reprend) prend le libellé court : « 4 Best Free
  // & Open Source Newsletter Tools » se lit, « … Newsletters & publishing
  // Tools » non. Description, fil d'Ariane et intertitres gardent le libellé.
  const titleVars = { ...vars, category: categoryTitleLabel(categories, categorySlug, lang) };
  // « Open Source » ne compte que les licences libres, comme sur la fiche
  // outil (Ruling 44) : titre chiffré si au moins 3 le sont (et {n} = ce
  // compte) ; sinon le titre chiffré sur n, sans « Open Source ». Titre de
  // repli (n < 3) : « Open Source » seulement si tous les projets le sont.
  const nOpen = ranked.filter(({ project }) => countsAsOpenSource(project)).length;
  const open = fallback ? nOpen === n : nOpen >= MIN_LIST_ITEMS;
  const key = (base) => `${base}${open ? '' : 'NotOpen'}${fallback ? 'Fallback' : ''}Template`;
  const title = interpolate(c[key('title')], open && !fallback ? { ...titleVars, n: nOpen } : titleVars);
  const description = interpolate(c[key('metaDescription')], vars);
  const tally = [
    pluralize(toolViews.length, lang, ci.toolCountOne, ci.toolCountOther),
    n > 0 ? pluralize(n, lang, c.projectCountOne, c.projectCountOther) : null,
  ].filter(Boolean).join(' · ');

  const breadcrumbItems = [
    { label: s.directoryLabel, href: homePath },
    { label, href: path },
  ];

  const grid = renderToolGrid(toolViews, { lang, ui, categories, voteCounts, favicons, headingLevel: 3 });

  const main = `    <header class="list-head">
      ${renderBreadcrumb(breadcrumbItems)}
      <h1>${escapeHtml(title)}</h1>
      <p class="intro">${escapeHtml(tally)}</p>
    </header>

${renderProjects({ ranked, inactive, lang, label, c, t, projectI18n, isIndexable, today })}

    <section aria-labelledby="saas-heading">
      <h2 id="saas-heading">${escapeHtml(interpolate(c.heading, { category: label }))}</h2>
      <p class="intro">${escapeHtml(c.saasIntro)}</p>
${grid}
    </section>`;

  const projectList = n === 0 ? [] : [softwareItemListJsonLd(ranked.map(({ project }) => {
    const { href } = projectLink(project, lang, isIndexable);
    return {
      name: project.name,
      url: href.startsWith('/') ? `${SITE_ORIGIN}${href}` : href,
      applicationCategory: label,
      hosted: project.hosted,
    };
  }))];

  return renderLayout({
    lang,
    path,
    title,
    description,
    alternates,
    xDefaultPath,
    robots: categoryIndexable(toolViews, ranked) ? null : 'noindex,follow',
    jsonLd: [
      organizationJsonLd(),
      ...projectList,
      itemListJsonLd(toolViews),
      breadcrumbJsonLd(breadcrumbItems),
    ],
    main,
    ui,
    homeHref: homePath,
    collectionLinks,
    sponsorSlots,
  });
}
