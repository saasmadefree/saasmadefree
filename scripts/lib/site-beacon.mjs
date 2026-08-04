// Provenances reconnues par le beacon et générateur du script client
// (dist/assets/beacon.js). Ce module est volontairement sans dépendance : il
// est aussi importé par worker/test/labels-parity.test.mjs, qui garantit que
// cette table et les Sets du worker (worker/src/ai-bots.mjs) ne divergent
// jamais. Règle de la spec (§3) : l'URL référente complète ne quitte jamais
// le navigateur — seul le label mappé est envoyé.
export const AI_REFERRERS = [
  { label: 'chatgpt', hosts: ['chatgpt.com', 'chat.openai.com'] },
  { label: 'perplexity', hosts: ['perplexity.ai'] },
  { label: 'claude', hosts: ['claude.ai'] },
  { label: 'gemini', hosts: ['gemini.google.com', 'bard.google.com'] },
  { label: 'copilot', hosts: ['copilot.microsoft.com'] },
  { label: 'le-chat', hosts: ['chat.mistral.ai'] },
  { label: 'deepseek', hosts: ['chat.deepseek.com'] },
  { label: 'grok', hosts: ['grok.com', 'grok.x.ai'] },
];

export const OTHER_REFERRERS = [
  // gemini.google.com est listé plus haut : l'ordre IA d'abord fait gagner le
  // label le plus précis. Les moteurs classiques sont collectés mais pas
  // affichés sur /stats (spec §14).
  { label: 'google', hosts: ['google.com', 'google.fr', 'google.de', 'google.es', 'google.it', 'google.nl', 'google.pt', 'google.co.uk'] },
  { label: 'bing', hosts: ['bing.com'] },
  { label: 'duckduckgo', hosts: ['duckduckgo.com'] },
  { label: 'github', hosts: ['github.com'] },
  { label: 'reddit', hosts: ['reddit.com'] },
];

const OWN_HOST = 'saasmadefree.com';

function hostMatches(hostname, pattern) {
  return hostname === pattern || hostname.endsWith('.' + pattern);
}

export function labelForReferrer(referrer) {
  if (!referrer) return 'none';
  let hostname;
  try {
    hostname = new URL(referrer).hostname.toLowerCase();
  } catch {
    return 'none';
  }
  if (hostMatches(hostname, OWN_HOST)) return 'none'; // navigation interne
  for (const entry of [...AI_REFERRERS, ...OTHER_REFERRERS]) {
    for (const pattern of entry.hosts) {
      if (hostMatches(hostname, pattern)) return entry.label;
    }
  }
  return 'other';
}

// Le script client, généré depuis la même table que labelForReferrer — le
// test tests/site-beacon.test.mjs exécute ce texte-là, pas une copie.
export function renderBeaconScript() {
  const table = JSON.stringify(
    [...AI_REFERRERS, ...OTHER_REFERRERS].map(({ label, hosts }) => [label, hosts])
  );
  return `// Généré par scripts/build-site.mjs depuis scripts/lib/site-beacon.mjs.
// Comptage d'audience first-party (voir /privacy) : pas de cookie, pas
// d'identifiant, l'URL référente est réduite à un label avant d'être envoyée.
(function () {
  'use strict';
  if (location.hostname !== ${JSON.stringify(OWN_HOST)}) return;
  var ENDPOINT = 'https://votes.saasmadefree.com/api/v1/stats/beacon';
  var TABLE = ${table};
  function hostMatches(hostname, pattern) {
    return hostname === pattern || hostname.slice(-(pattern.length + 1)) === '.' + pattern;
  }
  function refLabel(referrer) {
    if (!referrer) return 'none';
    var hostname;
    try { hostname = new URL(referrer).hostname.toLowerCase(); } catch (e) { return 'none'; }
    if (hostMatches(hostname, ${JSON.stringify(OWN_HOST)})) return 'none';
    for (var i = 0; i < TABLE.length; i++) {
      for (var j = 0; j < TABLE[i][1].length; j++) {
        if (hostMatches(hostname, TABLE[i][1][j])) return TABLE[i][0];
      }
    }
    return 'other';
  }
  function send(payload) {
    try {
      // Corps string : sendBeacon l'envoie en text/plain, requête simple sans
      // préflight CORS ; le worker parse le JSON quelle que soit l'étiquette.
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) { navigator.sendBeacon(ENDPOINT, body); return; }
      fetch(ENDPOINT, { method: 'POST', body: body, keepalive: true }).catch(function () {});
    } catch (e) { /* le comptage ne casse jamais la page */ }
  }
  var langMatch = location.pathname.match(/^\\/([a-z]{2})(?:\\/|$)/);
  send({
    type: 'view',
    path: location.pathname,
    lang: langMatch ? langMatch[1] : 'en',
    ref: refLabel(document.referrer),
  });
  var slugMatch = location.pathname.match(/^\\/[a-z]{2}\\/tools\\/([a-z0-9-]+)/);
  if (!slugMatch) return;
  var slug = slugMatch[1];
  var copyBtn = document.getElementById('copy-prompt');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      send({ type: 'copy', slug: slug, agent: 'clipboard' });
    });
  }
  var agentBtns = document.querySelectorAll('.agent-btn');
  for (var k = 0; k < agentBtns.length; k++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        send({ type: 'open_agent', slug: slug, agent: btn.dataset.agentId });
      });
    })(agentBtns[k]);
  }
})();
`;
}
