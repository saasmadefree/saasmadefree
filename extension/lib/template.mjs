export const ALLOWED_VARS = new Set(['prompt', 'prompt_url', 'lang', 'slug']);

const VAR_PATTERN = /\{([a-z_]+)\}/g;

export function renderTemplate(template, values) {
  const unknown = [...String(template).matchAll(VAR_PATTERN)]
    .map((m) => m[1])
    .filter((name) => !ALLOWED_VARS.has(name));
  if (unknown.length > 0) {
    throw new Error(`Variables non autorisées : ${[...new Set(unknown)].join(', ')}`);
  }
  return String(template).replace(VAR_PATTERN, (_, name) =>
    encodeURIComponent(values?.[name] ?? '')
  );
}

export function resolveAction(agent, ctx) {
  if (agent.status === 'not-yet') {
    return { mode: 'not-yet', url: null };
  }
  if (agent.kind === 'clipboard' || !agent.template) {
    return { mode: 'clipboard', url: agent.homepage ?? null };
  }
  const url = renderTemplate(agent.template, ctx);
  if (agent.maxLength && url.length > agent.maxLength) {
    return { mode: 'clipboard', url: agent.homepage ?? null, reason: 'too-long' };
  }
  return { mode: agent.kind === 'deeplink' ? 'deeplink' : 'url', url };
}
