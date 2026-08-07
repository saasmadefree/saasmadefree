// Tout ce qui parle à Stripe, et rien d'autre : le protocole (REST + Web
// Crypto), pas la logique métier (sponsors.mjs) ni le routage HTTP
// (index.mjs). Zéro dépendance runtime — pas de stripe-node — donc appels
// `fetch` bruts et vérification de signature via `crypto.subtle`.

const STRIPE_API = 'https://api.stripe.com/v1';
const DEFAULT_TOLERANCE_SEC = 300;

/** Comparaison à temps constant : une comparaison naïve fuit la position du
 *  premier octet faux, et permet de reconstruire une signature octet par
 *  octet en mesurant les temps de réponse. */
function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * En-tête Stripe-Signature : `t=<unix>,v1=<hex>[,v1=<hex>…]`.
 * On découpe sur le PREMIER "=" seulement — une valeur peut en contenir.
 */
function parseSignatureHeader(header) {
  const out = { t: null, v1: [] };
  if (typeof header !== 'string' || header.length === 0) return out;
  for (const part of header.split(',')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key === 't') out.t = value;
    else if (key === 'v1') out.v1.push(value);
  }
  return out;
}

/**
 * Vérifie un événement webhook Stripe. `payload` doit être le corps brut
 * exactement tel que reçu (chaîne, avant tout parse JSON) — la signature
 * porte sur les octets bruts, un `JSON.stringify(JSON.parse(...))` ne
 * redonnerait pas la même chaîne et ferait échouer une requête légitime.
 */
export async function verifyStripeSignature(payload, header, secret, now, toleranceSec = DEFAULT_TOLERANCE_SEC) {
  if (!secret) return false;
  const { t, v1 } = parseSignatureHeader(header);
  const timestamp = Number(t);
  if (!Number.isFinite(timestamp) || v1.length === 0) return false;
  // Garde anti-rejeu : un événement authentique mais vieux ne doit pas pouvoir
  // être renvoyé indéfiniment par quelqu'un qui l'aurait intercepté.
  if (Math.abs(Math.floor(now.getTime() / 1000) - timestamp) > toleranceSec) return false;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  // On compare TOUTES les signatures listées (rotation de secret côté
  // Stripe) : n'importe laquelle qui vérifie suffit à accepter l'événement.
  return v1.some((candidate) => timingSafeEqualHex(expected, candidate));
}

/**
 * Crée une Checkout Session par l'API REST — pas de SDK, donc pas de
 * dépendance runtime. Les trois `custom_fields` collectent la créa (nom,
 * domaine, une ligne) dans le formulaire de Stripe lui-même : aucune page de
 * formulaire à écrire de notre côté, et la créa arrive signée dans le webhook.
 */
export async function createCheckoutSession(env, { slot, months, amountCents, successUrl, cancelUrl }) {
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', successUrl);
  form.set('cancel_url', cancelUrl);
  form.set('client_reference_id', slot);
  form.set('metadata[slot]', slot);
  form.set('metadata[months]', String(months));
  form.set('line_items[0][quantity]', '1');
  form.set('line_items[0][price_data][currency]', 'usd');
  form.set('line_items[0][price_data][unit_amount]', String(amountCents));
  form.set('line_items[0][price_data][product_data][name]', `Sponsor slot ${slot} — ${months} month(s)`);
  const fields = [
    ['sponsor_name', 'Display name'],
    ['sponsor_domain', 'Your domain'],
    ['sponsor_tagline', 'One line about you'],
  ];
  fields.forEach(([key, label], i) => {
    form.set(`custom_fields[${i}][key]`, key);
    form.set(`custom_fields[${i}][label][type]`, 'custom');
    form.set(`custom_fields[${i}][label][custom]`, label);
    form.set(`custom_fields[${i}][type]`, 'text');
  });

  // La clé secrète voyage dans l'en-tête Authorization, jamais dans le corps
  // ni dans l'URL — un log d'accès ou un outil de debug qui capture l'URL ou
  // le corps ne doit jamais pouvoir l'exposer.
  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  if (!res.ok) throw new Error(`stripe ${res.status}`);
  const session = await res.json();
  return { id: session.id, url: session.url };
}
