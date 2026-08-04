// Crawlers IA reconnus par la façade (source `edge-worker`) et par le cron
// GraphQL (source `cloudflare-api`) — une seule liste pour les deux, c'est le
// contrat de la spec (§6). Le matching est une recherche de sous-chaîne
// insensible à la casse : les UA réels enrobent le jeton ("Mozilla/5.0 …;
// compatible; GPTBot/1.2; +https://…"). Ajouter un bot = ajouter une ligne.
// Référence des jetons : la doc Cloudflare "AI Crawl Control — Bot reference".
export const AI_BOTS = [
  { bot: 'gptbot', label: 'GPTBot', vendor: 'OpenAI', ua: 'GPTBot' },
  { bot: 'oai-searchbot', label: 'OAI-SearchBot', vendor: 'OpenAI', ua: 'OAI-SearchBot' },
  { bot: 'chatgpt-user', label: 'ChatGPT-User', vendor: 'OpenAI', ua: 'ChatGPT-User' },
  { bot: 'claudebot', label: 'ClaudeBot', vendor: 'Anthropic', ua: 'ClaudeBot' },
  { bot: 'claude-user', label: 'Claude-User', vendor: 'Anthropic', ua: 'Claude-User' },
  { bot: 'claude-searchbot', label: 'Claude-SearchBot', vendor: 'Anthropic', ua: 'Claude-SearchBot' },
  { bot: 'perplexitybot', label: 'PerplexityBot', vendor: 'Perplexity', ua: 'PerplexityBot' },
  { bot: 'perplexity-user', label: 'Perplexity-User', vendor: 'Perplexity', ua: 'Perplexity-User' },
  { bot: 'google-extended', label: 'Google-Extended', vendor: 'Google', ua: 'Google-Extended' },
  { bot: 'googleother', label: 'GoogleOther', vendor: 'Google', ua: 'GoogleOther' },
  { bot: 'bytespider', label: 'Bytespider', vendor: 'ByteDance', ua: 'Bytespider' },
  { bot: 'ccbot', label: 'CCBot', vendor: 'Common Crawl', ua: 'CCBot' },
  { bot: 'amazonbot', label: 'Amazonbot', vendor: 'Amazon', ua: 'Amazonbot' },
  { bot: 'applebot-extended', label: 'Applebot-Extended', vendor: 'Apple', ua: 'Applebot-Extended' },
  { bot: 'meta-externalagent', label: 'Meta-ExternalAgent', vendor: 'Meta', ua: 'meta-externalagent' },
  { bot: 'meta-externalfetcher', label: 'Meta-ExternalFetcher', vendor: 'Meta', ua: 'meta-externalfetcher' },
  { bot: 'mistralai-user', label: 'MistralAI-User', vendor: 'Mistral', ua: 'MistralAI-User' },
  { bot: 'cohere-ai', label: 'cohere-ai', vendor: 'Cohere', ua: 'cohere-ai' },
  { bot: 'diffbot', label: 'Diffbot', vendor: 'Diffbot', ua: 'Diffbot' },
  { bot: 'timpibot', label: 'Timpibot', vendor: 'Timpi', ua: 'Timpibot' },
  { bot: 'omgili', label: 'Omgili', vendor: 'Webz.io', ua: 'omgili' },
];

export function matchAiBot(ua) {
  if (typeof ua !== 'string' || ua.length === 0) return null;
  const hay = ua.toLowerCase();
  for (const entry of AI_BOTS) {
    if (hay.includes(entry.ua.toLowerCase())) return entry;
  }
  return null;
}

// Labels de provenance acceptés par le beacon (spec §3). Le mapping
// referrer → label se fait côté client (scripts/lib/site-beacon.mjs) ; le
// worker ne fait que valider l'appartenance. Le test de parité
// (worker/test/labels-parity.test.mjs, Task 6) garantit que les deux listes
// ne divergent jamais.
export const AI_REFERRER_LABELS = new Set([
  'chatgpt', 'perplexity', 'claude', 'gemini', 'copilot', 'le-chat', 'deepseek', 'grok',
]);

export const REFERRER_LABELS = new Set([
  ...AI_REFERRER_LABELS,
  'google', 'bing', 'duckduckgo', 'github', 'reddit', 'other', 'none',
]);
