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

async function queueVote(slug) {
  const { pendingVotes = [] } = await chrome.storage.local.get('pendingVotes');
  if (!pendingVotes.includes(slug)) {
    await chrome.storage.local.set({ pendingVotes: [...pendingVotes, slug] });
  }
  return { queued: true };
}

async function dropQueuedVote(slug) {
  const { pendingVotes = [] } = await chrome.storage.local.get('pendingVotes');
  if (pendingVotes.includes(slug)) {
    await chrome.storage.local.set({ pendingVotes: pendingVotes.filter((s) => s !== slug) });
  }
}

// export : uniquement pour que tests/background-vote-queue.test.mjs puisse
// exercer la logique de la file sans dupliquer chrome.runtime.* — n'affecte
// pas le service worker chargé par Chrome (déclaré "type": "module").
export async function sendVote(slug) {
  let res;
  try {
    res = await fetch(VOTE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
  } catch {
    return queueVote(slug); // hors ligne : le seul cas où on retente plus tard
  }

  if (res.ok) return res.json();

  // 429 (limite de débit) et 5xx (panne côté serveur/D1) sont transitoires :
  // remettre le slug en file pour réessayer plus tard a du sens. Tout autre
  // 4xx (par exemple 400 unknown_slug, si l'outil a été retiré de data/) est
  // définitif — le remettre en file bloquerait tous les votes suivants
  // derrière lui pour toujours, puisque flushPendingVotes() s'arrête au
  // premier résultat encore en file. On ne retente donc que du transitoire.
  if (res.status === 429 || res.status >= 500) return queueVote(slug);

  // Échec définitif : ce slug n'a aucune chance de réussir plus tard (le
  // tool n'existe plus, ou la requête est mal formée). On le laisse tomber
  // au lieu de le mettre en file, et on le retire de toute file existante
  // s'il s'y trouvait déjà d'une tentative précédente.
  await dropQueuedVote(slug);
  return res.json().catch(() => ({ error: 'request_failed' }));
}

// Ne jamais vider la file avant d'avoir envoyé : un service worker MV3 est tué
// à tout moment, et tout ce qui a été retiré du stockage sans être parti est
// perdu sans trace. Chaque slug ne quitte la file qu'une fois son envoi
// définitivement réussi ou définitivement raté (voir sendVote) — jamais avant.
export async function flushPendingVotes() {
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
  // La pastille injectée par content.js ne peut pas ouvrir elle-même une page
  // chrome-extension:// : `window.open` depuis un script de contenu a la page
  // web comme initiateur, et Chrome bloque la navigation vers une ressource
  // d'extension non déclarée dans web_accessible_resources. On ne déclare
  // délibérément pas popup/popup.html là-dedans (ça le rendrait sondable par
  // n'importe quel site, une surface de fingerprinting). La seule ouverture
  // fiable passe donc par le service worker, qui a le droit d'ouvrir un onglet.
  async openPanel({ slug }) {
    await chrome.tabs.create({
      url: chrome.runtime.getURL(`popup/popup.html?slug=${encodeURIComponent(slug)}`),
    });
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
