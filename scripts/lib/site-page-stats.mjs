// La page /stats (spec §9) : coquille rendue au build, chiffres vivants
// remplis par scripts/assets/stats.js depuis GET /api/v1/stats. Les blocs
// « catalogue » sont calculés au build depuis data/ — mêmes chiffres que
// `npm run stats`, jamais recopiés à la main — et restent exacts même si
// l'API est injoignable.
import { renderLayout, escapeHtml } from './site-html.mjs';
import { STATS_API_URL } from './site-data.mjs';

function tile(id, label, note = '') {
  return `<div class="stat-tile">
    <span class="stat-value" id="${id}">—</span>
    <span class="stat-label">${escapeHtml(label)}</span>${note ? `
    <small class="stat-note">${escapeHtml(note)}</small>` : ''}
  </div>`;
}

function listSection(titleTag, id, title, note = '') {
  return `<section class="stats-section">
    <${titleTag}>${escapeHtml(title)}</${titleTag}>${note ? `
    <p class="stats-note">${escapeHtml(note)}</p>` : ''}
    <div class="bar-list" id="${id}"></div>
  </section>`;
}

export function renderStatsPage({
  lang, path, ui, alternates, xDefaultPath, homePath, toolCount, verdictCounts,
}) {
  const t = ui.site.stats;
  const verdicts = ui.site.verdicts;
  const total = Math.max(1, toolCount);
  const verdictRows = ['yes', 'kinda', 'no'].map((verdict) => {
    const count = verdictCounts[verdict] ?? 0;
    const pct = Math.round((count / total) * 100);
    return `<div class="bar-row">
      <span class="bar-label"><span class="badge ${verdict}">${escapeHtml(verdicts[verdict].label)}</span></span>
      <span class="bar-track"><span class="bar-fill ${verdict}" style="width:${pct}%"></span></span>
      <span class="bar-value">${count} · ${pct}%</span>
    </div>`;
  }).join('\n');

  // Les libellés dont stats.js a besoin côté client (états vides, périodes,
  // « dernier passage ») voyagent en data-attribute : pas de i18n en JS.
  const i18nPayload = escapeHtml(JSON.stringify({
    noneYet: t.noneYet, d7: t.d7, d30: t.d30, lastSeen: t.lastSeen, votesTotal: t.votesTotal,
  }));

  const main = `
<div class="stats-page" data-stats-api="${STATS_API_URL}" data-stats-i18n="${i18nPayload}">
  <section class="stats-hero">
    <h1>${escapeHtml(t.title)}</h1>
    <p class="stats-intro">${escapeHtml(t.intro)}</p>
    <p id="stats-live-error" class="stats-error" hidden>${escapeHtml(t.liveUnavailable)}</p>
  </section>

  <section class="stat-tiles">
    ${tile('stat-views-today', t.viewsToday)}
    ${tile('stat-peak', t.peakDay)}
    ${tile('stat-visitor-days', t.visitorDays, t.visitorDaysNote)}
    ${tile('stat-copies', t.promptsCopied)}
  </section>

  <section class="stats-section">
    <h2>${escapeHtml(t.views14d)}</h2>
    <canvas id="views-chart" width="900" height="220" role="img" aria-label="${escapeHtml(t.views14d)}"></canvas>
  </section>

  <section class="stats-section stats-ai">
    <h2>${escapeHtml(t.citedByAi)}</h2>
    <h3>${escapeHtml(t.aiVisitors)}</h3>
    <p class="stats-note">${escapeHtml(t.aiVisitorsNote)}</p>
    <div class="bar-list" id="ai-referrals"></div>
    <h3>${escapeHtml(t.crawlers)}</h3>
    <p class="stats-note">${escapeHtml(t.crawlersNote)}</p>
    <div class="crawler-list" id="ai-crawlers"></div>
  </section>

  ${listSection('h2', 'top-pages', t.topPages)}
  ${listSection('h2', 'views-langs', t.viewsByLang)}
  ${listSection('h2', 'copies-agents', t.copiesByAgent)}
  ${listSection('h2', 'top-prompts', t.topPrompts)}

  <section class="stats-section">
    <h2>${escapeHtml(t.votesTitle)}</h2>
    <p id="votes-total">—</p>
    <h3>${escapeHtml(t.topVoted)}</h3>
    <div class="bar-list" id="top-voted"></div>
  </section>

  <section class="stats-section stats-catalogue">
    <h2>${escapeHtml(t.catalogueTitle)}</h2>
    <p>${escapeHtml(t.catalogueTools.replace('{count}', String(toolCount)))}</p>
    ${verdictRows}
  </section>
</div>
<script src="/assets/stats.js" defer></script>`;

  return renderLayout({
    lang, path,
    title: `${t.title} — ${ui.site.brand}`,
    description: t.metaDescription,
    alternates, xDefaultPath,
    main, ui, homeHref: homePath,
  });
}
