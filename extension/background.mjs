import { matchHost } from './lib/domain-match.mjs';
import {
  FEED_BASE, VOTE_ENDPOINT, REFRESH_ALARM, REFRESH_PERIOD_MINUTES, pickLang,
} from './lib/config.mjs';

async function readSnapshot() {
  const response = await fetch(chrome.runtime.getURL('data/index.json'));
  return response.json();
}

async function getState() {
  try {
    const stored = await chrome.storage.local.get(['index', 'agents', 'fetchedAt']);
    if (stored.index) return stored;
    const index = await readSnapshot();
    await chrome.storage.local.set({ index, agents: [], fetchedAt: 0 });
    return { index, agents: [], fetchedAt: 0 };
  } catch {
    // Stockage indisponible ou instantané illisible au tout premier lancement :
    // matchHost échoue fermé sur un index absent, mais getState elle-même ne
    // doit jamais rejeter, sous peine de laisser le gestionnaire de messages
    // sans réponse.
    return { index: null, agents: [], fetchedAt: 0 };
  }
}

async function refreshFeed() {
  try {
    const [indexRes, agentsRes] = await Promise.all([
      fetch(`${FEED_BASE}/index.json`, { cache: 'no-cache' }),
      fetch(`${FEED_BASE}/agents.json`, { cache: 'no-cache' }),
    ]);
    if (!indexRes.ok || !agentsRes.ok) return;
    const index = await indexRes.json();
    const agents = await agentsRes.json();
    // Un corps vide mais bien typé ({} ou []) passe un contrôle naïf et écrase
    // un cache qui marchait, pour 24 h. Exiger du contenu, pas seulement un type.
    const usable =
      index && typeof index === 'object' && Object.keys(index).length > 0 &&
      Array.isArray(agents) && agents.length > 0;
    if (usable) {
      await chrome.storage.local.set({ index, agents, fetchedAt: Date.now() });
    }
  } catch {
    // Réseau indisponible : l'instantané en place reste valable.
  }
}

async function fetchTool(slug, lang) {
  try {
    const res = await fetch(`${FEED_BASE}/${lang}/tools/${slug}.json`);
    if (res.ok) return res.json();
    if (lang !== 'en') {
      const fallback = await fetch(`${FEED_BASE}/en/tools/${slug}.json`);
      if (fallback.ok) return fallback.json();
    }
  } catch {
    // ignoré : le popup affichera l'état minimal issu de l'index
  }
  return null;
}

async function sendVote(slug) {
  try {
    const res = await fetch(VOTE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    if (res.ok) return res.json();
  } catch {
    // tombe dans la file ci-dessous
  }
  const { pendingVotes = [] } = await chrome.storage.local.get('pendingVotes');
  if (!pendingVotes.includes(slug)) {
    await chrome.storage.local.set({ pendingVotes: [...pendingVotes, slug] });
  }
  return { queued: true };
}

// Ne jamais vider la file avant d'avoir envoyé : un service worker MV3 est tué
// à tout moment, et tout ce qui a été retiré du stockage sans être parti est
// perdu sans trace. Chaque slug ne quitte la file qu'une fois son envoi réussi.
async function flushPendingVotes() {
  const { pendingVotes = [] } = await chrome.storage.local.get('pendingVotes');
  for (const slug of pendingVotes) {
    const result = await sendVote(slug);
    if (result?.queued) break; // toujours hors ligne, inutile d'insister
    const { pendingVotes: current = [] } = await chrome.storage.local.get('pendingVotes');
    await chrome.storage.local.set({
      pendingVotes: current.filter((s) => s !== slug),
    });
  }
}

const handlers = {
  async lookup({ host }) {
    const { index } = await getState();
    return matchHost(host, index);
  },
  async tool({ slug, lang }) {
    return fetchTool(slug, lang ?? pickLang(chrome.i18n.getUILanguage()));
  },
  async agents() {
    const { agents } = await getState();
    return agents;
  },
  async vote({ slug }) {
    return sendVote(slug);
  },
  async hidden({ slug }) {
    const { hiddenSlugs = [] } = await chrome.storage.local.get('hiddenSlugs');
    return hiddenSlugs.includes(slug);
  },
  async hide({ slug }) {
    const { hiddenSlugs = [] } = await chrome.storage.local.get('hiddenSlugs');
    if (!hiddenSlugs.includes(slug)) {
      await chrome.storage.local.set({ hiddenSlugs: [...hiddenSlugs, slug] });
    }
    return true;
  },
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = handlers[message?.type];
  if (!handler) return false;
  handler(message).then(sendResponse, () => sendResponse(null));
  return true; // réponse asynchrone
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: REFRESH_PERIOD_MINUTES });
  refreshFeed();
});

chrome.runtime.onStartup.addListener(() => {
  refreshFeed();
  flushPendingVotes();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    refreshFeed();
    flushPendingVotes();
  }
});
