export function normalizeHost(host) {
  if (typeof host !== 'string') return null;
  let h = host.trim().toLowerCase();
  if (!h) return null;
  h = h.split(':')[0];
  if (h.endsWith('.')) h = h.slice(0, -1);
  if (h.startsWith('www.')) h = h.slice(4);
  return h || null;
}

export function matchHost(host, index) {
  const h = normalizeHost(host);
  if (!h) return null;
  if (Object.prototype.hasOwnProperty.call(index, h)) return index[h];

  let rest = h;
  while (true) {
    const dot = rest.indexOf('.');
    if (dot === -1) return null;
    rest = rest.slice(dot + 1);
    if (!rest.includes('.')) return null;
    if (Object.prototype.hasOwnProperty.call(index, rest)) return index[rest];
  }
}
