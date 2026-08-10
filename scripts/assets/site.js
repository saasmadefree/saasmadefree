// Améliore progressivement les pages générées par scripts/build-site.mjs.
// Sans ce fichier (JS désactivé), chaque page reste complète et lisible :
// la liste d'outils est déjà triée et entièrement présente dans le HTML, les
// chips de catégorie sont déjà des liens qui fonctionnent, le champ de
// recherche est déjà un champ de recherche classique (voir applyFilter), le
// prompt est déjà sélectionnable dans son <pre>, les boutons "Open in
// <agent>" sont déjà des liens <a> qui naviguent correctement, et les
// questions/réponses sont déjà ouvrables au clavier via <details>. Ce script
// n'ajoute que : le volet de suggestions de recherche, le filtre par verdict,
// la copie en un clic, la copie automatique avant d'ouvrir un agent, le
// vote en direct, et sur /sponsor seulement le rafraîchissement de
// l'inventaire (statut + prix, voir enhanceSponsorInventory).
//
// Seules requêtes réseau faites par ce fichier : le Worker de ce même projet
// (votes.saasmadefree.com, décrit dans README.md — vote, puis disponibilité
// des emplacements sponsors). Rien d'autre, aucune tierce partie.
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
      // Mais l'ordre doit être la pertinence, pas l'alphabet : sans ce
      // classement, "gra" remontait Canva et GitHub Copilot — qui matchent dans
      // leur description — au-dessus de Grammarly et Granola.
      function relevance(row) {
        var name = row.dataset.name || '';
        var cat = row.dataset.cat || '';
        if (name.indexOf(q) === 0) return 0;                       // le nom commence par la saisie
        if ((' ' + name).indexOf(' ' + q) !== -1) return 1;        // un mot du nom commence par la saisie
        if (name.indexOf(q) !== -1) return 2;                      // le nom la contient
        if (cat.indexOf(q) !== -1) return 3;                       // la catégorie la contient
        return 4;                                                  // ailleurs (sous-titre, description)
      }
      var matches = rows
        .filter(function (row) { return row.dataset.search.indexOf(q) !== -1; })
        .map(function (row, i) { return { row: row, score: relevance(row), order: i }; })
        .sort(function (a, b) { return a.score - b.score || a.order - b.order; })
        .map(function (entry) { return entry.row; });

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

  // Rafraîchit le tableau d'inventaire de /sponsor (statut + prix) une fois
  // le HTML chargé, sans jamais toucher aux autres pages : le sélecteur ne
  // trouve son point d'ancrage que sur /sponsor (voir renderSponsorPage dans
  // scripts/lib/site-page-sponsor.mjs), donc cette fonction ne fait rien
  // ailleurs. La page est déjà complète et correcte sans elle (principe 5,
  // .impeccable.md) : ceci ne fait que réduire la fenêtre où l'état cuit au
  // build a pu devenir légèrement périmé (un paiement encaissé, un slot
  // libéré par le cron, entre le build et la visite).
  //
  // Aucun décalage de mise en page : les chiffres passent par le même
  // font-variant-numeric:tabular-nums que .sp-price (voir site-styles.mjs),
  // et un échec réseau ne modifie rien ni ne journalise d'erreur visible —
  // l'état déjà rendu reste affiché tel quel.
  function enhanceSponsorInventory() {
    var section = document.querySelector('[data-sponsor-slots-endpoint]');
    if (!section) return;
    var endpoint = section.getAttribute('data-sponsor-slots-endpoint');
    if (!endpoint) return;

    var openLabel = section.getAttribute('data-sponsor-open-label') || '';
    var takenLabel = section.getAttribute('data-sponsor-taken-label') || '';
    var lang = document.documentElement.lang || 'en';
    var LIVE_STATUSES = { open: true, reserved: true, paid: true };

    function formatUsd(amount) {
      var whole = Math.round(amount) === amount;
      return new Intl.NumberFormat(lang, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: whole ? 0 : 2,
        maximumFractionDigits: whole ? 0 : 2,
      }).format(amount);
    }

    // Le barème du compartiment, sérialisé par le build depuis
    // RAIL_LADDER_USD/TAPE_LADDER_USD (voir inventoryList). Rend null au
    // moindre doute : mieux vaut garder les montants calculés au build que
    // d'en dériver un depuis une valeur qu'on n'a pas su lire.
    function parseLadder(raw) {
      if (!raw) return null;
      var parts = raw.split(',');
      var out = [];
      for (var i = 0; i < parts.length; i++) {
        var value = Number(parts[i]);
        if (parts[i] === '' || !isFinite(value) || value <= 0) return null;
        out.push(value);
      }
      return out.length ? out : null;
    }

    // Le prix d'un compartiment se déduit de son occupation, exactement comme
    // au build (mergeOccupancy + nextPriceUsd, scripts/lib/site-sponsors.mjs)
    // et comme à l'encaissement (paidCounts, worker/src/sponsors.mjs) : c'est
    // la marche du barème indexée par le nombre de slots VENDUS. Une
    // réservation bloque le slot sans faire monter le barème — sinon quelques
    // paniers abandonnés suffiraient à faire grimper les prix affichés.
    //
    // Le prix n'est PAS lu du champ `priceCents` de la charge utile : ce
    // serait une seconde source d'occupation, et la page pourrait annoncer un
    // montant que son propre tableau de barème contredit.
    function repriceList(list) {
      var items = list.querySelectorAll('.sp-inv-item[data-slot]');
      var i, item, priceEl;

      // Un slot pris n'annonce plus de prix : il n'y a rien à vendre.
      for (i = 0; i < items.length; i++) {
        if (!items[i].classList.contains('taken')) continue;
        priceEl = items[i].querySelector('.sp-inv-price');
        if (priceEl) priceEl.parentNode.removeChild(priceEl);
      }

      var ladder = parseLadder(list.getAttribute('data-sponsor-ladder'));
      if (!ladder) return;
      var sold = 0;
      for (i = 0; i < items.length; i++) {
        if (items[i].dataset.sold === '1') sold++;
      }
      // Compartiment plein : tout ce qui est vendu est pris, il ne reste donc
      // aucun slot libre à tarifer (même invariant que nextPriceUsd).
      if (sold >= ladder.length) return;

      var text = formatUsd(ladder[sold]);
      for (i = 0; i < items.length; i++) {
        item = items[i];
        if (item.classList.contains('taken')) continue;
        priceEl = item.querySelector('.sp-inv-price');
        if (!priceEl) {
          priceEl = document.createElement('span');
          priceEl.className = 'sp-inv-price';
          item.appendChild(priceEl);
        }
        priceEl.textContent = text;
      }
    }

    fetch(endpoint)
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (body) {
        if (!body || typeof body !== 'object') return;

        var items = section.querySelectorAll('.sp-inv-item[data-slot]');
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          var entry = body[item.dataset.slot];
          // Même garde que mergeOccupancy côté build : un slot absent de la
          // charge utile, ou d'une forme inattendue, ne touche pas à cet
          // élément — il garde l'état déjà rendu plutôt que d'être effacé.
          if (!entry || typeof entry !== 'object' || !LIVE_STATUSES[entry.status]) continue;

          // Même précédence à sens unique que mergeOccupancy côté build : la
          // classe déjà posée par le serveur reflète l'occupation fusionnée au
          // build — la charge utile ne peut que faire passer ce slot à "pris",
          // jamais le rouvrir. Sans ce garde-fou, un sponsor commité à la main
          // (donc toujours "open" côté D1, Stripe ne l'ayant jamais touché)
          // serait remis en vente ici alors que sa carte s'affiche déjà sur le
          // rail. `data-sold` suit la même règle, sur l'autre axe : il ne
          // s'ajoute jamais, il ne se retire pas.
          var wasTaken = item.classList.contains('taken');
          var taken = entry.status !== 'open' || wasTaken;
          item.classList.toggle('taken', taken);
          item.classList.toggle('open', !taken);
          if (entry.status === 'paid') item.dataset.sold = '1';

          var stateEl = item.querySelector('.sp-inv-state');
          if (stateEl) stateEl.textContent = taken ? takenLabel : openLabel;
        }

        // Les prix se recalculent APRÈS les statuts : l'index du barème
        // dépend du nombre de slots vendus, qu'on vient de mettre à jour.
        var lists = section.querySelectorAll('.sp-inv');
        for (var j = 0; j < lists.length; j++) repriceList(lists[j]);
      })
      .catch(function () {}); // échec silencieux : l'état cuit au build reste affiché
  }

  enhanceHome();
  enhanceSearchCombo();
  enhanceThemeToggle();
  enhanceCopyButton();
  enhanceAgentButtons();
  enhanceVote();
  enhanceSponsorInventory();
})();
