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
// l'inventaire (statut + prix, voir enhanceSponsorInventory) et le bouton
// d'achat (voir enhanceSponsorCheckout). Sur /sponsor sans JavaScript, il
// reste l'inventaire complet, les prix, le barème, l'adresse de contact et
// une note <noscript> qui dit où écrire — rien n'est caché au lecteur.
//
// Seules requêtes réseau faites par ce fichier : le Worker de ce même projet
// (votes.saasmadefree.com, décrit dans README.md — vote, disponibilité des
// emplacements sponsors, ouverture d'une session de paiement). Rien d'autre,
// aucune tierce partie.
//
// Rien dans ce fichier ne construit de HTML : tout texte venant du réseau
// passe par textContent ou par un attribut rendu et échappé au build. Un
// test statique (tests/sponsor-checkout-page.test.mjs) le verrouille.
(function () {
  'use strict';

  var VOTE_ENDPOINT = 'https://votes.saasmadefree.com/api/v1/vote';
  var VOTES_FEED_URL = 'https://votes.saasmadefree.com/feed/v1/votes.json';

  // Même règle que formatMoney (scripts/lib/site-format.mjs) : pas de
  // décimales sur un montant entier. Les deux doivent rester d'accord, sinon
  // un prix rafraîchi côté client s'écrirait autrement que le même prix cuit
  // au build, sur la même page.
  function formatUsd(amount, lang) {
    var whole = Math.round(amount) === amount;
    return new Intl.NumberFormat(lang, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(amount);
  }

  // Un emplacement qui vient d'être pris ne doit plus être proposé NULLE PART
  // sur la page. Le même slot est rendu jusqu'à cinq fois — sa ligne
  // d'inventaire, sa carte de rail, le bloc replié des petits écrans, et deux
  // fois dans un bandeau défilant (la piste est dupliquée pour boucler). Ne
  // corriger que l'inventaire laissait la ligne « Pris » à côté d'une carte
  // « Slot libre — 149 $US — Réserver » pour le même emplacement : la page se
  // contredisait elle-même à l'exécution.
  //
  // L'élément n'est pas reconstruit, il est neutralisé sur place : un <a> sans
  // href n'est ni un lien ni un arrêt de tabulation, et la feuille de style ne
  // distingue que les classes. Le résultat est celui que le build produit pour
  // un emplacement pris, sans jamais fabriquer de balisage.
  function neutralizeSlotElement(el, takenLabel) {
    el.classList.remove('open');
    el.classList.add('taken');
    el.removeAttribute('href');
    el.removeAttribute('target');
    el.removeAttribute('rel');
    while (el.firstChild) el.removeChild(el.firstChild);
    if (el.classList.contains('sp-card')) {
      var label = document.createElement('span');
      label.className = 'sp-taken-label';
      label.textContent = takenLabel;
      el.appendChild(label);
    } else {
      el.textContent = takenLabel;
    }
  }

  /** Retire de la vente toutes les cartes et places d'un slot donné. Ne touche
   *  qu'un emplacement encore annoncé libre : une carte de sponsor déjà en
   *  place (.sp-card.live) n'a rien à voir avec cette bascule. */
  function markSlotTaken(slot, takenLabel) {
    var all = document.querySelectorAll('.sp-card[data-slot], .sp-tape-item[data-slot]');
    for (var i = 0; i < all.length; i++) {
      if (all[i].dataset.slot !== slot) continue;
      if (!all[i].classList.contains('open')) continue;
      neutralizeSlotElement(all[i], takenLabel);
    }
  }

  // Emplacements pour lesquels CE visiteur a ouvert un paiement, dans cet
  // onglet. Le Worker distingue déjà une réservation du visiteur de celle d'un
  // tiers (voir holdsOf/reserveSlot) et la lui laisse reprendre ; mais
  // `GET /slots` ne dit pas — et ne doit pas dire — à qui appartient une
  // réservation. Sans cette mémoire locale, recharger la page après un
  // aller-retour chez Stripe faisait disparaître le bouton de SA propre
  // réservation, et la branche de reprise devenait inatteignable depuis la
  // page pendant toute la durée du verrou.
  //
  // sessionStorage et pas localStorage : la mémoire meurt avec l'onglet, comme
  // la session de paiement. Aucune purge par échéance — la durée de
  // réservation est une constante du Worker, la recopier ici la ferait
  // diverger. Une entrée périmée ne coûte qu'un bouton de trop, dont le clic
  // rend un `slot_taken` honnête.
  var HOLDS_KEY = 'smf:sponsor-holds';

  function ownHolds() {
    try {
      var raw = sessionStorage.getItem(HOLDS_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Object.prototype.toString.call(list) === '[object Array]' ? list : [];
    } catch (e) {
      return []; // stockage refusé (navigation privée) : on retombe sur le cas général
    }
  }

  function rememberOwnHold(slot) {
    try {
      var list = ownHolds();
      if (list.indexOf(slot) === -1) list.push(slot);
      sessionStorage.setItem(HOLDS_KEY, JSON.stringify(list));
    } catch (e) { /* sans mémoire, le bouton disparaîtra au rechargement */ }
  }

  /**
   * L'URL rendue par le Worker est-elle bien une page de paiement Stripe ?
   *
   * Un simple préfixe "https://" ne suffit pas : `https://checkout.stripe.com@evil.example/`
   * commence par https et part chez evil.example — le segment avant le "@" est
   * un userinfo, pas un hôte. `new URL` lit l'hôte réel, ce qu'une comparaison
   * de chaîne ne fait pas.
   *
   * Décision : seuls stripe.com et ses sous-domaines passent, ce que produit
   * `createCheckoutSession` aujourd'hui (checkout.stripe.com). Stripe permet un
   * domaine de checkout personnalisé ; si ce site en adopte un un jour, il faut
   * l'ajouter ICI, sciemment. D'ici là l'acheteur verrait le message de repli —
   * visible et réessayable, jamais une redirection vers un hôte non prévu.
   */
  function isStripeCheckoutUrl(raw) {
    if (typeof raw !== 'string') return false;
    var parsed;
    try {
      parsed = new URL(raw);
    } catch (e) {
      return false;
    }
    if (parsed.protocol !== 'https:') return false;
    return parsed.hostname === 'stripe.com' || parsed.hostname.slice(-11) === '.stripe.com';
  }

  /** Réécrit le montant des cartes et des places encore libres d'un
   *  compartiment. Le prix d'un compartiment est unique : le laisser divergent
   *  entre la ligne d'inventaire et la carte du même slot, c'est la page qui
   *  annonce deux prix pour une seule chose. */
  function repriceSlotElements(slots, text) {
    var all = document.querySelectorAll('.sp-card.open[data-slot], .sp-tape-item.open[data-slot]');
    for (var i = 0; i < all.length; i++) {
      if (slots.indexOf(all[i].dataset.slot) === -1) continue;
      var el = all[i].querySelector('.sp-price') || all[i].querySelector('.sp-tape-price');
      if (el) el.textContent = text;
    }
  }

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
      var i, item, priceEl, buyEl;
      var slots = [];
      for (i = 0; i < items.length; i++) slots.push(items[i].dataset.slot);

      // Un slot pris n'annonce plus de prix et ne s'achète plus : il n'y a
      // rien à vendre. Le bouton part avec le montant — le laisser ouvrirait
      // un paiement sur un emplacement que la même ligne déclare pris.
      for (i = 0; i < items.length; i++) {
        if (!items[i].classList.contains('taken')) continue;
        priceEl = items[i].querySelector('.sp-inv-price');
        if (priceEl) priceEl.parentNode.removeChild(priceEl);
        buyEl = items[i].querySelector('.sp-inv-buy');
        if (buyEl) buyEl.parentNode.removeChild(buyEl);
      }

      var ladder = parseLadder(list.getAttribute('data-sponsor-ladder'));
      if (!ladder) return;
      var sold = 0;
      for (i = 0; i < items.length; i++) {
        if (items[i].dataset.sold === '1') sold++;
      }
      // Compartiment plein : tout ce qui est vendu est pris, il ne reste donc
      // aucun slot libre à tarifer (même invariant que nextPriceUsd). On retire
      // le prix machine avec l'affichage — il ne doit rester aucun montant
      // qu'un bouton pourrait envoyer.
      if (sold >= ladder.length) {
        list.removeAttribute('data-sponsor-price-cents');
        return;
      }

      var text = formatUsd(ladder[sold], lang);
      // Le montant que le bouton enverra en `expectedPriceCents` suit
      // exactement l'affichage : une seule marche de barème pour les deux,
      // jamais deux sources.
      list.setAttribute('data-sponsor-price-cents', String(Math.round(ladder[sold] * 100)));
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
      // Les cartes et les places du même compartiment portent le même prix.
      repriceSlotElements(slots, text);
    }

    fetch(endpoint)
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (body) {
        if (!body || typeof body !== 'object') return;

        var holds = ownHolds();
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
          // Une réservation que CE visiteur vient d'ouvrir n'est pas un
          // emplacement perdu pour lui : le Worker la lui laisse reprendre
          // (exemption `holds.slots.has(slot)` et branche de reprise de
          // reserveSlot). La retirer de la vente ici lui fermerait la porte
          // que le Worker garde ouverte, et pour toute la durée du verrou.
          // Seule une RÉSERVATION est concernée : un slot passé `paid` est
          // vendu, y compris quand c'est lui qui l'a payé.
          var ownReserved = entry.status === 'reserved' && holds.indexOf(item.dataset.slot) !== -1;
          var wasTaken = item.classList.contains('taken');
          var taken = (entry.status !== 'open' && !ownReserved) || wasTaken;
          item.classList.toggle('taken', taken);
          item.classList.toggle('open', !taken);
          if (entry.status === 'paid') item.dataset.sold = '1';

          var stateEl = item.querySelector('.sp-inv-state');
          if (stateEl) stateEl.textContent = taken ? takenLabel : openLabel;

          // Le même emplacement est aussi rendu en carte de rail et en place
          // défilante. Sans cette ligne, seule la ligne d'inventaire suivait
          // la disponibilité réelle, et la page proposait à la vente, deux
          // blocs plus loin, l'emplacement qu'elle venait de déclarer pris.
          if (taken) markSlotTaken(item.dataset.slot, takenLabel);
        }

        // Les prix se recalculent APRÈS les statuts : l'index du barème
        // dépend du nombre de slots vendus, qu'on vient de mettre à jour.
        var lists = section.querySelectorAll('.sp-inv');
        for (var j = 0; j < lists.length; j++) repriceList(lists[j]);
      })
      .catch(function () {}); // échec silencieux : l'état cuit au build reste affiché
  }

  // Le bouton d'achat de /sponsor — le seul endroit du site qui déclenche un
  // paiement. Il n'ouvre aucun formulaire : le montant est recalculé par le
  // Worker, et la créa (nom, domaine, une ligne) est saisie dans le formulaire
  // de Stripe lui-même. Cette page n'envoie que quatre champs.
  //
  // `expectedPriceCents` ne facture RIEN. Le Worker recalcule et facture son
  // propre montant ; ce champ ne sert qu'à détecter une dérive entre le prix
  // affiché et le prix du moment. Différent, il rend `409 price_changed` avec
  // le vrai montant, sans créer de session — et on ne re-tente jamais tout
  // seul : on montre le nouveau prix, et l'acheteur décide.
  //
  // `lang` n'est pas décoratif : il choisit la page de retour après paiement
  // (`success_url`). Sans lui, tout acheteur francophone reviendrait sur la
  // page anglaise juste après avoir été débité.
  //
  // Les contrôles sont rendus `hidden` par le build et dévoilés ici : sans ce
  // script, ils ne feraient rien, et un contrôle mort est pire qu'un contrôle
  // absent. La page reste complète sans eux (principe 5 de .impeccable.md).
  function enhanceSponsorCheckout() {
    var section = document.querySelector('[data-sponsor-slots-endpoint]');
    if (!section) return;
    var endpoint = section.getAttribute('data-sponsor-checkout-endpoint');
    if (!endpoint) return;
    var groups = section.querySelectorAll('.sp-inv-group');
    if (groups.length === 0) return;

    var lang = document.documentElement.lang || 'en';
    var takenLabel = section.getAttribute('data-sponsor-taken-label') || '';

    // Un seul paiement en vol pour toute la page. Le bouton cliqué se suffisait
    // à lui-même, mais deux clics rapides sur des emplacements DIFFÉRENTS
    // ouvraient deux réservations et deux sessions Stripe — et consommaient
    // d'un coup les deux emplacements du plafond du visiteur
    // (MAX_HOLDS_PER_VISITOR), qui recevait ensuite `too_many_reservations`
    // sur son troisième clic sans comprendre pourquoi.
    //
    // Ce drapeau fait double emploi avec la désactivation des boutons juste en
    // dessous, et c'est VOULU : sur un chemin qui déclenche un paiement, une
    // seule garde suffit à tenir la garantie mais aucune ne mérite d'être la
    // seule. Retirer l'une des deux ne casse aucun test — c'est l'autre qui
    // tient ; retirer les deux en casse trois. Ce n'est donc pas du code mort.
    var inFlight = false;

    // Un code d'erreur venu du réseau sert à composer un nom d'attribut : on
    // n'accepte que la forme réellement produite par le Worker, jamais une
    // chaîne arbitraire.
    var CODE_RE = /^[a-z_]{1,40}$/;

    function allButtons() {
      return section.querySelectorAll('.sp-inv-buy');
    }

    function setButtonsDisabled(disabled) {
      var buttons = allButtons();
      for (var i = 0; i < buttons.length; i++) buttons[i].disabled = disabled;
    }

    function clearStatuses() {
      var regions = section.querySelectorAll('.sp-inv-status');
      for (var i = 0; i < regions.length; i++) regions[i].textContent = '';
    }

    // Le message destiné à l'acheteur, rendu et échappé au build (voir
    // checkoutMessages dans scripts/lib/site-page-sponsor.mjs). Un code absent
    // de la page — parce que le Worker en a gagné un nouveau — retombe sur le
    // message de repli plutôt que sur un silence.
    function messageFor(code, slot, price) {
      var attr = code && CODE_RE.test(code) ? 'data-sponsor-msg-' + code.replace(/_/g, '-') : null;
      var text = (attr && section.getAttribute(attr)) || section.getAttribute('data-sponsor-msg-fallback') || '';
      return text.replace(/\{slot\}/g, slot)
        .replace(/\{price\}/g, price || '')
        .replace(/\{duration\}/g, durationLabel());
    }

    // Les deux seules durées que le Worker accepte de facturer. Toute autre
    // valeur retombe sur un mois plutôt que d'envoyer un `unsold_duration`.
    function monthsChosen() {
      var checked = section.querySelector('input[name="sp-months"]:checked');
      return (checked && Number(checked.value) === 3) ? 3 : 1;
    }

    // Le libellé de la durée choisie, lu du <label> déjà traduit. Il entre dans
    // le message de dérive : sans lui, « le prix est maintenant de 447 $US » se
    // lisait à côté d'une ligne affichant 149 $US, et les deux montants — tous
    // deux vrais — se contredisaient à l'œil.
    function durationLabel() {
      var checked = section.querySelector('input[name="sp-months"]:checked');
      var label = checked && checked.closest ? checked.closest('label') : null;
      return label ? label.textContent.trim() : '';
    }

    // Le prix affiché du compartiment, en centimes. Rend null au moindre doute
    // — sans montant vérifiable, on n'ouvre pas de paiement du tout.
    function unitCentsOf(list) {
      var raw = Number(list.getAttribute('data-sponsor-price-cents'));
      return isFinite(raw) && raw > 0 ? Math.round(raw) : null;
    }

    // Montant exact réclamé par le serveur pour une durée donnée, mémorisé
    // quand il n'est PAS ramenable à un prix unitaire (total non divisible par
    // la durée). Sans lui, le clic suivant renverrait l'attente périmée, donc
    // le même refus, indéfiniment. Il ne sert qu'à cette durée-là, et disparaît
    // dès que le prix du compartiment bouge ou que la durée change.
    function setPriceOverride(list, months, cents) {
      list.setAttribute('data-sponsor-price-override', months + ':' + cents);
    }

    function priceOverride(list, months) {
      var raw = list.getAttribute('data-sponsor-price-override');
      if (!raw) return null;
      var parts = raw.split(':');
      var cents = Number(parts[1]);
      if (Number(parts[0]) !== months || !isFinite(cents) || cents <= 0) return null;
      return Math.round(cents);
    }

    function clearPriceOverrides() {
      var lists = section.querySelectorAll('.sp-inv');
      for (var i = 0; i < lists.length; i++) lists[i].removeAttribute('data-sponsor-price-override');
    }

    // Aligne tout le compartiment sur le prix que le serveur vient d'annoncer :
    // le montant machine qui repartira en `expectedPriceCents`, les lignes
    // d'inventaire, et les cartes et places du même compartiment.
    function applyServerPrice(list, unitCents) {
      list.setAttribute('data-sponsor-price-cents', String(Math.round(unitCents)));
      list.removeAttribute('data-sponsor-price-override');
      var text = formatUsd(unitCents / 100, lang);
      var items = list.querySelectorAll('.sp-inv-item[data-slot]');
      var slots = [];
      for (var i = 0; i < items.length; i++) {
        slots.push(items[i].dataset.slot);
        if (items[i].classList.contains('taken')) continue;
        var priceEl = items[i].querySelector('.sp-inv-price');
        if (priceEl) priceEl.textContent = text;
      }
      repriceSlotElements(slots, text);
    }

    // La ligne passe « pris ». `data-sold` n'est volontairement PAS posé : un
    // slot_taken peut n'être qu'une réservation, et une réservation ne compte
    // pas dans l'index du barème (même règle que paidCounts côté Worker).
    function takeInventoryRow(item) {
      item.classList.remove('open');
      item.classList.add('taken');
      var state = item.querySelector('.sp-inv-state');
      if (state) state.textContent = takenLabel;
      var priceEl = item.querySelector('.sp-inv-price');
      if (priceEl) priceEl.parentNode.removeChild(priceEl);
      var buyEl = item.querySelector('.sp-inv-buy');
      if (buyEl) buyEl.parentNode.removeChild(buyEl);
    }

    function handleFailure(body, slot, months, item, list, status) {
      var code = body && typeof body.error === 'string' ? body.error : null;

      if (code === 'price_changed') {
        // Le Worker rend le montant réel, pour la durée demandée, et n'a créé
        // aucune session. On repasse par l'acheteur : la page affiche le
        // nouveau prix et il décide. Un second clic partira au bon montant.
        var total = Number(body.priceCents);
        if (!isFinite(total) || total <= 0) {
          // Aucun montant exploitable : on ne devine pas un prix, on le dit.
          status.textContent = messageFor(null, slot, '');
          return;
        }
        if (total % months === 0) {
          // Ramenable à un prix unitaire : tout le compartiment se remet au
          // bon montant — lignes, cartes et places — et le clic suivant
          // recalculera de lui-même le même total.
          applyServerPrice(list, total / months);
        } else {
          // Total indivisible (le Worker n'en produit pas, mais la page ne doit
          // pas en dépendre) : on ne peut pas en déduire un prix unitaire
          // honnête, donc on ne touche à aucun affichage. On mémorise le
          // montant exact pour que le clic suivant aboutisse au lieu de
          // renvoyer éternellement la même attente périmée.
          setPriceOverride(list, months, total);
        }
        // Le nouveau prix est montré dans les deux cas — c'est la décision
        // qu'on demande à l'acheteur de prendre.
        status.textContent = messageFor(code, slot, formatUsd(total / 100, lang));
        return;
      }

      // Pris entre l'affichage et le clic. On le retire de la vente partout
      // sur la page, pas seulement dans sa ligne d'inventaire.
      if (code === 'slot_taken') {
        takeInventoryRow(item);
        markSlotTaken(slot, takenLabel);
      }
      status.textContent = messageFor(code, slot, '');
    }

    function wireButton(btn, item, list, status) {
      btn.addEventListener('click', function () {
        // Un paiement est déjà en vol. On ne relance rien : la session en cours
        // a déjà posé une réservation, et une seconde consommerait le plafond
        // du visiteur pour un emplacement qu'il n'a pas fini de payer.
        if (inFlight) return;

        var slot = btn.dataset.slot;
        var months = monthsChosen();
        var unit = unitCentsOf(list);
        if (unit === null) {
          status.textContent = messageFor(null, slot, '');
          return;
        }
        var override = priceOverride(list, months);
        var expectedPriceCents = override === null ? unit * months : override;

        // `disabled` déplace le focus sur le body : on note qu'il était ici
        // pour le rendre en cas d'échec, sinon l'acheteur au clavier repart du
        // haut de la page pour réessayer.
        var hadFocus = document.activeElement === btn;
        inFlight = true;
        setButtonsDisabled(true);
        status.textContent = messageFor('opening', slot, '');

        function release() {
          inFlight = false;
          setButtonsDisabled(false);
          if (hadFocus && btn.isConnected !== false && btn.focus) btn.focus();
        }

        fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            slot: slot,
            months: months,
            expectedPriceCents: expectedPriceCents,
            lang: lang,
          }),
        })
          .then(function (res) {
            // Un corps illisible ne doit pas ressembler à une panne réseau :
            // on garde le statut HTTP et on laisse handleFailure décider.
            return res.json().then(
              function (body) { return { ok: res.ok, body: body }; },
              function () { return { ok: res.ok, body: null }; }
            );
          })
          .then(function (result) {
            var url = result.ok && result.body ? result.body.url : null;
            // Seul chemin qui quitte la page, et seul endroit qui accepte de
            // suivre une URL venue du réseau.
            if (isStripeCheckoutUrl(url)) {
              // Une réservation vient d'être posée à ce nom : on s'en souvient
              // pour que le retour sur cette page ne la traite pas comme celle
              // d'un inconnu. Avant la navigation — après, plus rien ne tourne.
              rememberOwnHold(slot);
              location.href = url;
              return; // boutons laissés désactivés : la page s'en va
            }
            handleFailure(result.body, slot, months, item, list, status);
            release();
          })
          .catch(function () {
            // Réseau coupé, CORS refusé, Worker injoignable. Jamais un
            // silence : rien n'a été réservé, rien n'a été débité, et
            // l'acheteur doit l'apprendre de la page, pas de la console.
            status.textContent = messageFor(null, slot, '');
            release();
          });
      });
    }

    function wireGroup(group) {
      var list = group.querySelector('.sp-inv');
      var status = group.querySelector('.sp-inv-status');
      if (!list || !status) return;
      var items = list.querySelectorAll('.sp-inv-item[data-slot]');
      for (var i = 0; i < items.length; i++) {
        var btn = items[i].querySelector('.sp-inv-buy');
        if (!btn) continue;
        btn.hidden = false;
        wireButton(btn, items[i], list, status);
      }
    }

    var fieldset = section.querySelector('.sp-duration');
    var note = section.querySelector('.sp-duration-note');
    if (fieldset) {
      fieldset.hidden = false;
      var radios = fieldset.querySelectorAll('input[name="sp-months"]');
      for (var r = 0; r < radios.length; r++) {
        radios[r].addEventListener('change', function () {
          if (note) {
            note.textContent = monthsChosen() === 3 ? note.dataset.noteThree : note.dataset.noteOne;
          }
          // Un message de dérive parle d'un prix POUR UNE DURÉE. Changer de
          // durée le rend faux, et l'attente mémorisée avec lui : les deux
          // partent ensemble plutôt que de rester à l'écran en mentant.
          clearStatuses();
          clearPriceOverrides();
        });
      }
    }

    for (var g = 0; g < groups.length; g++) wireGroup(groups[g]);

    // Retour par l'historique. Partir vers Stripe laisse volontairement les
    // boutons désactivés — la page s'en va — mais un retour arrière restaure le
    // DOM tel quel depuis le cache de navigation : l'acheteur retrouverait un
    // bouton mort sous un « ouverture de la page de paiement » qui n'a plus
    // lieu d'être. Les deux redeviennent vrais ici.
    //
    // `pageshow` se déclenche aussi au premier affichage, où il ne fait que
    // réaffirmer l'état initial — sans effet, et sans cas particulier à écrire.
    window.addEventListener('pageshow', function () {
      inFlight = false;
      setButtonsDisabled(false);
      clearStatuses();
    });
  }

  // Retour depuis Stripe : `success_url` porte ?paid=1. Cette redirection n'a
  // AUCUNE autorité — seule la signature du webhook prouve un paiement, et
  // n'importe qui peut taper cette URL à la main. La note n'affirme donc rien
  // sur ce visiteur : elle accuse le retour, renvoie au reçu envoyé par
  // Stripe, et rappelle que la validation est manuelle.
  function enhanceSponsorPaidNote() {
    var note = document.getElementById('sponsor-paid-note');
    if (!note) return;
    if (new URLSearchParams(location.search).get('paid') !== '1') return;
    note.hidden = false;
  }

  enhanceHome();
  enhanceSearchCombo();
  enhanceThemeToggle();
  enhanceCopyButton();
  enhanceAgentButtons();
  enhanceVote();
  // L'ordre compte un peu : le checkout dévoile ses boutons tout de suite,
  // sans attendre la réponse de /slots (une API lente ou en panne ne doit pas
  // laisser la page sans bouton d'achat). Le rafraîchissement, lui, arrive
  // ensuite et retire les boutons des emplacements qu'il déclare pris.
  enhanceSponsorInventory();
  enhanceSponsorCheckout();
  enhanceSponsorPaidNote();
})();
