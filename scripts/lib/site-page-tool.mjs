import { escapeHtml, renderLayout, renderBreadcrumb, verdictBadge } from './site-html.mjs';
import { categoryLabel, SITE_ORIGIN } from './site-data.mjs';
import {
  formatMoney, formatMonthlyPrice, formatDate, interpolate, pluralize, MONTHLY_BASES,
} from './site-format.mjs';
import {
  organizationJsonLd, faqPageJsonLd, breadcrumbJsonLd, softwareItemListJsonLd, webPageJsonLd,
} from './site-seo.mjs';
import {
  alternativesFor, inactiveAlternativesFor, toolTitleVars, statsAreFresh, toolDateModified,
} from './site-alternatives.mjs';
import { PLACEHOLDER_PATH } from './site-favicons.mjs';
import { FEED_VERSION } from './feed.mjs';
// Le bouton "Open in <agent>" ne doit jamais réimplémenter la logique de
// résolution d'action de l'extension : on importe directement le module que
// l'extension elle-même utilise (voir extension/lib/template.mjs et
// extension/popup/popup.mjs). Le fichier est pur ESM sans API navigateur,
// donc réutilisable tel quel côté build Node.
import { resolveAction } from '../../extension/lib/template.mjs';

// Fiche outil = page « alternatives » (spec D1, D9, D14). Ordre des sections
// fixé par D9 : alternatives (tableau puis fiches projet) → le construire
// (prompt) → ce que tu perds → pourquoi on paie encore → FAQ. Suivent le vote
// et les outils liés. Chaque information de l'ancienne fiche reste affichée
// (D14) : tests/site-page-tool.test.mjs en tient l'inventaire.

const DASH = '—';

/** Nom d'hôte d'une URL, sans « www. » : le texte des liens de source. */
export function sourceHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Mois et année d'une date 'YYYY-MM-DD', en UTC (« Oct 2026 », ou
 *  « October 2026 » avec month = 'long'). */
export function monthYear(iso, lang, month = 'short') {
  return new Intl.DateTimeFormat(lang, { month, year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

/** Lien sortant vers un site tiers, en nofollow. */
export function externalLink(href, label) {
  return `<a href="${escapeHtml(href)}" rel="nofollow noopener">${escapeHtml(label)}</a>`;
}

/** Prix hébergé d'un projet, en HTML : « From $9 » avec sa source cliquable
 *  et sa date, seulement si l'offre existe ; sinon « None ». `t` = ui.site.tool.
 *  Faits de la page projet et tableau du comparatif. */
export function hostedCell(project, lang, t) {
  if (!project.hosted?.exists) return escapeHtml(t.hostedNone);
  const { hosted } = project;
  return `${escapeHtml(interpolate(t.hostedFromTemplate, { price: formatMoney(hosted.priceFrom, hosted.currency, lang) }))}`
    + `<span class="sub">${templateWithHtml(t.priceSourceTemplate, 'host', externalLink(hosted.source, sourceHost(hosted.source)))}`
    + ` · ${escapeHtml(interpolate(t.checkedOnTemplate, { date: formatDate(hosted.checkedOn, lang) }))}</span>`;
}

// « A week » → « a week » : le libellé entre au milieu d'une phrase de la
// méta-description. Les libellés en et fr commencent tous par une capitale.
function lowerFirst(value) {
  const s = String(value);
  return s.charAt(0).toLocaleLowerCase() + s.slice(1);
}

/** Un bouton par agent *vérifié* de data/agents.json (voir CONTRIBUTING.md :
 *  un agent "untested" ou "not-yet" n'est pas montré ici). L'action (url,
 *  deeplink ou presse-papier) est résolue une fois pour toutes au build avec
 *  la même fonction que l'extension, donc le bouton est un lien <a> qui
 *  fonctionne sans JavaScript — l'amélioration progressive (copie automatique
 *  du prompt avant de suivre le lien) est ajoutée par scripts/assets/site.js. */
function renderAgentButtons(agents, ctx, t) {
  return agents
    .filter((agent) => agent.status === 'verified')
    .map((agent) => {
      const action = resolveAction(agent, ctx);
      const url = action.url ?? agent.homepage;
      const label = interpolate(t.openInAgentTemplate, { name: agent.name });
      // "url" et "clipboard" ouvrent un nouvel onglet (la fiche reste ouverte
      // pour copier le prompt) ; "deeplink" navigue dans le même onglet, seul
      // moyen fiable de déclencher le gestionnaire de protocole personnalisé
      // de l'agent (cursor://…).
      const targetAttr = action.mode === 'deeplink' ? '' : ' target="_blank" rel="noopener noreferrer"';
      return `<a class="agent-btn" href="${escapeHtml(url)}" data-agent-id="${escapeHtml(agent.id)}" data-mode="${escapeHtml(action.mode)}"${targetAttr}
              data-copied-label="${escapeHtml(t.copiedButton)}" data-fail-label="${escapeHtml(t.copyFailed)}">${escapeHtml(label)}</a>`;
    })
    .join('\n              ');
}

/** Rend un gabarit dont la variable `key` reçoit du HTML déjà construit (un
 *  lien, un soulignement) : le gabarit est découpé autour de {key}, chaque
 *  morceau de texte est échappé séparément. Ainsi la ponctuation (« Source : »
 *  en français) reste dans ui.json, jamais dans le code. */
export function templateWithHtml(template, key, html, vars = {}) {
  const [before, after] = interpolate(String(template).replace(`{${key}}`, '\u0000'), vars).split('\u0000');
  if (after === undefined) return escapeHtml(before);
  return `${escapeHtml(before)}${html}${escapeHtml(after)}`;
}

/** Le nom de l'outil, souligné à la main dans le titre. */
function headingWithName(template, vars) {
  return templateWithHtml(template, 'name', `<span class="hand-underline">${escapeHtml(vars.name)}</span>`, vars);
}

/** Lien d'un projet (règle du brief A4) : sa page /{lang}/oss/{slug} quand
 *  elle est indexable, sinon directement son site, en nofollow — on ne
 *  pousse pas les moteurs vers une page que l'on garde hors index. */
export function projectLink(project, lang, isIndexable) {
  if (isIndexable(project)) return { href: `/${lang}/oss/${project.slug}`, rel: '' };
  return { href: project.homepage, rel: ' rel="nofollow noopener"' };
}

/** Accroche d'un projet dans la langue de la page ; à défaut, la version en
 *  signalée `lang="en"` ; à défaut encore, rien (null). */
export function projectTagline(project, lang, projectI18n) {
  const own = projectI18n.get(`${lang}/${project.slug}`)?.tagline;
  if (own) return escapeHtml(own);
  const en = lang === 'en' ? null : projectI18n.get(`en/${project.slug}`)?.tagline;
  return en ? `<span lang="en">${escapeHtml(en)}</span>` : null;
}

/** Étoiles et dernier commit d'un projet, en HTML prêt à poser (tableau de
 *  la fiche, faits de la page projet). Chiffres frais (≤ 45 jours) : la
 *  valeur. Périmés ou absents : un tiret dont le title dit pourquoi — jamais
 *  0, jamais le vieux chiffre présenté comme actuel. `t` = ui.site.tool. */
export function projectStatCells(project, lang, t, today) {
  if (statsAreFresh(project, today)) {
    const compact = new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 });
    return {
      stars: escapeHtml(compact.format(project.stats.stars)),
      commit: escapeHtml(monthYear(project.stats.lastCommit, lang)),
    };
  }
  const why = project.stats?.checkedOn
    ? interpolate(t.statsAsOf, { date: formatDate(project.stats.checkedOn, lang) })
    : t.noGithubFigures;
  const dash = `<span title="${escapeHtml(why)}">${DASH}</span>`;
  return { stars: dash, commit: dash };
}

/** Grille de faits `dl.fact-grid` : une paire libellé / valeur par cellule.
 *  Le libellé est échappé ici, la valeur arrive déjà en HTML (lien, tiret
 *  titré, texte échappé par l'appelant). */
export function renderFactGrid(rows, indent = '        ') {
  return `${indent}<dl class="fact-grid">
${rows.map(([label, value]) => `${indent}  <div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`).join('\n')}
${indent}</dl>`;
}

/** Liens « Comparisons » d'une fiche outil ou d'une page projet : les
 *  comparatifs générés dans la langue (compareLinksFor, site-page-compare.mjs),
 *  en liens simples sous un petit titre. Rien du tout s'il n'y en a pas.
 *  @param {Array<{href:string,label:string}>} comparisons */
export function renderCompareLinks(comparisons, heading) {
  if (!comparisons?.length) return '';
  return `

    <section aria-labelledby="compare-links-heading">
      <h2 class="label" id="compare-links-heading">${escapeHtml(heading)}</h2>
      <ul class="link-cloud">
${comparisons.map(({ href, label }) => `        <li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`).join('\n')}
      </ul>
    </section>`;
}

export function fitTag(fit, t) {
  return `<span class="fit-tag" data-fit="${escapeHtml(fit)}">${escapeHtml(t.fitLabels[fit])}</span>`;
}

/** Date relevée au plus tard parmi les chiffres GitHub encore frais : c'est
 *  la date que la note « chiffres au … » annonce sous le tableau. */
function freshStatsDate(alts, today) {
  const dates = alts.filter(({ project }) => statsAreFresh(project, today)).map(({ project }) => project.stats.checkedOn);
  return dates.length ? dates.sort().at(-1) : null;
}

// ---- en-tête de page --------------------------------------------------------

function renderVerdictPanel({ tool, lang, t, s, verdict, buildDate, voteCount }) {
  const { pricing } = tool;
  // Base de facturation et plan, sous le montant (D14).
  const parts = [s.pricingBasis?.[pricing.basis], pricing.plan ? interpolate(t.planTemplate, { plan: pricing.plan }) : null]
    .filter(Boolean).map(escapeHtml);
  const facts = [];
  // « Ce qu'une année coûte » n'a de sens que pour un prix vraiment récurrent.
  if (MONTHLY_BASES.has(pricing.basis)) {
    const yearly = formatMoney(pricing.amount * 12, pricing.currency, lang);
    facts.push([t.yearCostLabel, `<span title="${escapeHtml(t.yearCostNote)}">${escapeHtml(yearly)}</span>`]);
  }
  const votes = voteCount === null
    ? escapeHtml(t.voteUnavailable)
    : escapeHtml(pluralize(voteCount, lang, t.voteCountOne, t.voteCountOther));
  facts.push([t.votesMetaLabel, votes]);

  return `      <div class="verdict-badge" data-verdict="${tool.verdict}" role="group" aria-label="${escapeHtml(t.verdictHeading)}">
        <p class="vb-q">${escapeHtml(interpolate(t.verdictQuestionTemplate, { name: tool.name }))}</p>
        <p class="vb-word">${escapeHtml(verdict.label)}</p>
        <p class="vb-meta">${escapeHtml(t.verdictRecordedLabel)} <time datetime="${buildDate}">${escapeHtml(formatDate(buildDate, lang))}</time></p>
        <p class="vb-price"><strong>${escapeHtml(formatMonthlyPrice(pricing, lang))}</strong>${parts.length ? ` · ${parts.join(' · ')}` : ''}
          <span class="vb-meta">${templateWithHtml(t.priceSourceTemplate, 'host', `<a href="${escapeHtml(pricing.source)}">${escapeHtml(sourceHost(pricing.source))}</a>`)} · ${escapeHtml(t.priceCheckedLabel)} <time datetime="${pricing.checkedOn}">${escapeHtml(formatDate(pricing.checkedOn, lang))}</time></span></p>
        <dl class="vb-facts">
${facts.map(([label, value]) => `          <div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`).join('\n')}
        </dl>
      </div>`;
}

/** Les trois verdicts, définis, le courant marqué par le texte (« le verdict
 *  de cette fiche ») et par la forme (filet et graisse) — jamais la couleur. */
function renderVerdictLegend(current, s, t) {
  const items = ['yes', 'kinda', 'no'].map((v) => {
    const on = v === current;
    const note = on ? ` <strong>${escapeHtml(t.currentVerdictNote)}</strong>` : '';
    return `          <li${on ? ' aria-current="true"' : ''}>${verdictBadge(v, s.verdicts[v].label)}${note} ${escapeHtml(s.verdicts[v].desc)}</li>`;
  });
  return `      <details class="verdict-legend">
        <summary>${escapeHtml(t.howWeJudge)}</summary>
        <ul>
${items.join('\n')}
        </ul>
      </details>`;
}

function renderWays(t, hasAlternatives) {
  const ways = [
    hasAlternatives ? ['alternatives-heading', t.wayHostTitle, t.wayHostText] : null,
    ['prompt-heading', t.wayBuildTitle, t.wayBuildText],
    ['why-heading', t.wayPayTitle, t.wayPayText],
  ].filter(Boolean);
  const items = ways.map(([id, title, body], i) => `          <li><a href="#${id}"><span class="n" aria-hidden="true">${i + 1}</span><span><strong>${escapeHtml(title)}</strong> ${escapeHtml(body)}</span></a></li>`);
  return `      <nav class="ways" aria-labelledby="ways-heading">
        <p class="label" id="ways-heading">${escapeHtml(t.waysHeading)}</p>
        <ol>
${items.join('\n')}
        </ol>
      </nav>`;
}

// ---- section alternatives --------------------------------------------------

/** Projets cités mais inactifs (archivés, ou sans commit depuis un an) :
 *  hors `n`, hors tableau, hors JSON-LD, mais toujours nommés, avec leur état
 *  en toutes lettres et un lien vers leur site (D14, Ruling 19). Une seule
 *  ligne discrète ; rien du tout s'il n'y en a pas. */
function renderInactive(inactive, lang, t) {
  if (inactive.length === 0) return '';
  const items = inactive.map(({ project, reason, lastCommit }) => {
    const status = reason === 'archived' || !lastCommit
      ? t.inactiveArchived
      : interpolate(t.inactiveLastCommitTemplate, { date: monthYear(lastCommit, lang) });
    return `<a href="${escapeHtml(project.homepage)}" rel="nofollow noopener">${escapeHtml(project.name)}</a> (${escapeHtml(status)})`;
  });
  return `
      <p class="inactive-projects"><strong>${escapeHtml(t.inactiveProjectsLabel)}</strong> ${escapeHtml(t.inactiveProjectsNote)} ${items.join(', ')}</p>`;
}

function renderAlternatives({ tool, alts, inactive, lang, t, s, verdict, projectI18n, i18nEntry, isIndexable, today }) {
  const compact = new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 });

  const projectRows = alts.map(({ project, fit }) => {
    const link = projectLink(project, lang, isIndexable);
    const { stars, commit } = projectStatCells(project, lang, t, today);
    const hosted = project.hosted?.exists
      ? `${escapeHtml(interpolate(t.hostedFromTemplate, { price: formatMoney(project.hosted.priceFrom, project.hosted.currency, lang) }))}`
        + `<span class="sub">${escapeHtml(interpolate(t.checkedOnTemplate, { date: formatDate(project.hosted.checkedOn, lang) }))}</span>`
      : escapeHtml(t.hostedNone);
    return `            <tr>
              <th scope="row"><a href="${escapeHtml(link.href)}"${link.rel}>${escapeHtml(project.name)}</a></th>
              <td>${fitTag(fit, t)}</td>
              <td>${project.license ? escapeHtml(project.license) : DASH}</td>
              <td class="num">${stars}</td>
              <td class="num">${commit}</td>
              <td>${escapeHtml(project.selfHostable ? t.selfHostYes : t.selfHostNo)}</td>
              <td>${hosted}</td>
            </tr>`;
  });

  const buildRow = `            <tr class="other other-first">
              <th scope="row"><a href="#prompt-heading">${escapeHtml(t.buildRowLabel)}</a></th>
              <td>${verdictBadge(tool.verdict, verdict.label)}</td>
              <td>${escapeHtml(t.licenseYours)}</td>
              <td class="num">${DASH}</td>
              <td class="num">${DASH}</td>
              <td>${escapeHtml(t.selfHostYes)}</td>
              <td>${DASH}</td>
            </tr>`;
  const keepRow = `            <tr class="other">
              <th scope="row">${escapeHtml(interpolate(t.keepPayingRowLabel, { name: tool.name }))}</th>
              <td>${fitTag('full', t)}</td>
              <td>${escapeHtml(t.licenseProprietary)}</td>
              <td class="num">${DASH}</td>
              <td class="num">${DASH}</td>
              <td>${escapeHtml(t.selfHostNo)}</td>
              <td>${escapeHtml(formatMonthlyPrice(tool.pricing, lang))}<span class="sub">${escapeHtml(interpolate(t.checkedOnTemplate, { date: formatDate(tool.pricing.checkedOn, lang) }))}</span></td>
            </tr>`;

  const cols = [
    [t.colProject, ''], [interpolate(t.colFit, { name: tool.name }), ''], [t.colLicense, ''],
    [t.colStars, ' class="num"'], [t.colLastCommit, ' class="num"'], [t.colSelfHost, ''], [t.colHosted, ''],
  ].map(([label, cls]) => `<th scope="col"${cls}>${escapeHtml(label)}</th>`).join('');

  const legend = ['full', 'partial', 'niche']
    .map((fit) => `${fitTag(fit, t)} ${escapeHtml(t.fitLegend[fit])}`).join(' · ');
  const asOf = freshStatsDate(alts, today);
  const hint = `      <p class="hint">${legend}.${asOf ? ` ${escapeHtml(interpolate(t.statsAsOf, { date: formatDate(asOf, lang) }))}.` : ''}</p>`;

  const empty = alts.length === 0
    ? `\n      <p class="intro">${escapeHtml(interpolate(t.noAlternatives, { name: tool.name }))}</p>`
    : '';

  const notes = i18nEntry.alternativeNotes ?? {};
  const cards = alts.map(({ project, fit }) => {
    const link = projectLink(project, lang, isIndexable);
    const meta = [fitTag(fit, t)];
    if (project.license) meta.push(escapeHtml(project.license));
    if (statsAreFresh(project, today)) {
      meta.push(escapeHtml(interpolate(t.starsTemplate, { count: compact.format(project.stats.stars) })));
    }
    const github = project.repo ? `https://github.com/${project.repo}` : null;
    if (github && github !== project.homepage) {
      meta.push(`<a href="${escapeHtml(github)}" rel="nofollow noopener">${escapeHtml(interpolate(t.githubRepoTemplate, { repo: project.repo }))}</a>`);
    }
    const tagline = projectTagline(project, lang, projectI18n);
    const note = notes[project.slug];
    return `        <article class="alt-card" id="alt-${project.slug}" aria-labelledby="alt-${project.slug}-h">
          <h3 id="alt-${project.slug}-h">${escapeHtml(project.name)}</h3>
          <p class="alt-card-meta">${meta.join(' <span aria-hidden="true">·</span> ')}</p>${tagline ? `
          <p class="alt-card-what">${tagline}</p>` : ''}${note ? `
          <p class="alt-card-note">${escapeHtml(note)}</p>` : ''}
          <p><a href="${escapeHtml(link.href)}"${link.rel}>${escapeHtml(interpolate(t.seeProjectLink, { name: project.name }))}</a></p>
        </article>`;
  });

  return `    <section aria-labelledby="alternatives-heading">
      <h2 id="alternatives-heading">${escapeHtml(t.alternativesHeading)}</h2>${empty}
      <div class="table-scroll" role="region" aria-labelledby="alternatives-caption" tabindex="0">
        <table class="alt-table">
          <caption id="alternatives-caption">${escapeHtml(interpolate(t.alternativesTableCaption, { name: tool.name }))}</caption>
          <thead><tr>${cols}</tr></thead>
          <tbody>
${[...projectRows, buildRow, keepRow].join('\n')}
          </tbody>
        </table>
      </div>
${hint}${cards.length ? `
      <div class="alt-cards">
${cards.join('\n')}
      </div>` : ''}${renderInactive(inactive, lang, t)}
    </section>`;
}

// ---- le construire ---------------------------------------------------------

function renderBuild({ tool, lang, t, ui, i18nEntry, agents, showSummary }) {
  const promptUrl = `/feed/${FEED_VERSION}/${lang}/prompts/${tool.slug}.txt`;
  const agentButtons = renderAgentButtons(agents, {
    prompt: i18nEntry.prompt, prompt_url: `${SITE_ORIGIN}${promptUrl}`, lang, slug: tool.slug,
  }, t);
  const requirements = (tool.requirements ?? []).map((r) => ui.requirements?.[r] ?? r);
  const facts = [
    [t.buildTimeLabel, ui.diyTimeEstimate?.[tool.diyTimeEstimate] ?? tool.diyTimeEstimate],
    requirements.length ? [t.requirementsLabel, requirements.join(', ')] : null,
    [t.oneShotLabel, tool.verifiedOneShot ? t.oneShotYes : t.oneShotNo],
  ].filter(Boolean);

  // Quand l'intro des alternatives prend le lede, le résumé du verdict passe
  // ici : il parle justement de ce qu'on peut refaire soi-même (D14).
  const summary = showSummary ? `\n          <p>${escapeHtml(i18nEntry.verdictSummary)}</p>` : '';

  return `    <section aria-labelledby="prompt-heading" class="build">
      <div class="build-text">
        <h2 id="prompt-heading">${escapeHtml(t.promptHeading)}</h2>${summary}
        <p>${escapeHtml(i18nEntry.coreLoopDIY)}</p>
${renderFactGrid(facts.map(([label, value]) => [label, escapeHtml(value)]))}
      </div>
      <div class="build-prompt">
        <div class="prompt-block">
          <div class="prompt-header">
            <div class="prompt-actions">
              <button id="copy-prompt" class="copy-btn" type="button" hidden
                data-copied-label="${escapeHtml(t.copiedButton)}"
                data-fail-label="${escapeHtml(t.copyFailed)}">${escapeHtml(t.copyButton)}</button>
              ${agentButtons}
            </div>
          </div>
          <pre><code id="prompt-text">${escapeHtml(i18nEntry.prompt)}</code></pre>
        </div>
        <p class="prompt-caption">${escapeHtml(t.promptOpenCaption)} <a href="${promptUrl}">${escapeHtml(t.rawPromptLink)}</a></p>
        <p class="status" id="copy-status" role="status" aria-live="polite"></p>
      </div>
    </section>`;
}

// ---- après la FAQ : vote, outils liés --------------------------------------

function renderVote({ tool, lang, path, t, verdict, voteCount }) {
  const attrs = `id="vote-count" data-vote-slug="${tool.slug}" data-lang="${lang}" data-singular="${escapeHtml(t.voteCountOne)}" data-plural="${escapeHtml(t.voteCountOther)}"`;
  const voteBadge = voteCount === null
    ? `<span class="vote-count-badge" ${attrs} hidden></span>`
    : `<span class="vote-count-badge" ${attrs}>(${escapeHtml(pluralize(voteCount, lang, t.voteCountOne, t.voteCountOther))})</span>`;
  const shareText = interpolate(t.shareTextTemplate, { name: tool.name, verdict: verdict.label });
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(`${SITE_ORIGIN}${path}`)}`;
  return `    <section class="vote-section" aria-labelledby="vote-heading">
      <h2 id="vote-heading">${escapeHtml(t.voteHeading)}</h2>
      <div class="vote-row">
        <button id="vote-btn" class="vote-btn" type="button" data-slug="${tool.slug}"
          data-msg-thanks="${escapeHtml(t.voteThanks)}"
          data-msg-already="${escapeHtml(t.voteAlready)}"
          data-msg-error="${escapeHtml(t.voteError)}">${escapeHtml(t.voteButton)} ${voteBadge}</button>
        <a class="share-x-btn" href="${escapeHtml(shareUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.shareOnXLabel)}</a>
      </div>
      <p class="status" id="vote-status" role="status" aria-live="polite"></p>
    </section>`;
}

function renderRelated({ relatedTools, lang, s, t, categories, favicons }) {
  if (relatedTools.length === 0) return '';
  const cards = relatedTools.map((r) => {
    const rFavicon = favicons?.[r.slug] ?? PLACEHOLDER_PATH;
    return `        <li class="related-card">
          <a href="${escapeHtml(r.path)}">
            <img src="${escapeHtml(rFavicon)}" alt="" width="28" height="28" loading="lazy">
            <span class="related-card-name">${escapeHtml(r.name)}</span>
            ${verdictBadge(r.verdict, s.verdicts[r.verdict].label)}
            <span class="related-card-meta">${escapeHtml(formatMonthlyPrice(r.pricing, lang))} &middot; ${escapeHtml(categoryLabel(categories, r.category, lang))}</span>
          </a>
        </li>`;
  });
  return `

    <section aria-labelledby="related-heading">
      <h2 id="related-heading">${escapeHtml(t.relatedHeading)}</h2>
      <ul class="related-cards">
${cards.join('\n')}
      </ul>
    </section>`;
}

/**
 * Fiche outil, page « alternatives ».
 *
 * @param {object} opts  — en plus des champs historiques :
 * @param {Map<string, object>} opts.projects  slug → projet (loadData().projects)
 * @param {Map<string, object>} opts.projectI18n  'lang/slug' → textes projet
 * @param {string} opts.today  date du build, 'YYYY-MM-DD' (fraîcheur des chiffres)
 * @param {(project: object) => boolean} [opts.projectIndexable]  vrai si la page
 *   /{lang}/oss/{slug} du projet est indexable (indexable.project) ; absent,
 *   chaque projet renvoie vers son site
 * @param {Array<{href:string,label:string}>} [opts.comparisons]  comparatifs générés
 *   dans la langue où l'outil figure (compareLinksFor) ; vide, aucune section
 */
export function renderToolPage({
  lang, path, tool, i18nEntry, categories, ui, alternates, xDefaultPath, homePath,
  categoryPath, relatedTools, voteCount, favicons, agents, sponsorSlots, buildDate,
  projects, projectI18n = new Map(), today, projectIndexable = () => false, comparisons = [],
}) {
  const s = { ...ui.site, pricingBasis: ui.pricingBasis };
  const t = s.tool;
  const verdict = s.verdicts[tool.verdict];
  const catLabel = categoryLabel(categories, tool.category, lang);
  const favicon = favicons?.[tool.slug] ?? PLACEHOLDER_PATH;

  const alts = alternativesFor(tool, projects ?? new Map(), today);
  const vars = toolTitleVars(tool, alts, buildDate);
  const dateModified = toolDateModified(tool, alts);
  const price = formatMonthlyPrice(tool.pricing, lang);
  const build = lowerFirst(ui.diyTimeEstimate?.[tool.diyTimeEstimate] ?? tool.diyTimeEstimate);

  const title = interpolate(vars.fallback ? t.titleFallbackTemplate : t.titleTemplate, vars);
  const top3 = new Intl.ListFormat(lang, { style: 'long', type: 'conjunction' })
    .format(alts.slice(0, 3).map(({ project }) => project.name));
  const description = interpolate(
    vars.fallback ? t.metaDescriptionFallbackTemplate : t.metaDescriptionTemplate,
    { ...vars, top3, build, price },
  );
  const h1 = headingWithName(vars.fallback ? t.h1FallbackTemplate : t.h1Template, vars);

  const breadcrumbItems = [
    { label: s.directoryLabel, href: homePath },
    { label: catLabel, href: categoryPath },
    { label: tool.name, href: path },
  ];

  const lede = i18nEntry.alternativesIntro ?? i18nEntry.verdictSummary;
  const eyebrow = [
    `<a href="${escapeHtml(categoryPath)}">${escapeHtml(catLabel)}</a>`,
    tool.subcategory ? escapeHtml(tool.subcategory) : null,
    `${escapeHtml(t.lastUpdatedLabel)} <time datetime="${dateModified}">${escapeHtml(formatDate(dateModified, lang))}</time>`,
  ].filter(Boolean).join(' · ');

  const head = `    <header class="page-head">
      <div class="head-text">
        ${renderBreadcrumb(breadcrumbItems)}
        <p class="eyebrow">${eyebrow}</p>
        <h1><img class="tool-favicon" src="${escapeHtml(favicon)}" alt="" width="40" height="40"> ${h1}</h1>
      </div>
      <div class="vb-col">
${renderVerdictPanel({ tool, lang, t, s, verdict, buildDate, voteCount })}
${renderVerdictLegend(tool.verdict, s, t)}
      </div>
      <p class="lede">${escapeHtml(lede)}</p>
${renderWays(t, alts.length > 0)}
    </header>`;

  const isIndexable = (project) => Boolean(projectIndexable?.(project));

  const lose = `    <section aria-labelledby="lose-heading">
      <h2 id="lose-heading">${escapeHtml(t.whatYouLoseHeading)}</h2>
      <ul class="lose-list">
${i18nEntry.whatYouLose.map((item) => `        <li>${escapeHtml(item)}</li>`).join('\n')}
      </ul>
    </section>`;

  const why = `    <section aria-labelledby="why-heading" class="why">
      <h2 id="why-heading">${escapeHtml(interpolate(t.whyPeopleStillPayHeadingTemplate, { name: tool.name, moat: tool.moatType }))}</h2>
      <p class="moat"><span class="label">${escapeHtml(t.moatLabel)}</span> ${escapeHtml(tool.moatType)}</p>
      <blockquote class="quote"><p>${escapeHtml(i18nEntry.whyPeopleStillPay)}</p></blockquote>${i18nEntry.notes ? `
      <p class="quote-note">${escapeHtml(i18nEntry.notes)}</p>` : ''}
    </section>`;

  const faq = `    <section aria-labelledby="faq-heading" class="faq">
      <h2 id="faq-heading">${escapeHtml(t.faqHeading)}</h2>
${i18nEntry.faq.map((entry) => `      <details>
        <summary>${escapeHtml(entry.q)}</summary>
        <p>${escapeHtml(entry.a)}</p>
      </details>`).join('\n')}
    </section>`;

  const main = `${head}

${renderAlternatives({ tool, alts, inactive: inactiveAlternativesFor(tool, projects ?? new Map(), today), lang, t, s, verdict, projectI18n, i18nEntry, isIndexable, today })}

${renderBuild({ tool, lang, t, ui, i18nEntry, agents, showSummary: Boolean(i18nEntry.alternativesIntro) })}

${lose}

${why}

${faq}

${renderVote({ tool, lang, path, t, verdict, voteCount })}${renderRelated({ relatedTools, lang, s, t, categories, favicons })}${renderCompareLinks(comparisons, s.compare.linksHeading)}`;

  const itemList = alts.length === 0 ? [] : [softwareItemListJsonLd(alts.map(({ project }) => {
    const { href } = projectLink(project, lang, isIndexable);
    return {
      name: project.name,
      url: href.startsWith('/') ? `${SITE_ORIGIN}${href}` : href,
      applicationCategory: catLabel,
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
    jsonLd: [
      organizationJsonLd(),
      breadcrumbJsonLd(breadcrumbItems),
      webPageJsonLd({ path, name: title, description, lang, dateModified }),
      ...itemList,
      faqPageJsonLd(i18nEntry.faq),
    ],
    main,
    ui,
    homeHref: homePath,
    sponsorSlots,
  });
}
