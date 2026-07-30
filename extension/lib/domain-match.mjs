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
  // Échouer fermé : au premier démarrage, ou si le feed n'a pas pu être lu,
  // l'appelant peut passer un index absent. hasOwnProperty.call(null, …) lève,
  // et cette fonction s'exécute à chaque chargement de page.
  if (typeof index !== 'object' || index === null) return null;
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
