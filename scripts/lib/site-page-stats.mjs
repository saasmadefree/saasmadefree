// La page /stats (spec §9) : coquille rendue au build, chiffres vivants
// remplis par scripts/assets/stats.js depuis GET /api/v1/stats. Les blocs
// « catalogue » sont calculés au build depuis data/ — mêmes chiffres que
// `npm run stats`, jamais recopiés à la main — et restent exacts même si
// l'API est injoignable.
//
// Refonte du 23.08.2026 : la grille de canivibecodeit.com/stats, dans le
// vocabulaire de l'accueil (.recap-label / .recap-value) — un libellé condensé
// en capitales, un gros chiffre, une légende courte. Les explications de
// méthode (hachages salés, pays au niveau réseau, double comptage des
// crawlers) ne vivent plus dans les tuiles, qui gonflaient chacune à sa
// hauteur : elles forment un seul bloc de notes en bas de page.
import { renderLayout, escapeHtml } from './site-html.mjs';
import { STATS_API_URL } from './site-data.mjs';

// Une tuile : libellé, chiffre (tiret tant que stats.js n'a pas répondu, ou
// valeur de build), légende. `dot` colore un carré devant le libellé — la
// couleur accompagne toujours le texte du verdict, jamais seule (principe 2).
function tile({ id, label, value = '—', caption, captionId, dot, extra = '' }) {
  const dotHtml = dot ? `<span class="stat-dot ${dot}" aria-hidden="true"></span> ` : '';
  const idAttr = id ? ` id="${id}"` : '';
  const captionAttr = captionId ? ` id="${captionId}"` : '';
  return `<div class="stat-tile${extra}">
    <span class="stat-label">${dotHtml}${escapeHtml(label)}</span>
    <span class="stat-value"${idAttr}>${escapeHtml(String(value))}</span>
    <span class="stat-caption"${captionAttr}>${escapeHtml(caption)}</span>
  </div>`;
}

function sheet(title, body, titleTag = 'h2') {
  return `<section class="stats-sheet">
    <${titleTag} class="stats-h">${escapeHtml(title)}</${titleTag}>
    ${body}
  </section>`;
}

function block(title, id, kind = 'bar-list') {
  return `<h3 class="stats-h">${escapeHtml(title)}</h3>
    <div class="${kind}" id="${id}"></div>`;
}

export function renderStatsPage({
  lang, path, ui, alternates, xDefaultPath, homePath, toolCount, verdictCounts,
}) {
  const t = ui.site.stats;
  const verdicts = ui.site.verdicts;
  const total = Math.max(1, toolCount);
  const nf = new Intl.NumberFormat(lang);
  const pct = (v) => Math.round(((verdictCounts[v] ?? 0) / total) * 100);

  // La barre empilée reprend les trois encres de verdict ; son texte est dans
  // les tuiles juste au-dessus, elle n'ajoute rien pour un lecteur d'écran.
  const stack = ['yes', 'kinda', 'no']
    .map((v) => `<span class="vs-${v}" style="width:${pct(v)}%"></span>`)
    .join('');

  // Les libellés dont stats.js a besoin côté client (états vides, périodes,
  // « dernier passage », légendes à date) voyagent en data-attribute : pas
  // d'i18n en JS.
  const i18nPayload = escapeHtml(JSON.stringify({
    noData: t.noData, d7: t.d7, d30: t.d30, lastSeen: t.lastSeen, votesTotal: t.votesTotal,
    peakCaption: t.peakCaption, allTimeSince: t.allTimeSince,
  }));

  const main = `
<div class="stats-page" data-stats-api="${STATS_API_URL}" data-stats-i18n="${i18nPayload}">
  <header class="stats-head">
    <h1>${escapeHtml(t.title)}</h1>
    <p class="stats-tagline">${escapeHtml(t.tagline)}</p>
  </header>
  <p id="stats-live-error" class="stats-error" hidden>${escapeHtml(t.liveUnavailable)}</p>

  <div class="stat-grid">
    ${tile({ id: 'stat-peak', label: t.peakDay, caption: t.peakCaption.replace(' · {date}', ''), captionId: 'stat-peak-caption' })}
    ${tile({ id: 'stat-views-today', label: t.viewsToday, caption: t.todayCaption })}
    ${tile({ id: 'stat-visitor-days', label: t.visitorDays, caption: t.visitorsCaption })}
    ${tile({ id: 'stat-copies', label: t.promptsCopied, caption: t.copiesCaption })}
  </div>

  <div class="stats-band">
    <span>${escapeHtml(t.allTimeTitle)}</span>
    <span id="stats-since"></span>
  </div>
  <div class="stat-grid">
    ${tile({ id: 'stat-all-views', label: t.allTimeViews, caption: t.allViewsCaption })}
    ${tile({ id: 'stat-all-visitor-days', label: t.allTimeVisitorDays, caption: t.allVisitorDaysCaption })}
    ${tile({ id: 'stat-all-copies', label: t.allTimeCopies, caption: t.allCopiesCaption })}
    ${tile({ id: 'stat-days-on-air', label: t.daysOnAir, caption: t.daysOnAirCaption })}
  </div>

  ${sheet(t.views14d, `<canvas id="views-chart" class="views-chart" role="img" aria-label="${escapeHtml(t.views14d)}"></canvas>`)}

  <div class="stats-cols">
    ${sheet(t.topPages, `<div class="bar-list" id="top-pages"></div>`)}
    <section class="stats-sheet">
      ${block(t.byCountry, 'by-country', 'chip-list')}
      ${block(t.viewsByLang, 'views-langs', 'chip-list')}
    </section>
  </div>

  <div class="stats-cols">
    <section class="stats-sheet">
      ${block(t.copiesByAgent, 'copies-agents')}
      ${block(t.topPrompts, 'top-prompts')}
    </section>
    <section class="stats-sheet">
      ${block(t.aiVisitors, 'ai-referrals', 'crawler-list')}
      <h3 class="stats-h">${escapeHtml(t.votesTitle)} <span class="stats-h-aside" id="votes-total"></span></h3>
      <div class="bar-list" id="top-voted"></div>
    </section>
  </div>

  ${sheet(t.crawlers, `<div class="crawler-list" id="ai-crawlers"></div>`)}

  <section>
    <div class="stats-band"><span>${escapeHtml(t.catalogueTitle)}</span></div>
    <div class="stat-grid">
      ${tile({ label: t.catalogueToolsLabel, value: nf.format(toolCount), caption: t.catalogueToolsCaption })}
      ${tile({ label: verdicts.yes.label, value: nf.format(verdictCounts.yes ?? 0), caption: `${pct('yes')} % · ${t.yesCaption}`, dot: 'yes' })}
      ${tile({ label: verdicts.kinda.label, value: nf.format(verdictCounts.kinda ?? 0), caption: `${pct('kinda')} % · ${t.kindaCaption}`, dot: 'kinda' })}
      ${tile({ label: verdicts.no.label, value: nf.format(verdictCounts.no ?? 0), caption: `${pct('no')} % · ${t.noCaption}`, dot: 'no' })}
    </div>
    <div class="verdict-stack" aria-hidden="true">${stack}</div>
  </section>

  <section class="stats-notes" aria-label="${escapeHtml(t.notesTitle)}">
    <h2 class="stats-h">${escapeHtml(t.notesTitle)}</h2>
    <p>${escapeHtml(t.intro)}</p>
    <p>${escapeHtml(t.allTimeVisitorDaysNote)}</p>
    <p>${escapeHtml(t.byCountryNote)}</p>
    <p>${escapeHtml(t.crawlersNote)}</p>
    <p>${escapeHtml(t.aiVisitorsNote)}</p>
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
