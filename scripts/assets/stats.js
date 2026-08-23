// Remplit la page /stats depuis GET /api/v1/stats (réponse cachée 60 s à
// l'edge — c'est le « rafraîchi chaque minute » de la ligne de titre). Sans
// réseau ou sans JS, la page reste utile : le bloc catalogue est rendu au
// build, et #stats-live-error explique l'absence des compteurs vivants.
// Graphe en canvas vanilla, couleurs lues dans les variables CSS du thème.
(function () {
  'use strict';

  var root = document.querySelector('.stats-page');
  if (!root) return;
  var API = root.dataset.statsApi;
  var I18N = {};
  try { I18N = JSON.parse(root.dataset.statsI18n || '{}'); } catch (e) {}
  var LANG = document.documentElement.lang || 'en';
  var fmt = new Intl.NumberFormat(LANG);
  // « 29 juil. 2026 » / « 29 Jul 2026 » : la date est lue telle quelle de
  // l'API (jour UTC), jamais recalculée dans le fuseau du lecteur — un
  // premier jour ne change pas selon l'endroit d'où on le regarde.
  function longDate(iso) {
    var p = iso.split('-');
    return new Intl.DateTimeFormat(LANG, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])));
  }
  function shortDate(iso) {
    var p = iso.split('-');
    return new Intl.DateTimeFormat(LANG, { day: 'numeric', month: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])));
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // État vide : une ligne, pas un paragraphe. Le tiret vient du CSS.
  function empty(container) {
    var p = document.createElement('p');
    p.className = 'stats-empty';
    p.textContent = I18N.noData || '—';
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

  // Puces « 🇫🇷 FR 820 » : le drapeau est dérivé du code ISO (deux indicateurs
  // régionaux), rien n'est téléchargé. Un code inconnu reste un code.
  function flag(cc) {
    if (!/^[A-Z]{2}$/.test(cc)) return '';
    return String.fromCodePoint(0x1F1E6 + cc.charCodeAt(0) - 65, 0x1F1E6 + cc.charCodeAt(1) - 65);
  }
  function renderChips(id, rows, withFlag) {
    var container = document.getElementById(id);
    if (!container) return;
    container.textContent = '';
    if (!rows || rows.length === 0) { empty(container); return; }
    for (var i = 0; i < rows.length; i++) {
      var chip = document.createElement('span');
      chip.className = 'stat-chip';
      var code = String(rows[i].label).toUpperCase();
      var f = withFlag ? flag(code) : '';
      if (f) {
        var em = document.createElement('span');
        em.className = 'chip-flag';
        em.setAttribute('aria-hidden', 'true');
        em.textContent = f;
        chip.appendChild(em);
      }
      var txt = document.createElement('span');
      txt.textContent = code;
      var n = document.createElement('b');
      n.textContent = fmt.format(rows[i].value);
      chip.appendChild(txt); chip.appendChild(n);
      container.appendChild(chip);
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

  // Quatre paliers entiers pour l'axe : le pas est le premier 1, 2, 5 × 10^n
  // qui dépasse max/4, le sommet vaut quatre pas. Un axe 0 / 20 / 40 / 60 / 80
  // se lit ; 0 / 25 / 50 / 75 / 100 pour un max de 62 laisse le graphe à plat.
  function niceMax(max) {
    var quarter = Math.max(1, max / 4);
    var pow = Math.pow(10, Math.floor(Math.log10(quarter)));
    var steps = [1, 2, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * pow >= quarter) return steps[i] * pow * 4;
    return 40 * pow;
  }

  // Trame de points dans l'encre du stylo : la demi-teinte d'un imprimé, pas
  // un dégradé. Le carreau de 4 px est rendu à la densité de l'écran puis
  // ramené à l'échelle CSS par la transformation du motif : net sur Retina.
  function dotPattern(ctx, color) {
    var dpr = window.devicePixelRatio || 1;
    var tile = document.createElement('canvas');
    tile.width = tile.height = Math.round(4 * dpr);
    var t = tile.getContext('2d');
    t.fillStyle = color;
    t.beginPath();
    t.arc(2 * dpr, 2 * dpr, 0.8 * dpr, 0, Math.PI * 2);
    t.fill();
    var pattern = ctx.createPattern(tile, 'repeat');
    if (pattern && pattern.setTransform && window.DOMMatrix) pattern.setTransform(new DOMMatrix().scale(1 / dpr));
    return pattern;
  }

  // Les couleurs sont lues dans le thème au moment du dessin, jamais figées :
  // la bascule clair/sombre repasse par ici (voir redraw en bas de fichier).
  function palette() {
    return {
      ink: cssVar('--accent') || '#2d3a52',
      text: cssVar('--ink') || '#2b2317',
      muted: cssVar('--muted') || '#6b6a5e',
      rule: cssVar('--rule') || '#d9d2c2',
      sheet: cssVar('--card') || '#fbfaf6',
      mono: cssVar('--mono') || 'monospace',
    };
  }

  // Le graphe est confié à Chart.js (servi depuis notre origine, voir
  // site-assets.mjs) pour ce qu'un canvas maison ne donne pas : le survol.
  // `mode: 'index'` lit la colonne entière sous le curseur, donc chaque jour
  // se lit au passage, pas seulement le pic. Aucune animation : le monde
  // imprimé ne bouge pas, et prefers-reduced-motion n'a rien à désactiver.
  var chart = null;

  function styleChart(c, pal, top) {
    var ds = c.data.datasets[0];
    ds.borderColor = pal.ink;
    ds.pointBackgroundColor = pal.ink;
    ds.backgroundColor = dotPattern(c.ctx, pal.ink);
    var o = c.options;
    o.plugins.tooltip.backgroundColor = pal.sheet;
    o.plugins.tooltip.titleColor = pal.muted;
    o.plugins.tooltip.bodyColor = pal.text;
    o.plugins.tooltip.borderColor = pal.text;
    o.plugins.tooltip.titleFont.family = pal.mono;
    o.plugins.tooltip.bodyFont.family = pal.mono;
    o.scales.x.ticks.color = pal.muted;
    o.scales.x.ticks.font.family = pal.mono;
    o.scales.x.border.color = pal.rule;
    o.scales.y.ticks.color = pal.muted;
    o.scales.y.ticks.font.family = pal.mono;
    o.scales.y.grid.color = pal.rule;
    o.scales.y.max = top;
    o.scales.y.ticks.stepSize = top / 4;
  }

  function drawChart(series) {
    var canvas = document.getElementById('views-chart');
    if (!canvas || !window.Chart) return;
    var pal = palette();
    var labels = series.map(function (s) { return s.day; });
    var data = series.map(function (s) { return s.views; });
    var max = 0;
    for (var i = 0; i < data.length; i++) if (data[i] > max) max = data[i];
    var top = niceMax(max);
    var last = series.length - 1;

    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = data;
      styleChart(chart, pal, top);
      chart.update();
      return;
    }

    chart = new window.Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: data, fill: 'origin', borderWidth: 2, tension: 0,
          pointRadius: 2.5, pointHoverRadius: 5, pointBorderWidth: 0, pointHoverBorderWidth: 0,
        }],
      },
      options: {
        animation: false, responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false, cornerRadius: 0, borderWidth: 1, padding: 8, caretSize: 0,
            titleFont: { family: pal.mono, size: 10, weight: 'normal' },
            bodyFont: { family: pal.mono, size: 12, weight: '500' },
            callbacks: {
              title: function (items) { return longDate(items[0].label); },
              label: function (item) { return fmt.format(item.parsed.y) + ' ' + (I18N.viewsLabel || ''); },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: pal.rule },
            ticks: {
              font: { family: pal.mono, size: 10 }, maxRotation: 0, autoSkip: false, padding: 6,
              // Une date sur trois, plus la dernière ; l'avant-dernière
              // candidate s'efface si elle collerait à la dernière.
              callback: function (value, index) {
                return (index % 3 === 0 && index < last - 1) || index === last
                  ? shortDate(this.getLabelForValue(value)) : '';
              },
            },
          },
          y: {
            beginAtZero: true, max: top,
            grid: { drawTicks: false },
            border: { display: false, dash: [1, 3] },
            ticks: {
              stepSize: top / 4, font: { family: pal.mono, size: 10 }, padding: 8,
              callback: function (value) { return fmt.format(value); },
            },
          },
        },
      },
    });
    styleChart(chart, pal, top);
    chart.update();
  }

  function crawlerRow(name, vendor, counts, seen) {
    var row = document.createElement('div');
    row.className = 'crawler-row';
    var n = document.createElement('span');
    n.className = 'crawler-name';
    n.textContent = name;
    if (vendor) {
      var v = document.createElement('span');
      v.className = 'crawler-vendor';
      v.textContent = vendor;
      n.appendChild(v);
    }
    var c = document.createElement('span');
    c.className = 'crawler-counts';
    c.textContent = counts;
    var s = document.createElement('span');
    s.className = 'crawler-seen';
    s.textContent = seen;
    row.appendChild(n); row.appendChild(c); row.appendChild(s);
    return row;
  }

  function renderCrawlers(crawlers) {
    var container = document.getElementById('ai-crawlers');
    if (!container) return;
    container.textContent = '';
    if (!crawlers || crawlers.length === 0) { empty(container); return; }
    for (var i = 0; i < crawlers.length; i++) {
      var c = crawlers[i];
      container.appendChild(crawlerRow(
        c.label, c.vendor,
        'edge ' + fmt.format(c.edge) + ' · cf ' + fmt.format(c.cf),
        c.lastSeen ? (I18N.lastSeen || 'last seen') + ' ' + shortDate(c.lastSeen) : ''
      ));
    }
  }

  function renderReferrals(aiReferrals) {
    // Fusion 7 j / 30 j : une ligne par IA, « 7 j n · 30 j n » en valeur.
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
      container.appendChild(crawlerRow(
        ais[i], '',
        (I18N.d7 || '7d') + ' ' + fmt.format(by[ais[i]].d7) + ' · ' + (I18N.d30 || '30d') + ' ' + fmt.format(by[ais[i]].d30),
        ''
      ));
    }
  }

  var lastPayload = null;

  function renderAll(payload) {
    lastPayload = payload;
    setText('stat-views-today', fmt.format(payload.today.views));
    if (payload.peak) {
      setText('stat-peak', fmt.format(payload.peak.views));
      // La légende du record porte sa date : un record sans date n'est qu'un
      // chiffre, avec sa date c'est un fait.
      if (I18N.peakCaption) setText('stat-peak-caption', I18N.peakCaption.replace('{date}', longDate(payload.peak.day)));
    }
    setText('stat-visitor-days', fmt.format(payload.visitors7d));
    setText('stat-copies', fmt.format(payload.copies7d.total));
    drawChart(fullSeries(payload.views14d));
    renderReferrals(payload.aiReferrals);
    renderCrawlers(payload.crawlers7d);
    renderBars('top-pages', payload.topPages7d.map(function (r) { return { label: r.path, value: r.views }; }));
    renderChips('views-langs', payload.langs7d.map(function (r) { return { label: r.lang, value: r.views }; }), false);
    renderBars('copies-agents', payload.copies7d.byAgent.map(function (r) { return { label: r.agent, value: r.n }; }));
    renderBars('top-prompts', payload.copies7d.topPrompts.map(function (r) { return { label: r.slug, value: r.n }; }));
    setText('votes-total', (I18N.votesTotal || '{count}').replace('{count}', fmt.format(payload.votes.total)));
    renderBars('top-voted', payload.votes.top.map(function (r) { return { label: r.slug, value: r.n }; }));

    // ---- depuis l'origine ----
    // `allTime` peut manquer si le Worker déployé est plus ancien que cette
    // page : on laisse alors les tuiles sur leur tiret plutôt que d'afficher
    // des zéros, qui se liraient comme une audience nulle.
    var all = payload.allTime;
    if (all) {
      setText('stat-all-views', fmt.format(all.views));
      setText('stat-all-visitor-days', fmt.format(all.visitorDays));
      setText('stat-all-copies', fmt.format(all.copies));
      setText('stat-days-on-air', fmt.format(all.daysOnAir));
      // La date de départ n'est affichée que si elle existe : sans une seule
      // vue enregistrée, il n'y a pas de premier jour à annoncer.
      if (all.firstDay && I18N.allTimeSince) {
        setText('stats-since', I18N.allTimeSince.replace('{date}', longDate(all.firstDay)));
      }
    }
    renderChips('by-country', (payload.countries7d || []).map(function (r) {
      return { label: r.country, value: r.views };
    }), true);
  }

  fetch(API)
    .then(function (res) { if (!res.ok) throw new Error('http ' + res.status); return res.json(); })
    .then(renderAll)
    .catch(function () {
      var err = document.getElementById('stats-live-error');
      if (err) err.hidden = false;
    });

  // Le graphe lit les couleurs du thème au moment du dessin : repasser par
  // drawChart quand la bascule clair/sombre change data-theme sur <html>, ou
  // quand le système change de thème sans choix explicite. La largeur, elle,
  // est suivie par Chart.js (responsive) sur la boîte .chart-box.
  function redraw() { if (lastPayload) drawChart(fullSeries(lastPayload.views14d)); }
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
})();
