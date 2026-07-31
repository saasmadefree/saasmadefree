// Améliore progressivement les pages générées par scripts/build-site.mjs.
// Sans ce fichier (JS désactivé), chaque page reste complète et lisible :
// la liste d'outils est déjà triée et entièrement présente dans le HTML, le
// prompt est déjà sélectionnable dans son <pre>, et les questions/réponses
// sont déjà ouvrables au clavier via <details>. Ce script n'ajoute que le
// filtrage instantané, la copie en un clic et le vote en direct.
//
// Seules requêtes réseau faites par ce fichier : le service de vote de ce
// même projet (votes.saasmadefree.com, décrit dans README.md). Rien d'autre,
// aucune tierce partie.
(function () {
  'use strict';

  var VOTE_ENDPOINT = 'https://votes.saasmadefree.com/api/v1/vote';
  var VOTES_FEED_URL = 'https://votes.saasmadefree.com/feed/v1/votes.json';

  function fetchVotes() {
    return fetch(VOTES_FEED_URL)
      .then(function (res) { return res.ok ? res.json() : null; })
      .catch(function () { return null; });
  }

  function pluralize(count, lang, singularTpl, pluralTpl) {
    var singular = lang === 'fr' ? count <= 1 : count === 1;
    return (singular ? singularTpl : pluralTpl).replace('{count}', String(count));
  }

  function enhanceHome() {
    var table = document.getElementById('tool-table');
    var tbody = document.getElementById('tool-rows');
    if (!table || !tbody) return;

    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
    var searchInput = document.getElementById('q');
    var categorySelect = document.getElementById('category-filter');
    var noResults = document.getElementById('no-results');

    function applyFilter() {
      var q = (searchInput && searchInput.value ? searchInput.value : '').trim().toLowerCase();
      var cat = categorySelect && categorySelect.value ? categorySelect.value : 'all';
      var visible = 0;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var matchesText = !q || row.dataset.search.indexOf(q) !== -1;
        var matchesCat = cat === 'all' || row.dataset.category === cat;
        var show = matchesText && matchesCat;
        row.hidden = !show;
        if (show) visible++;
      }
      if (noResults) noResults.hidden = visible !== 0;
    }

    if (searchInput) searchInput.addEventListener('input', applyFilter);
    if (categorySelect) categorySelect.addEventListener('change', applyFilter);

    // WebSite/SearchAction (voir le JSON-LD de la page) : ?q= doit vraiment
    // filtrer la page qu'il cible, sinon le balisage mentirait.
    var params = new URLSearchParams(location.search);
    var initialQ = params.get('q');
    if (initialQ && searchInput) searchInput.value = initialQ;
    applyFilter();

    fetchVotes().then(function (counts) {
      if (!counts) return;
      var lang = table.dataset.lang;
      var singularTpl = table.dataset.singular;
      var pluralTpl = table.dataset.plural;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var cell = row.querySelector('[data-vote-cell]');
        if (!cell) continue;
        var count = Object.prototype.hasOwnProperty.call(counts, row.dataset.slug)
          ? counts[row.dataset.slug]
          : 0;
        row.dataset.votes = String(count);
        cell.textContent = pluralize(count, lang, singularTpl, pluralTpl);
      }
      var sorted = rows.slice().sort(function (a, b) {
        var diff = Number(b.dataset.votes != null ? b.dataset.votes : -1) -
                   Number(a.dataset.votes != null ? a.dataset.votes : -1);
        if (diff !== 0) return diff;
        return Number(b.dataset.priority) - Number(a.dataset.priority);
      });
      for (var j = 0; j < sorted.length; j++) tbody.appendChild(sorted[j]);
    });
  }

  // Bascule de thème. Le bouton est rendu hidden : sans JavaScript il n'aurait
  // aucun effet, et un contrôle mort est pire qu'un contrôle absent.
  function enhanceThemeToggle() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var root = document.documentElement;
    var media = window.matchMedia('(prefers-color-scheme: dark)');

    function current() {
      var explicit = root.dataset.theme;
      if (explicit === 'dark' || explicit === 'light') return explicit;
      return media.matches ? 'dark' : 'light';
    }
    function render() {
      var next = current() === 'dark' ? 'light' : 'dark';
      var label = next === 'dark' ? btn.dataset.labelDark : btn.dataset.labelLight;
      btn.querySelector('.theme-text').textContent = label;
      btn.setAttribute('aria-label', label);
    }
    btn.hidden = false;
    render();
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) {}
      render();
    });
    // Si le lecteur n'a rien choisi, suivre le système quand il change.
    media.addEventListener('change', function () {
      if (!root.dataset.theme) render();
    });
  }

  function enhanceCopyButton() {
    var button = document.getElementById('copy-prompt');
    var code = document.getElementById('prompt-text');
    var status = document.getElementById('copy-status');
    if (!button || !code) return;

    button.hidden = false; // amélioration progressive : invisible sans JS

    button.addEventListener('click', function () {
      var text = code.textContent;
      var done = function (ok) {
        if (status) status.textContent = ok ? button.dataset.copiedLabel : button.dataset.failLabel;
        if (ok) {
          var original = button.textContent;
          button.textContent = button.dataset.copiedLabel;
          setTimeout(function () { button.textContent = original; }, 2500);
        }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () {
          selectText(code);
          done(false);
        });
      } else {
        selectText(code);
        done(false);
      }
    });
  }

  function selectText(node) {
    var range = document.createRange();
    range.selectNodeContents(node);
    var selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function enhanceVote() {
    var countEl = document.getElementById('vote-count');
    var button = document.getElementById('vote-btn');
    var status = document.getElementById('vote-status');

    function renderCount(count) {
      if (!countEl || count === null || count === undefined) return;
      countEl.textContent = pluralize(count, countEl.dataset.lang, countEl.dataset.singular, countEl.dataset.plural);
      countEl.hidden = false;
    }

    if (countEl) {
      fetchVotes().then(function (counts) {
        if (!counts) return;
        var slug = countEl.dataset.voteSlug;
        renderCount(Object.prototype.hasOwnProperty.call(counts, slug) ? counts[slug] : 0);
      });
    }

    if (!button) return;

    button.addEventListener('click', function () {
      button.disabled = true;
      var slug = button.dataset.slug;
      fetch(VOTE_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: slug }),
      })
        .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
        .then(function (result) {
          if (result.ok && result.body && typeof result.body.count === 'number') {
            renderCount(result.body.count);
            if (status) {
              status.textContent = result.body.counted ? button.dataset.msgThanks : button.dataset.msgAlready;
            }
          } else if (status) {
            status.textContent = button.dataset.msgError;
          }
        })
        .catch(function () {
          if (status) status.textContent = button.dataset.msgError;
        })
        .finally(function () {
          button.disabled = false;
        });
    });
  }

  enhanceHome();
  enhanceThemeToggle();
  enhanceCopyButton();
  enhanceVote();
})();
