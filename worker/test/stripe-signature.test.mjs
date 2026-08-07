import { describe, it, expect, afterEach, vi } from 'vitest';
import { verifyStripeSignature, createCheckoutSession, customFieldValue } from '../src/stripe.mjs';

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

  const EXPIRES_AT = 1_785_000_000;
  const ARGS = {
    slot: 'L1',
    months: 1,
    amountCents: 14900,
    successUrl: 'https://saasmadefree.com/en/sponsor?paid=1',
    cancelUrl: 'https://saasmadefree.com/en/sponsor',
    expiresAt: EXPIRES_AT,
    holdId: 'h:abc123:11111111-2222-3333-4444-555555555555',
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

    // La session doit mourir avec la réservation, pas 24 h plus tard (défaut
    // de Stripe) : sinon le lien reste payable sur un slot déjà relâché.
    expect(body.get('expires_at')).toBe(String(EXPIRES_AT));
    // L'identifiant de réservation fait l'aller-retour : c'est lui qui, dans
    // le webhook, désigne la réservation à honorer.
    expect(body.get('metadata[hold]')).toBe('h:abc123:11111111-2222-3333-4444-555555555555');
  });

  it('refuse de créer une session sans expires_at plutôt que d’en laisser vivre une 24 h', async () => {
    const fetchSpy = mockStripe();
    const { expiresAt, ...sansExpiration } = ARGS;

    await expect(createCheckoutSession({ STRIPE_SECRET_KEY: 'sk_test_abc' }, sansExpiration))
      .rejects.toThrow(/expires_at/);
    expect(fetchSpy).not.toHaveBeenCalled();
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

// customFieldValue — forme de charge utile Stripe (`[{ key, text: { value } }]`),
// donc testée ici, à côté du reste du protocole.
describe('customFieldValue', () => {
  const session = {
    custom_fields: [
      { key: 'sponsor_name', text: { value: 'Acme' } },
      { key: 'sponsor_domain', text: { value: 'acme.com' } },
    ],
  };

  it('rend la valeur du champ demandé', () => {
    expect(customFieldValue(session, 'sponsor_name')).toBe('Acme');
    expect(customFieldValue(session, 'sponsor_domain')).toBe('acme.com');
  });

  it('rend null plutôt que d’inventer quand le champ ou la session manque', () => {
    expect(customFieldValue(session, 'sponsor_tagline')).toBe(null);
    expect(customFieldValue({}, 'sponsor_name')).toBe(null);
    expect(customFieldValue(undefined, 'sponsor_name')).toBe(null);
    expect(customFieldValue({ custom_fields: [{ key: 'sponsor_name' }] }, 'sponsor_name')).toBe(null);
  });
});
