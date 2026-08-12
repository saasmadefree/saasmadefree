const MONTHLY_SUFFIX = { en: '/mo', fr: '/mois' };

/** Codes fermés de pricing.basis (schema/tool.schema.json) qui représentent un
 *  montant récurrent mensuel — "one-time" en est délibérément exclu. Exporté
 *  parce que les sommes de l'état récapitulatif de l'accueil (catalogueFigures,
 *  mrrDestroyed — voir scripts/lib/site-data.mjs) filtrent sur le même critère
 *  pour ne jamais additionner un prix qui n'est pas vraiment mensuel. */
export const MONTHLY_BASES = new Set([
  'flat-monthly', 'per-seat-monthly', 'annual-effective-monthly', 'usage-based',
]);

export function formatMoney(amount, currency, lang) {
  const digits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat(lang, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

/** N'affirme le suffixe "/mois" que si le code basis représente vraiment un montant
 *  mensuel récurrent — sinon on se contente du montant brut plutôt que de supposer
 *  une périodicité. */
export function monthlySuffix(lang) {
  return MONTHLY_SUFFIX[lang] ?? '/mo';
}

export function formatMonthlyPrice(pricing, lang) {
  const money = formatMoney(pricing.amount, pricing.currency, lang);
  if (!MONTHLY_BASES.has(pricing.basis)) return money;
  return `${money}${monthlySuffix(lang)}`;
}

export function formatDate(iso, lang) {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date);
}

/** Date de tampon administratif : JJ.MM.AAAA, identique dans les sept locales
 *  (spec §3 — la langue du tampon est numérique et univoque). Les dates en
 *  prose passent par formatDate/Intl, pas par ici. */
export function formatStampDate(iso) {
  const [y, m, d] = String(iso).split('-');
  return `${d}.${m}.${y}`;
}

export function interpolate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? ''));
}

function isSingular(count, lang) {
  return lang === 'fr' ? count <= 1 : count === 1;
}

export function pluralize(count, lang, singularTpl, otherTpl) {
  return interpolate(isSingular(count, lang) ? singularTpl : otherTpl, { count });
}
