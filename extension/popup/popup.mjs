import { resolveAction } from '../lib/template.mjs';
import { FEED_ORIGIN, GITHUB_ISSUE_URL, pickLang } from '../lib/config.mjs';

const t = (key) => chrome.i18n.getMessage(key);
const $ = (id) => document.getElementById(id);

// La visibilité du statut est pilotée par l'attribut `hidden`, jamais par
// `:empty` en CSS : tant que `_locales` n'existe pas (Tâche 12), et même
// après, une clé de traduction manquante dans une seule langue ne doit pas
// supprimer silencieusement tout retour utilisateur dans cette langue.
function setStatus(text) {
  const node = $('status');
  node.textContent = text ?? '';
  node.hidden = !node.textContent;
}

function applyStaticLabels() {
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
}

async function currentSlug() {
  const fromQuery = new URLSearchParams(location.search).get('slug');
  if (fromQuery) return fromQuery;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return null;
  let host;
  try {
    host = new URL(tab.url).hostname;
  } catch {
    return null;
  }
  const entry = await chrome.runtime.sendMessage({ type: 'lookup', host });
  return entry?.slug ?? null;
}

function fillList(node, items) {
  node.replaceChildren(...items.map((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    return li;
  }));
}

async function copy(text) {
  await navigator.clipboard.writeText(text);
}

async function main() {
  applyStaticLabels();

  const slug = await currentSlug();
  if (!slug) return;

  // `lang` en storage (Task 12, page d'options) ne change jamais les libellés
  // statiques de l'extension — chrome.i18n.getMessage() suit la langue du
  // navigateur, aucun hook JS ne peut la rediriger. Ce que le réglage change
  // vraiment, c'est la langue des FICHES récupérées depuis le feed (résumé,
  // ce qu'on perd, prompt). 'auto' (ou une valeur absente) retombe sur la
  // langue du navigateur ; pickLang('auto') renverrait sinon 'en' en silence,
  // puisque 'auto' n'appartient pas à LANGS.
  const { lang: storedLang } = await chrome.storage.local.get('lang');
  const lang = pickLang(
    storedLang && storedLang !== 'auto' ? storedLang : chrome.i18n.getUILanguage()
  );
  const [tool, feedAgents, stored] = await Promise.all([
    chrome.runtime.sendMessage({ type: 'tool', slug, lang }),
    chrome.runtime.sendMessage({ type: 'agents' }),
    chrome.storage.local.get('customAgent'),
  ]);
  if (!tool) return;

  // L'agent personnel de l'utilisateur, défini dans la page d'options, complète
  // le registre distant. Il n'est jamais transmis nulle part.
  const agents = [...feedAgents];
  if (stored.customAgent?.template) {
    agents.push({
      id: 'custom',
      name: stored.customAgent.name || 'Custom',
      kind: 'url',
      template: stored.customAgent.template,
      homepage: null,
      maxLength: null,
      status: 'verified',
      runHint: 'clipboard',
    });
  }

  $('empty').hidden = true;
  $('app').hidden = false;

  $('tool-name').textContent = tool.name;
  $('verdict-dot').className = tool.verdict;
  $('verdict-dot').textContent = t(`verdict_${tool.verdict}`);
  $('price').textContent = new Intl.NumberFormat(lang, {
    style: 'currency', currency: tool.pricing.currency,
  }).format(tool.pricing.amount) + ' / ' + t('perMonth');
  $('verdict-summary').textContent = tool.verdictSummary;
  fillList($('what-you-lose'), tool.whatYouLose);
  $('why-pay').textContent = tool.whyPeopleStillPay;
  $('full-page').href = `${FEED_ORIGIN}${tool.url}`;

  const select = $('agent');
  select.replaceChildren(...agents.map((agent) => {
    const option = document.createElement('option');
    option.value = agent.id;
    option.textContent = agent.status === 'not-yet'
      ? `${agent.name} — ${t('notYet')}`
      : agent.name;
    return option;
  }));

  // Sélecteur vide : premier lancement avant le premier rafraîchissement du
  // service worker (qui amorce `agents: []`), ou `agents.json` transitoirement
  // rejeté. Un clic sur « Send » ne doit pas rester un no-op silencieux.
  if (agents.length === 0) {
    select.disabled = true;
    $('send').disabled = true;
    setStatus(t('noAgentsYet'));
  }

  const ctx = {
    prompt: tool.prompt,
    prompt_url: `${FEED_ORIGIN}${tool.promptUrl}`,
    lang,
    slug: tool.slug,
  };

  const selectedAgent = () => agents.find((a) => a.id === select.value);

  function refreshHint() {
    const agent = selectedAgent();
    if (!agent) return;
    // Chrome message names may only contain [A-Za-z0-9_@] — a hyphen anywhere
    // in a _locales/*/messages.json key makes the whole bundle fail to load
    // (extensions/common/message_bundle.cc::IsValidName). agent.runHint comes
    // straight from data/agents.json, whose schema allows hyphens
    // (^[a-z0-9-]+$), so it must be sanitized before it becomes a lookup key.
    $('run-hint').textContent = t(`runHint_${agent.runHint.replace(/-/g, '_')}`) || '';
    $('send').textContent = agent.status === 'not-yet' ? t('requestSupport') : t('sendPrompt');
  }

  select.addEventListener('change', refreshHint);
  refreshHint();

  $('send').addEventListener('click', async () => {
    const agent = selectedAgent();
    if (!agent) return;

    let action;
    try {
      action = resolveAction(agent, ctx);
    } catch {
      // Un modèle de l'agent mal formé (variable hors liste blanche) ne doit
      // jamais planter le panneau : l'utilisateur garde quand même le prompt.
      await copy(tool.prompt);
      setStatus(t('copiedPasteIt'));
      return;
    }

    if (action.mode === 'not-yet') {
      const title = encodeURIComponent(`Support ${agent.name} prompt handoff`);
      chrome.tabs.create({ url: `${GITHUB_ISSUE_URL}?title=${title}&labels=agent-request` });
      return;
    }

    if (action.mode === 'clipboard') {
      await copy(tool.prompt);
      setStatus(action.reason === 'too-long' ? t('copiedTooLong') : t('copiedPasteIt'));
      if (action.url) chrome.tabs.create({ url: action.url });
      return;
    }

    if (action.mode === 'deeplink') {
      await copy(tool.prompt);
      let launched = false;
      const onBlur = () => { launched = true; };
      window.addEventListener('blur', onBlur, { once: true });
      location.href = action.url;
      setTimeout(() => {
        window.removeEventListener('blur', onBlur);
        setStatus(launched ? t('sent') : t('agentNotInstalled'));
      }, 1500);
      return;
    }

    chrome.tabs.create({ url: action.url });
    setStatus(t('sent'));
  });

  $('myself').addEventListener('click', async () => {
    await copy(tool.prompt);
    const result = await chrome.runtime.sendMessage({ type: 'vote', slug: tool.slug });
    // Distinguer explicitement les trois formes documentées de la réponse :
    // une réponse hors contrat (le worker répond `null` quand son handler
    // rejette) ne doit jamais s'afficher comme un vote compté — sur un site
    // dont l'argument entier est l'honnêteté de ses chiffres, un vote raté ne
    // doit jamais se lire comme un vote enregistré.
    if (result?.queued) {
      setStatus(t('copiedVoteQueued'));
    } else if (typeof result?.count === 'number') {
      setStatus(t('copiedVoteCounted').replace('{count}', String(result.count)));
    } else {
      setStatus(t('voteFailed'));
    }
  });
}

main();
