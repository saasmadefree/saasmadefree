import { escapeHtml, renderLayout, renderBreadcrumb, verdictBadge } from './site-html.mjs';
import { categoryLabel, SITE_ORIGIN } from './site-data.mjs';
import { formatMoney, formatMonthlyPrice, formatDate, interpolate, MONTHLY_BASES } from './site-format.mjs';
import {
  organizationJsonLd, breadcrumbJsonLd, faqPageJsonLd, softwareItemListJsonLd, webPageJsonLd, languageVersions,
} from './site-seo.mjs';
import { indexable as gates, isDisplayableProject, statsAreFresh } from './site-alternatives.mjs';
import { compareKey } from './validate-rules.mjs';
import {
  projectLink, templateWithHtml, projectStatCells, sourceHost, monthYear, externalLink as ext, hostedCell, selfHostCell,
} from './site-page-tool.mjs';
import { projectDateModified } from './site-page-project.mjs';

// Comparatif /{lang}/compare/{a}-vs-{b} (spec D4, D7, D14). Seulement pour
// les paires de data/compare.json, qui ont une demande mesurée : jamais de
// produit cartésien. Un côté est un outil payant ou un projet open source.
//
// Ordre : avis « inactif » s'il y a lieu → en-tête (fil d'Ariane, eyebrow,
// H1 « A vs B », résumé avec un avis) → « Prends A si… » et « Prends B si… »
// côte à côte → tableau des faits, une colonne par côté → FAQ (3).
//
// Honnêteté (D3, D14) : chaque fait que l'on tient est montré, aucun n'est
// inventé. Une ligne qui ne s'applique à aucun des deux côtés disparaît ; un
// fait qui ne s'applique qu'à un côté laisse à l'autre un tiret titré. Des
// chiffres GitHub périmés (> 45 jours) ou absents donnent un tiret, jamais 0.

const DASH = '—';

/** Chemin d'un comparatif dans une langue. */
export function comparePath(lang, a, b) {
  return `/${lang}/compare/${compareKey(a, b)}`;
}

/** Catégorie d'un côté : celle de l'outil, ou la première du projet. */
export function compareCategory(side) {
  return side.kind === 'tool' ? side.entity.category : side.entity.categories[0];
}

function isInactive(side, today) {
  return side.kind === 'project' && !isDisplayableProject(side.entity, today);
}

/**
 * Pages comparatif à générer : une par paire de data/compare.json et par
 * langue publiée (`langs`) où le texte data/i18n/{lang}/compare/{a}-vs-{b}.json
 * existe ET où chaque côté outil est publié (`tool.markets`, Ruling 24). Sinon,
 * pas de page dans cette langue, et elle sort des hreflang, du x-default, du
 * sitemap et des liens « Comparisons ».
 * `indexable` = indexable.compare ET les deux côtés affichables : un
 * comparatif avec un projet archivé, ou sans commit depuis plus d'un an, est
 * généré quand même, en noindex,follow, hors sitemap, avec un avis (D7, comme
 * Ruling 20). Un côté inconnu casse le build : le validateur (A1) le refuse
 * déjà, ce refus-ci protège un build lancé sans validation.
 * @param {{ compare: object[], compareI18n: Map<string, object>, tools: Map<string, object>,
 *   projects: Map<string, object>, langs: string[], today: string }} ctx
 * @returns {Array<{ lang: string, key: string, path: string, pair: object,
 *   left: {kind:'tool'|'project', entity: object}, right: {kind:'tool'|'project', entity: object},
 *   i18nEntry: object, alternates: Array<{lang:string,path:string,indexable:boolean}>, xDefaultPath: string,
 *   indexable: boolean, inactive: object[] }>}
 */
export function buildComparePages({ compare, compareI18n, tools, projects, langs, today }) {
  const pools = { tool: tools, project: projects };
  const pages = [];
  for (const pair of compare ?? []) {
    const key = compareKey(pair.a, pair.b);
    const [left, right] = [[pair.a, pair.kindA], [pair.b, pair.kindB]].map(([slug, kind]) => {
      const entity = pools[kind]?.get(slug);
      if (!entity) {
        throw new Error(`data/compare.json (${key}) : côté inconnu "${slug}" (aucun data/${kind}s/${slug}.json)`);
      }
      return { kind, entity };
    });
    // Ruling 24 : un comparatif n'existe dans une langue que si chaque fiche
    // outil qu'il oppose y est publiée — jamais un côté nommé sans sa page.
    const written = langs.filter((lang) => compareI18n.has(`${lang}/${key}`)
      && [left, right].every((side) => side.kind !== 'tool' || side.entity.markets?.includes(lang)));
    if (written.length === 0) continue;
    const inactive = [left, right].filter((side) => isInactive(side, today)).map((side) => side.entity);
    // Chaque version porte sa porte D7 : renderLayout n'annonce en hreflang
    // que les versions indexables (Ruling 29).
    const alternates = languageVersions(
      written, (lang) => comparePath(lang, pair.a, pair.b),
      (lang) => gates.compare(pair, lang, { compareI18n }) && inactive.length === 0,
    );
    const xDefaultPath = (alternates.find((a) => a.lang === 'en') ?? alternates[0]).path;
    for (const { lang, path, indexable } of alternates) {
      pages.push({
        lang, key, path, pair, left, right, alternates, xDefaultPath, inactive, indexable,
        i18nEntry: compareI18n.get(`${lang}/${key}`),
      });
    }
  }
  return pages;
}

/**
 * Liens « Comparisons » d'une fiche outil ou d'une page projet : les
 * comparatifs générés dans la langue où l'entité est l'un des deux côtés,
 * dans l'ordre de data/compare.json. Dérivé du même plan que les pages : un
 * lien ne vise jamais un comparatif absent.
 * @returns {Array<{ href: string, label: string }>}
 */
export function compareLinksFor(plan, { lang, kind, slug, ui }) {
  const c = ui.site.compare;
  const has = (side) => side.kind === kind && side.entity.slug === slug;
  return plan
    .filter((page) => page.lang === lang && (has(page.left) || has(page.right)))
    .map((page) => ({ href: page.path, label: interpolate(c.vsTemplate, { a: page.left.entity.name, b: page.right.entity.name }) }));
}

/** Date de dernière modification réelle : le plus récent des relevés
 *  affichés (prix de l'outil, chiffres GitHub et prix hébergé d'un projet).
 *  null sans aucun relevé daté : jamais la date du build à la place. */
export function compareDateModified(left, right) {
  const dates = [left, right]
    .map((side) => (side.kind === 'tool' ? side.entity.pricing?.checkedOn : projectDateModified(side.entity)))
    .filter(Boolean);
  return dates.length ? dates.reduce((max, d) => (d > max ? d : max)) : null;
}

/** Lien d'un côté vers sa page chez nous. Outil : sa fiche, toujours publiée
 *  dans la langue (Ruling 24, garanti par buildComparePages) — l'inverse est
 *  un bug du plan, on casse le build plutôt que de lier une page absente.
 *  Projet : sa page /oss/ si elle est indexable, sinon son site en nofollow
 *  (règle des fiches). `path` nomme la paire et la langue dans l'erreur. */
function sideLink(side, lang, isIndexable, path) {
  if (side.kind === 'tool') {
    if (!side.entity.markets?.includes(lang)) {
      throw new Error(`${path} : la fiche outil "${side.entity.slug}" n'est pas publiée en ${lang} (Ruling 24)`);
    }
    return { href: `/${lang}/tools/${side.entity.slug}`, rel: '' };
  }
  return projectLink(side.entity, lang, isIndexable);
}

/** Un avis par côté inactif, qui le nomme (même idée que Ruling 20). */
function renderNotice(inactive, lang, c) {
  return inactive.map((project) => {
    const message = project.stats.archived === true
      ? interpolate(c.archivedNoticeTemplate, { name: project.name })
      : interpolate(c.staleNoticeTemplate, { name: project.name, date: monthYear(project.stats.lastCommit, lang, 'long') });
    return `    <p class="project-notice" role="note">${escapeHtml(message)}</p>\n\n`;
  }).join('');
}

/** Les faits d'un côté, par ligne. `null` = ne s'applique pas à ce côté. */
function sideFacts(side, { lang, ui, s, t, p, today }) {
  const e = side.entity;
  if (side.kind === 'tool') {
    const { pricing } = e;
    const basis = [ui.pricingBasis?.[pricing.basis], pricing.plan ? interpolate(t.planTemplate, { plan: pricing.plan }) : null]
      .filter(Boolean).map(escapeHtml).join(' · ');
    const price = `${escapeHtml(formatMonthlyPrice(pricing, lang))}<span class="sub">${basis ? `${basis} · ` : ''}`
      + `${templateWithHtml(t.priceSourceTemplate, 'host', ext(pricing.source, sourceHost(pricing.source)))}`
      + ` · ${escapeHtml(interpolate(t.checkedOnTemplate, { date: formatDate(pricing.checkedOn, lang) }))}</span>`;
    const yearly = MONTHLY_BASES.has(pricing.basis)
      ? `<span title="${escapeHtml(t.yearCostNote)}">${escapeHtml(formatMoney(pricing.amount * 12, pricing.currency, lang))}</span>`
      : null;
    const domain = e.domains?.[0];
    return {
      kind: escapeHtml(s.compare.kindTool),
      verdict: verdictBadge(e.verdict, s.verdicts[e.verdict].label),
      price,
      yearly,
      build: escapeHtml(ui.diyTimeEstimate?.[e.diyTimeEstimate] ?? e.diyTimeEstimate),
      license: escapeHtml(t.licenseProprietary),
      stars: null,
      commit: null,
      started: null,
      selfHost: escapeHtml(t.selfHostNo),
      hosted: null,
      website: domain ? ext(`https://${domain}`, domain) : null,
      repo: null,
    };
  }
  const { stars, commit } = projectStatCells(e, lang, t, today);
  const hosted = hostedCell(e, lang, t);
  return {
    kind: escapeHtml(s.compare.kindProject),
    verdict: null,
    price: null,
    yearly: null,
    build: null,
    license: e.license ? escapeHtml(e.license) : DASH,
    stars,
    commit,
    // La date de création ne bouge pas : vraie même quand les chiffres
    // vivants sont trop vieux pour être montrés (Ruling 23).
    started: e.stats?.createdAt ? escapeHtml(monthYear(e.stats.createdAt, lang)) : null,
    selfHost: selfHostCell(e, t),
    hosted,
    website: ext(e.homepage, sourceHost(e.homepage)),
    repo: e.repo ? ext(`https://github.com/${e.repo}`, e.repo) : null,
  };
}

function renderFactsTable({ left, right, lang, ui, s, t, p, c, today, isIndexable, path }) {
  const ctx = { lang, ui, s, t, p, today };
  const facts = [sideFacts(left, ctx), sideFacts(right, ctx)];
  const na = `<span title="${escapeHtml(c.notApplicable)}">${DASH}</span>`;
  const rows = [
    ['kind', c.rowKind], ['verdict', c.rowVerdict], ['price', c.rowPrice], ['yearly', t.yearCostLabel],
    ['build', t.buildTimeLabel], ['license', t.colLicense], ['stars', t.colStars, true], ['commit', t.colLastCommit, true],
    ['started', p.startedLabel], ['selfHost', t.colSelfHost], ['hosted', t.colHosted],
    ['website', p.websiteLabel], ['repo', p.repoLabel],
  ]
    // Une ligne qui ne s'applique à aucun côté n'a rien à dire : on la tait.
    .filter(([field]) => facts.some((f) => f[field] !== null))
    .map(([field, label, num]) => `            <tr>
              <th scope="row">${escapeHtml(label)}</th>
${facts.map((f) => `              <td${num ? ' class="num"' : ''}>${f[field] ?? na}</td>`).join('\n')}
            </tr>`);

  const heads = [left, right].map((side) => {
    const link = sideLink(side, lang, isIndexable, path);
    const tagline = side.i18n?.tagline ? `<span class="sub">${escapeHtml(side.i18n.tagline)}</span>` : '';
    return `<th scope="col"><a href="${escapeHtml(link.href)}"${link.rel}>${escapeHtml(side.entity.name)}</a>${tagline}</th>`;
  });

  const fresh = [left, right].filter((side) => side.kind === 'project' && statsAreFresh(side.entity, today))
    .map((side) => side.entity.stats.checkedOn).sort().at(-1);
  const hint = fresh ? `\n      <p class="hint">${escapeHtml(interpolate(t.statsAsOf, { date: formatDate(fresh, lang) }))}.</p>` : '';
  const names = { a: left.entity.name, b: right.entity.name };

  return `    <section aria-labelledby="facts-heading">
      <h2 id="facts-heading">${escapeHtml(c.factsHeading)}</h2>
      <div class="table-scroll" role="region" aria-labelledby="facts-caption" tabindex="0">
        <table class="alt-table compare-table">
          <caption id="facts-caption">${escapeHtml(interpolate(c.factsCaption, names))}</caption>
          <thead><tr><th scope="col"><span class="visually-hidden">${escapeHtml(c.colFact)}</span></th>${heads.join('')}</tr></thead>
          <tbody>
${rows.join('\n')}
          </tbody>
        </table>
      </div>${hint}
    </section>`;
}

/** « Prends A si… » et « Prends B si… », côte à côte sur grand écran. */
function renderPicks(left, right, i18nEntry, c) {
  const col = (id, side, items) => `      <section aria-labelledby="${id}">
        <h2 id="${id}">${escapeHtml(interpolate(c.pickIfTemplate, { name: side.entity.name }))}</h2>
        <ul class="lose-list gain-list">
${items.map((item) => `          <li>${escapeHtml(item)}</li>`).join('\n')}
        </ul>
      </section>`;
  return `    <div class="pro-con">
${col('pick-a-heading', left, i18nEntry.pickAIf ?? [])}
${col('pick-b-heading', right, i18nEntry.pickBIf ?? [])}
    </div>`;
}

function itemFor(side, lang, isIndexable, categories, path) {
  const { href } = sideLink(side, lang, isIndexable, path);
  return {
    name: side.entity.name,
    url: href.startsWith('/') ? `${SITE_ORIGIN}${href}` : href,
    applicationCategory: categoryLabel(categories, compareCategory(side), lang),
    // Une offre gratuite n'est affirmée que pour un projet sans version
    // hébergée payante (softwareItemListJsonLd) ; un outil n'en porte jamais.
    hosted: side.kind === 'project' ? side.entity.hosted : undefined,
  };
}

/**
 * Comparatif. Renvoie null sans texte dans la langue (`i18nEntry` absent) :
 * la page n'est alors pas écrite du tout.
 *
 * @param {object} opts
 * @param {string} opts.lang
 * @param {string} opts.path  '/{lang}/compare/{a}-vs-{b}'
 * @param {{kind:'tool'|'project', entity:object, i18n?:object}} opts.left  côté A ; `i18n` = son texte dans la langue (accroche)
 * @param {{kind:'tool'|'project', entity:object, i18n?:object}} opts.right  côté B
 * @param {object} [opts.i18nEntry]  data/i18n/{lang}/compare/{a}-vs-{b}.json
 * @param {object} opts.ui  ui.json de la langue
 * @param {Array<{lang:string,path:string}>} opts.alternates  langues rédigées seulement
 * @param {string|null} opts.xDefaultPath
 * @param {string} opts.homePath
 * @param {object} opts.categories  data/categories.json
 * @param {string|null} [opts.categoryPath]  page de la catégorie du côté A, null si elle n'existe pas dans la langue
 * @param {string} opts.buildDate  'YYYY-MM-DD' (année du titre)
 * @param {string} opts.today  'YYYY-MM-DD' (fraîcheur des chiffres, activité)
 * @param {boolean} opts.indexable  porte du plan (buildComparePages) : sinon noindex,follow
 * @param {(project: object) => boolean} [opts.projectIndexable]  même porte que les fiches pour lier /oss/
 * @param {object|null} [opts.sponsorSlots]  emplacements vendus, rendus par renderSponsorSlots
 */
export function renderComparePage({
  collectionLinks = [],
  lang, path, left, right, i18nEntry, ui, alternates = [], xDefaultPath = null, homePath,
  categories = {}, categoryPath = null, buildDate, today, indexable = false,
  projectIndexable = () => false, sponsorSlots = null,
}) {
  if (!i18nEntry) return null;
  const s = ui.site;
  const c = s.compare;
  const t = s.tool;
  const p = s.project;
  const isIndexable = (project) => Boolean(projectIndexable?.(project));
  const catLabel = categoryLabel(categories, compareCategory(left), lang);
  const vars = { a: left.entity.name, b: right.entity.name, year: buildDate.slice(0, 4) };
  const title = interpolate(c.titleTemplate, vars);
  const description = interpolate(c.metaDescriptionTemplate, vars);
  const dateModified = compareDateModified(left, right);
  const vs = interpolate(c.vsTemplate, vars);

  const breadcrumbItems = [
    { label: s.directoryLabel, href: homePath },
    { label: catLabel, href: categoryPath },
    { label: vs, href: path },
  ];

  const eyebrow = [
    categoryPath ? `<a href="${escapeHtml(categoryPath)}">${escapeHtml(catLabel)}</a>` : escapeHtml(catLabel),
    dateModified ? `${escapeHtml(t.lastUpdatedLabel)} <time datetime="${dateModified}">${escapeHtml(formatDate(dateModified, lang))}</time>` : null,
  ].filter(Boolean).join(' · ');

  // Le résumé tel qu'écrit, paragraphe par paragraphe : aucun mot ajouté.
  const paragraphs = String(i18nEntry.summary ?? '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const inactive = [left, right].filter((side) => isInactive(side, today)).map((side) => side.entity);

  const head = `${renderNotice(inactive, lang, c)}    <header class="page-head compare-head">
      <div class="head-text">
        ${renderBreadcrumb(breadcrumbItems)}
        <p class="eyebrow">${eyebrow}</p>
        <h1>${escapeHtml(interpolate(c.h1Template, vars))}</h1>
      </div>
      <div class="compare-summary lede">
${paragraphs.map((para) => `        <p>${escapeHtml(para)}</p>`).join('\n')}
      </div>
    </header>`;

  const faq = `    <section aria-labelledby="faq-heading" class="faq">
      <h2 id="faq-heading">${escapeHtml(t.faqHeading)}</h2>
${(i18nEntry.faq ?? []).map((entry) => `      <details>
        <summary>${escapeHtml(entry.q)}</summary>
        <p>${escapeHtml(entry.a)}</p>
      </details>`).join('\n')}
    </section>`;

  const main = `${head}

${renderPicks(left, right, i18nEntry, c)}

${renderFactsTable({ left, right, lang, ui, s, t, p, c, today, isIndexable, path })}

${faq}`;

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
      softwareItemListJsonLd([left, right].map((side) => itemFor(side, lang, isIndexable, categories, path))),
      faqPageJsonLd(i18nEntry.faq ?? []),
    ],
    main,
    ui,
    homeHref: homePath,
    collectionLinks,
    sponsorSlots,
  });
}
