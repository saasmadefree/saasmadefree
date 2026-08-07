import { describe, it, expect, afterEach, vi } from 'vitest';
import { verifyStripeSignature, createCheckoutSession } from '../src/stripe.mjs';

const SECRET = 'whsec_test';
const PAYLOAD = '{"id":"evt_1","type":"checkout.session.completed"}';

async function sign(payload, secret, timestamp) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const now = new Date('2026-08-07T12:00:00Z');
const t = Math.floor(now.getTime() / 1000);

describe('verifyStripeSignature', () => {
  it('accepte une signature valide et fraîche', async () => {
    const header = `t=${t},v1=${await sign(PAYLOAD, SECRET, t)}`;
    expect(await verifyStripeSignature(PAYLOAD, header, SECRET, now)).toBe(true);
  });

  it('refuse une signature faite avec un autre secret', async () => {
    const header = `t=${t},v1=${await sign(PAYLOAD, 'whsec_autre', t)}`;
    expect(await verifyStripeSignature(PAYLOAD, header, SECRET, now)).toBe(false);
  });

  it('refuse un corps modifié après signature', async () => {
    const header = `t=${t},v1=${await sign(PAYLOAD, SECRET, t)}`;
    expect(await verifyStripeSignature(`${PAYLOAD} `, header, SECRET, now)).toBe(false);
  });

  it('refuse un horodatage hors tolérance — c’est la garde anti-rejeu', async () => {
    const old = t - 3600;
    const header = `t=${old},v1=${await sign(PAYLOAD, SECRET, old)}`;
    expect(await verifyStripeSignature(PAYLOAD, header, SECRET, now)).toBe(false);
  });

  it('refuse un en-tête absent, vide ou malformé', async () => {
    for (const header of [null, '', 'garbage', 't=abc,v1=zz', `t=${t}`]) {
      expect(await verifyStripeSignature(PAYLOAD, header, SECRET, now)).toBe(false);
    }
  });

  it('accepte quand l’une des signatures v1 listées est bonne', async () => {
    const good = await sign(PAYLOAD, SECRET, t);
    const header = `t=${t},v1=${'0'.repeat(64)},v1=${good}`;
    expect(await verifyStripeSignature(PAYLOAD, header, SECRET, now)).toBe(true);
  });

  it('refuse sans secret plutôt que de vérifier contre une clé vide', async () => {
    const header = `t=${t},v1=${await sign(PAYLOAD, SECRET, t)}`;
    expect(await verifyStripeSignature(PAYLOAD, header, '', now)).toBe(false);
    expect(await verifyStripeSignature(PAYLOAD, header, undefined, now)).toBe(false);
  });
});

// createCheckoutSession — appel REST brut vers Stripe, fetch stubbé (même
// technique que scheduled.test.mjs pour l'appel GraphQL Cloudflare) : on
// tourne dans le même isolate workerd que le SUT, donc le `fetch` global que
// `stripe.mjs` résout au moment de l'appel voit bien le mock posé ici.
describe('createCheckoutSession', () => {
  afterEach(() => vi.restoreAllMocks());

  const ARGS = {
    slot: 'L1',
    months: 1,
    amountCents: 14900,
    successUrl: 'https://saasmadefree.com/sponsors/success',
    cancelUrl: 'https://saasmadefree.com/sponsors/cancel',
  };

  function mockStripe(status = 200, body = { id: 'cs_test_123', url: 'https://checkout.stripe.com/cs_test_123' }) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (status >= 200 && status < 300) {
        return new Response(JSON.stringify(body), { status });
      }
      return new Response(JSON.stringify({ error: { message: 'nope' } }), { status });
    });
  }

  it('envoie le montant demandé et les trois custom_fields, et renvoie id/url', async () => {
    const fetchSpy = mockStripe();
    const session = await createCheckoutSession({ STRIPE_SECRET_KEY: 'sk_test_abc' }, ARGS);

    expect(session).toEqual({ id: 'cs_test_123', url: 'https://checkout.stripe.com/cs_test_123' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(init.method).toBe('POST');

    const body = new URLSearchParams(init.body);
    expect(body.get('line_items[0][price_data][unit_amount]')).toBe('14900');
    expect(body.get('line_items[0][price_data][currency]')).toBe('usd');
    expect(body.get('metadata[slot]')).toBe('L1');
    expect(body.get('metadata[months]')).toBe('1');

    expect(body.get('custom_fields[0][key]')).toBe('sponsor_name');
    expect(body.get('custom_fields[1][key]')).toBe('sponsor_domain');
    expect(body.get('custom_fields[2][key]')).toBe('sponsor_tagline');
  });

  it('lève sur une réponse Stripe non-2xx plutôt que de renvoyer une session cassée', async () => {
    mockStripe(402);
    await expect(createCheckoutSession({ STRIPE_SECRET_KEY: 'sk_test_abc' }, ARGS)).rejects.toThrow();
  });

  it('transporte la clé secrète dans l’en-tête Authorization, jamais dans le corps ni l’URL', async () => {
    const fetchSpy = mockStripe();
    await createCheckoutSession({ STRIPE_SECRET_KEY: 'sk_test_super_secret' }, ARGS);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(init.headers.authorization).toBe('Bearer sk_test_super_secret');
    expect(url).not.toContain('sk_test_super_secret');
    expect(init.body).not.toContain('sk_test_super_secret');
  });
});
