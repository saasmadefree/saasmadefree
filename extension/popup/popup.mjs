import { resolveAction } from '../lib/template.mjs';
import { FEED_ORIGIN, GITHUB_ISSUE_URL, pickLang } from '../lib/config.mjs';

const t = (key) => chrome.i18n.getMessage(key);
const $ = (id) => document.getElementById(id);

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

  const lang = pickLang(chrome.i18n.getUILanguage());
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
    $('run-hint').textContent = t(`runHint_${agent.runHint}`) || '';
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
      $('status').textContent = t('copiedPasteIt');
      return;
    }

    if (action.mode === 'not-yet') {
      const title = encodeURIComponent(`Support ${agent.name} prompt handoff`);
      chrome.tabs.create({ url: `${GITHUB_ISSUE_URL}?title=${title}&labels=agent-request` });
      return;
    }

    if (action.mode === 'clipboard') {
      await copy(tool.prompt);
      $('status').textContent = action.reason === 'too-long'
        ? t('copiedTooLong')
        : t('copiedPasteIt');
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
        $('status').textContent = launched ? t('sent') : t('agentNotInstalled');
      }, 1500);
      return;
    }

    chrome.tabs.create({ url: action.url });
    $('status').textContent = t('sent');
  });

  $('myself').addEventListener('click', async () => {
    await copy(tool.prompt);
    const result = await chrome.runtime.sendMessage({ type: 'vote', slug: tool.slug });
    $('status').textContent = result?.queued
      ? t('copiedVoteQueued')
      : t('copiedVoteCounted').replace('{count}', String(result?.count ?? ''));
  });
}

main();
