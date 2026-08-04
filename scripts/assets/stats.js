// Remplit la page /stats depuis GET /api/v1/stats (réponse cachée 60 s à
// l'edge — c'est le « rafraîchi chaque minute » de l'encart). Sans réseau ou
// sans JS, la page reste utile : les blocs catalogue sont rendus au build,
// et #stats-live-error explique l'absence des compteurs vivants. Graphe en
// canvas vanilla, couleurs lues dans les variables CSS du thème.
(function () {
  'use strict';

  var root = document.querySelector('.stats-page');
  if (!root) return;
  var API = root.dataset.statsApi;
  var I18N = {};
  try { I18N = JSON.parse(root.dataset.statsI18n || '{}'); } catch (e) {}
  var fmt = new Intl.NumberFormat(document.documentElement.lang || 'en');

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function empty(container) {
    var p = document.createElement('p');
    p.className = 'stats-empty';
    p.textContent = I18N.noneYet || '—';
    container.appendChild(p);
  }

  // Liste à barres horizontales : rows = [{label, value}], barre relative au max.
  function renderBars(id, rows) {
    var container = document.getElementById(id);
    if (!container) return;
    container.textContent = '';
    if (!rows || rows.length === 0) { empty(container); return; }
    var max = rows[0].value;
    for (var i = 0; i < rows.length; i++) if (rows[i].value > max) max = rows[i].value;
    for (var j = 0; j < rows.length; j++) {
      var row = document.createElement('div');
      row.className = 'bar-row';
      var label = document.createElement('span');
      label.className = 'bar-label';
      label.textContent = rows[j].label;
      label.title = rows[j].label;
      var track = document.createElement('span');
      track.className = 'bar-track';
      var fill = document.createElement('span');
      fill.className = 'bar-fill';
      fill.style.width = (max > 0 ? Math.max(2, Math.round((rows[j].value / max) * 100)) : 0) + '%';
      track.appendChild(fill);
      var value = document.createElement('span');
      value.className = 'bar-value';
      value.textContent = fmt.format(rows[j].value);
      row.appendChild(label); row.appendChild(track); row.appendChild(value);
      container.appendChild(row);
    }
  }

  // Les 14 derniers jours, trous comblés à zéro : l'API ne renvoie que les
  // jours où quelque chose s'est passé.
  function fullSeries(views14d) {
    var byDay = {};
    for (var i = 0; i < views14d.length; i++) byDay[views14d[i].day] = views14d[i].views;
    var series = [];
    var now = Date.now();
    for (var d = 13; d >= 0; d--) {
      var day = new Date(now - d * 86400000).toISOString().slice(0, 10);
      series.push({ day: day, views: byDay[day] || 0 });
    }
    return series;
  }

  function drawChart(series) {
    var canvas = document.getElementById('views-chart');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    var pad = 24, gap = 6;
    ctx.clearRect(0, 0, w, h);
    var max = 1;
    for (var i = 0; i < series.length; i++) if (series[i].views > max) max = series[i].views;
    var barW = (w - pad * 2 - gap * (series.length - 1)) / series.length;
    ctx.fillStyle = cssVar('--accent') || '#15803d';
    for (var j = 0; j < series.length; j++) {
      var barH = Math.round((series[j].views / max) * (h - pad * 2));
      if (series[j].views > 0 && barH < 2) barH = 2;
      var x = pad + j * (barW + gap);
      ctx.fillRect(x, h - pad - barH, barW, barH);
    }
    ctx.fillStyle = cssVar('--muted') || '#6b6a5e';
    ctx.font = '11px ' + (cssVar('--mono') || 'monospace');
    ctx.textAlign = 'left';
    ctx.fillText(series[0].day.slice(5), pad, h - 7);
    ctx.textAlign = 'right';
    ctx.fillText(series[series.length - 1].day.slice(5), w - pad, h - 7);
    ctx.fillText(fmt.format(max), w - pad, pad - 8 > 10 ? pad - 8 : 10);
  }

  function renderCrawlers(crawlers) {
    var container = document.getElementById('ai-crawlers');
    if (!container) return;
    container.textContent = '';
    if (!crawlers || crawlers.length === 0) { empty(container); return; }
    for (var i = 0; i < crawlers.length; i++) {
      var c = crawlers[i];
      var row = document.createElement('div');
      row.className = 'crawler-row';
      var name = document.createElement('span');
      name.textContent = c.label;
      var vendor = document.createElement('span');
      vendor.className = 'crawler-vendor';
      vendor.textContent = c.vendor;
      name.appendChild(vendor);
      var counts = document.createElement('span');
      counts.className = 'crawler-counts';
      counts.textContent = 'edge ' + fmt.format(c.edge) + ' · cf ' + fmt.format(c.cf);
      var seen = document.createElement('span');
      seen.className = 'crawler-counts';
      seen.textContent = c.lastSeen ? (I18N.lastSeen || 'last seen') + ' ' + c.lastSeen : '';
      row.appendChild(name); row.appendChild(counts); row.appendChild(seen);
      container.appendChild(row);
    }
  }

  function renderReferrals(aiReferrals) {
    // Fusion 7 j / 30 j : une ligne par IA, « n7 · n30 » en valeur.
    var container = document.getElementById('ai-referrals');
    if (!container) return;
    container.textContent = '';
    var by = {};
    var i;
    for (i = 0; i < aiReferrals.d30.length; i++) by[aiReferrals.d30[i].ai] = { d7: 0, d30: aiReferrals.d30[i].n };
    for (i = 0; i < aiReferrals.d7.length; i++) {
      if (!by[aiReferrals.d7[i].ai]) by[aiReferrals.d7[i].ai] = { d7: 0, d30: 0 };
      by[aiReferrals.d7[i].ai].d7 = aiReferrals.d7[i].n;
    }
    var ais = Object.keys(by);
    if (ais.length === 0) { empty(container); return; }
    ais.sort(function (a, b) { return by[b].d30 - by[a].d30; });
    for (i = 0; i < ais.length; i++) {
      var row = document.createElement('div');
      row.className = 'crawler-row';
      var label = document.createElement('span');
      label.textContent = ais[i];
      var counts = document.createElement('span');
      counts.className = 'crawler-counts';
      counts.textContent = (I18N.d7 || '7d') + ' ' + fmt.format(by[ais[i]].d7) +
        ' · ' + (I18N.d30 || '30d') + ' ' + fmt.format(by[ais[i]].d30);
      row.appendChild(label); row.appendChild(counts); row.appendChild(document.createElement('span'));
      container.appendChild(row);
    }
  }

  var lastPayload = null;

  function renderAll(payload) {
    lastPayload = payload;
    setText('stat-views-today', fmt.format(payload.today.views));
    setText('stat-peak', payload.peak ? fmt.format(payload.peak.views) : '—');
    setText('stat-visitor-days', fmt.format(payload.visitors7d));
    setText('stat-copies', fmt.format(payload.copies7d.total));
    drawChart(fullSeries(payload.views14d));
    renderReferrals(payload.aiReferrals);
    renderCrawlers(payload.crawlers7d);
    renderBars('top-pages', payload.topPages7d.map(function (r) { return { label: r.path, value: r.views }; }));
    renderBars('views-langs', payload.langs7d.map(function (r) { return { label: r.lang, value: r.views }; }));
    renderBars('copies-agents', payload.copies7d.byAgent.map(function (r) { return { label: r.agent, value: r.n }; }));
    renderBars('top-prompts', payload.copies7d.topPrompts.map(function (r) { return { label: r.slug, value: r.n }; }));
    setText('votes-total', (I18N.votesTotal || '{count}').replace('{count}', fmt.format(payload.votes.total)));
    renderBars('top-voted', payload.votes.top.map(function (r) { return { label: r.slug, value: r.n }; }));
  }

  fetch(API)
    .then(function (res) { if (!res.ok) throw new Error('http ' + res.status); return res.json(); })
    .then(renderAll)
    .catch(function () {
      var err = document.getElementById('stats-live-error');
      if (err) err.hidden = false;
    });

  // Le graphe lit les couleurs du thème au moment du dessin : redessiner
  // quand la bascule clair/sombre change data-theme sur <html>.
  new MutationObserver(function () {
    if (lastPayload) drawChart(fullSeries(lastPayload.views14d));
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
