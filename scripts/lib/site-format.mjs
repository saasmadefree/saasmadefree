const MONTHLY_SUFFIX = { en: '/mo', fr: '/mois' };

/** Codes fermés de pricing.basis (schema/tool.schema.json) qui représentent un
 *  montant récurrent mensuel — "one-time" en est délibérément exclu. */
const MONTHLY_BASES = new Set([
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
export function formatMonthlyPrice(pricing, lang) {
  const money = formatMoney(pricing.amount, pricing.currency, lang);
  if (!MONTHLY_BASES.has(pricing.basis)) return money;
  return `${money}${MONTHLY_SUFFIX[lang] ?? '/mo'}`;
}

export function formatDate(iso, lang) {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date);
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
