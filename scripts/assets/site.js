// Améliore progressivement les pages générées par scripts/build-site.mjs.
// Sans ce fichier (JS désactivé), chaque page reste complète et lisible :
// la liste d'outils est déjà triée et entièrement présente dans le HTML, les
// chips de catégorie sont déjà des liens qui fonctionnent, le champ de
// recherche est déjà un champ de recherche classique (voir applyFilter), le
// prompt est déjà sélectionnable dans son <pre>, les boutons "Open in
// <agent>" sont déjà des liens <a> qui naviguent correctement, et les
// questions/réponses sont déjà ouvrables au clavier via <details>. Ce script
// n'ajoute que : le volet de suggestions de recherche, le filtre par verdict,
// la copie en un clic, la copie automatique avant d'ouvrir un agent, et le
// vote en direct.
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

  // La table (accueil et pages de catégorie) : le filtre par verdict (chips,
  // accueil seulement) et le rafraîchissement des compteurs de votes. La
  // frappe dans #q n'agit plus sur cette table — voir enhanceSearchCombo,
  // qui affiche un volet de suggestions séparé à la place. #q ne filtre la
  // table qu'une seule fois, au chargement, via ?q= dans l'URL : c'est ce que
  // promet la SearchAction du JSON-LD de l'accueil, et ça doit rester vrai
  // même si le lecteur n'interagit plus jamais avec le champ.
  function enhanceHome() {
    var table = document.getElementById('tool-table');
    var tbody = document.getElementById('tool-rows');
    if (!table || !tbody) return;

    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
    var noResults = document.getElementById('no-results');
    var verdictChips = Array.prototype.slice.call(document.querySelectorAll('.verdict-chip'));

    var state = { verdict: 'all', initialQuery: '' };

    var params = new URLSearchParams(location.search);
    var initialQ = params.get('q');
    if (initialQ) state.initialQuery = initialQ.trim().toLowerCase();

    function applyFilter() {
      var visible = 0;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var matchesVerdict = state.verdict === 'all' || row.dataset.verdict === state.verdict;
        var matchesQuery = !state.initialQuery || row.dataset.search.indexOf(state.initialQuery) !== -1;
        var show = matchesVerdict && matchesQuery;
        row.hidden = !show;
        if (show) visible++;
      }
      if (noResults) noResults.hidden = visible !== 0;
    }

    verdictChips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        verdictChips.forEach(function (c) {
          c.setAttribute('aria-pressed', 'false');
          c.classList.remove('is-active');
        });
        chip.setAttribute('aria-pressed', 'true');
        chip.classList.add('is-active');
        state.verdict = chip.dataset.verdict;
        applyFilter();
      });
    });

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

  // Le volet de suggestions au-dessus du champ de recherche de l'accueil :
  // un combobox ARIA classique (voir le rôle listbox/option), construit à
  // partir des mêmes lignes <tr> que la table plus bas — jamais une deuxième
  // copie du catalogue. Le champ reste un champ de recherche ordinaire sans
  // JavaScript ; ce volet est une pure amélioration posée par-dessus.
  function enhanceSearchCombo() {
    var input = document.getElementById('q');
    var panel = document.getElementById('search-panel');
    var clearBtn = document.getElementById('search-clear');
    var tbody = document.getElementById('tool-rows');
    if (!input || !panel || !tbody) return;

    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
    var viewAllTemplate = panel.dataset.viewAllTemplate || '{count}';
    var noResultsText = panel.dataset.noResults || '';
    var homePath = panel.dataset.homePath || '/';
    var MAX_RESULTS = 6;
    var activeIndex = -1;
    var currentOptions = [];

    function closePanel() {
      panel.hidden = true;
      panel.textContent = '';
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      activeIndex = -1;
      currentOptions = [];
    }

    function buildOptionRow(row) {
      var link = row.querySelector('th a');
      var badge = row.querySelector('.badge');
      var cat = row.querySelector('.cat');
      var price = row.querySelector('.price');

      var el = document.createElement('div');
      el.className = 'search-option';
      el.id = 'search-opt-' + row.dataset.slug;
      el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', 'false');

      var img = document.createElement('img');
      img.className = 'search-option-icon';
      img.src = row.dataset.favicon || '';
      img.alt = '';
      img.width = 20;
      img.height = 20;
      img.loading = 'lazy';
      el.appendChild(img);

      var name = document.createElement('span');
      name.className = 'search-option-name';
      name.textContent = link ? link.textContent : row.dataset.slug;
      el.appendChild(name);

      if (badge) el.appendChild(badge.cloneNode(true));

      var meta = document.createElement('span');
      meta.className = 'search-option-meta';
      var metaParts = [];
      if (cat) metaParts.push(cat.textContent.trim());
      if (price) metaParts.push(price.textContent.trim());
      meta.textContent = metaParts.join(' · ');
      el.appendChild(meta);

      var href = link ? link.getAttribute('href') : null;
      el.addEventListener('mousedown', function (e) {
        // mousedown plutôt que click : se déclenche avant le blur du champ,
        // qui sinon fermerait le volet avant que la navigation ait lieu.
        e.preventDefault();
        if (href) location.href = href;
      });

      return { el: el, path: href };
    }

    function buildViewAllRow(rawQuery, total) {
      var el = document.createElement('div');
      el.className = 'search-option search-option-viewall';
      el.id = 'search-opt-viewall';
      el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', 'false');
      el.textContent = viewAllTemplate.replace('{count}', String(total));
      var href = homePath + '?q=' + encodeURIComponent(rawQuery) + '#tool-table';
      el.addEventListener('mousedown', function (e) {
        e.preventDefault();
        location.href = href;
      });
      return { el: el, path: href };
    }

    function setActive(index) {
      currentOptions.forEach(function (opt, i) {
        opt.el.setAttribute('aria-selected', i === index ? 'true' : 'false');
      });
      activeIndex = index;
      if (index >= 0 && currentOptions[index]) {
        input.setAttribute('aria-activedescendant', currentOptions[index].el.id);
        if (currentOptions[index].el.scrollIntoView) {
          currentOptions[index].el.scrollIntoView({ block: 'nearest' });
        }
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }

    function renderPanel(rawQuery) {
      panel.textContent = '';
      currentOptions = [];
      activeIndex = -1;

      var q = rawQuery.trim().toLowerCase();
      if (!q) {
        closePanel();
        return;
      }

      // Sous-chaîne, pas préfixe : "gr" doit trouver "Granola" ET "Ideogram".
      var matches = rows.filter(function (row) {
        return row.dataset.search.indexOf(q) !== -1;
      });

      panel.hidden = false;
      input.setAttribute('aria-expanded', 'true');

      if (matches.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'search-empty';
        empty.textContent = noResultsText;
        panel.appendChild(empty);
        return;
      }

      matches.slice(0, MAX_RESULTS).forEach(function (row) {
        var opt = buildOptionRow(row);
        panel.appendChild(opt.el);
        currentOptions.push(opt);
      });

      var viewAll = buildViewAllRow(rawQuery.trim(), matches.length);
      panel.appendChild(viewAll.el);
      currentOptions.push(viewAll);
    }

    input.addEventListener('input', function () {
      if (clearBtn) clearBtn.hidden = !input.value;
      renderPanel(input.value);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (panel.hidden) renderPanel(input.value);
        if (currentOptions.length > 0) setActive(Math.min(activeIndex + 1, currentOptions.length - 1));
      } else if (e.key === 'ArrowUp') {
        if (!panel.hidden && currentOptions.length > 0) {
          e.preventDefault();
          setActive(Math.max(activeIndex - 1, 0));
        }
      } else if (e.key === 'Enter') {
        if (!panel.hidden && activeIndex >= 0 && currentOptions[activeIndex]) {
          e.preventDefault();
          var target = currentOptions[activeIndex].path;
          if (target) location.href = target;
        }
      } else if (e.key === 'Escape') {
        if (!panel.hidden) {
          e.preventDefault();
          closePanel();
        }
      }
    });

    if (clearBtn) {
      clearBtn.hidden = !input.value;
      clearBtn.addEventListener('click', function () {
        input.value = '';
        clearBtn.hidden = true;
        closePanel();
        input.focus();
      });
    }

    document.addEventListener('click', function (e) {
      if (e.target !== input && !panel.contains(e.target)) closePanel();
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

  // Boutons "Open in <agent>" : déjà de vrais liens <a> qui fonctionnent sans
  // JavaScript (voir scripts/lib/site-page-tool.mjs, qui résout leur mode et
  // leur URL au build avec la même fonction resolveAction que l'extension).
  // La seule chose que JS ajoute, c'est copier le prompt dans le
  // presse-papiers avant que le clic ne suive son cours — pour un lien en
  // mode "deeplink" (même onglet), on retarde la navigation le temps de la
  // copie ; pour "url"/"clipboard" (nouvel onglet), la copie se fait en
  // parallèle sans bloquer le lien.
  function enhanceAgentButtons() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.agent-btn'));
    var code = document.getElementById('prompt-text');
    var status = document.getElementById('copy-status');
    if (buttons.length === 0 || !code) return;
    if (!navigator.clipboard || !navigator.clipboard.writeText) return;

    buttons.forEach(function (btn) {
      var isDeeplink = btn.dataset.mode === 'deeplink';

      btn.addEventListener('click', function (e) {
        var text = code.textContent;
        var announce = function (ok) {
          if (status) status.textContent = ok ? btn.dataset.copiedLabel : btn.dataset.failLabel;
        };

        if (!isDeeplink) {
          navigator.clipboard.writeText(text).then(function () { announce(true); }, function () { announce(false); });
          return; // le lien suit son cours normalement (nouvel onglet).
        }

        e.preventDefault();
        var href = btn.getAttribute('href');
        navigator.clipboard.writeText(text).then(function () { announce(true); }, function () { announce(false); })
          .then(function () { location.href = href; });
      });
    });
  }

  function enhanceVote() {
    var countEl = document.getElementById('vote-count');
    var button = document.getElementById('vote-btn');
    var status = document.getElementById('vote-status');

    function renderCount(count) {
      if (!countEl || count === null || count === undefined) return;
      countEl.textContent = '(' + pluralize(count, countEl.dataset.lang, countEl.dataset.singular, countEl.dataset.plural) + ')';
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
  enhanceSearchCombo();
  enhanceThemeToggle();
  enhanceCopyButton();
  enhanceAgentButtons();
  enhanceVote();
})();
