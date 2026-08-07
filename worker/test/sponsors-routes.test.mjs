import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import MIGRATION_INIT from '../migrations/0001_init.sql?raw';
import MIGRATION_STATS from '../migrations/0003_stats.sql?raw';
import MIGRATION_SPONSORS from '../migrations/0004_sponsors.sql?raw';
import worker from '../src/index.mjs';
import { hashIp, dayKey } from '../src/hash.mjs';

// Harnais D1 partagé (identique à sponsors-slots.test.mjs) : 0004_sponsors.sql
// porte des commentaires en FIN de ligne (`kind TEXT NOT NULL, -- 'rail' |
// 'tape'`). Filtrer seulement les lignes qui *commencent* par `--` les
// laisserait passer et, une fois les retours à la ligne aplatis en espaces, le
// `--` avalerait le reste du CREATE TABLE. On tronque donc chaque ligne à la
// première occurrence de `--`, où qu'elle soit.
async function applyMigration(sql) {
  const withoutComments = sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');
  for (const stmt of withoutComments.split(';').map((s) => s.trim()).filter(Boolean)) {
    await env.DB.exec(stmt.replace(/\s+/g, ' '));
  }
}

beforeEach(async () => {
  for (const table of ['votes', 'rate', 'hits', 'uniques', 'events', 'crawlers',
                       'sponsor_slots', 'sponsor_orders']) {
    await env.DB.exec(`DROP TABLE IF EXISTS ${table}`);
  }
  await applyMigration(MIGRATION_INIT);
  await applyMigration(MIGRATION_STATS);
  await applyMigration(MIGRATION_SPONSORS);
});

afterEach(() => vi.restoreAllMocks());

/** Requête sur le worker, avec un env enrichi pour les routes qui exigent Stripe. */
async function call(request, overrides = {}) {
  const ctx = createExecutionContext();
  const res = await worker.fetch(request, { ...env, ...overrides }, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

// Les secrets Stripe sont volontairement ABSENTS des bindings de
// vitest.config.mjs : c'est ce qui permet de vérifier qu'une route sponsor
// échoue bruyamment quand ils manquent. Chaque test qui a besoin d'un worker
// correctement configuré les passe explicitement.
const SECRETS = { STRIPE_SECRET_KEY: 'sk_test_abc', STRIPE_WEBHOOK_SECRET: 'whsec_test' };
const ORIGIN = 'https://saasmadefree.com';
const SESSION = { id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' };

function checkoutRequest(body, { origin = ORIGIN, ip = '203.0.113.7' } = {}) {
  return new Request('https://votes.test/api/v1/sponsors/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, 'cf-connecting-ip': ip },
    body: JSON.stringify(body),
  });
}

/** Stub du seul appel réseau sortant du checkout : la création de session Stripe. */
function mockStripe({ status = 200, session = SESSION } = {}) {
  let n = 0;
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    n += 1;
    if (status !== 200) return new Response(JSON.stringify({ error: {} }), { status });
    // Un identifiant distinct par appel : la course à deux acheteurs ne doit
    // pas pouvoir passer par hasard grâce à un identifiant partagé.
    return new Response(JSON.stringify({ ...session, id: `${session.id}_${n}` }), { status: 200 });
  });
}

function stripeBodyOf(fetchSpy, callIndex = 0) {
  const [, init] = fetchSpy.mock.calls[callIndex];
  return new URLSearchParams(init.body);
}

async function slotRow(slot) {
  return env.DB.prepare('SELECT * FROM sponsor_slots WHERE slot = ?').bind(slot).first();
}

// ---------------------------------------------------------------- webhook --

async function sign(payload, secret, timestamp) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function completedEvent(overrides = {}) {
  return {
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        payment_status: 'paid',
        amount_total: 14900,
        currency: 'usd',
        metadata: { slot: 'L1', months: '1' },
        customer_details: { email: 'acheteur@example.com' },
        custom_fields: [
          { key: 'sponsor_name', text: { value: 'Acme' } },
          { key: 'sponsor_domain', text: { value: 'acme.com' } },
          { key: 'sponsor_tagline', text: { value: 'On fait des trucs' } },
        ],
        ...overrides,
      },
    },
  };
}

/** Poste un webhook signé (ou mal signé) et rend la réponse. */
async function postWebhook(payload, { secret = 'whsec_test', skew = 0, header = null } = {}) {
  const t = Math.floor(Date.now() / 1000) + skew;
  const sig = header ?? `t=${t},v1=${await sign(payload, secret, t)}`;
  const request = new Request('https://votes.test/api/v1/sponsors/webhook', {
    method: 'POST',
    headers: sig === false
      ? { 'content-type': 'application/json' }
      : { 'content-type': 'application/json', 'stripe-signature': sig },
    body: payload,
  });
  return call(request, SECRETS);
}

/** Place L1 en réservé au nom d'une session, comme le ferait un checkout. */
async function reserveL1(sessionId = 'cs_test_123') {
  await env.DB.prepare(
    `INSERT INTO sponsor_slots (slot, kind, status, session_id, reserved_until)
     VALUES ('L1', 'rail', 'reserved', ?, ?)`
  ).bind(sessionId, new Date(Date.now() + 600_000).toISOString()).run();
}

// ============================================================== GET /slots ==

describe('GET /api/v1/sponsors/slots', () => {
  it('rend les 28 slots, cacheables 60 s', async () => {
    const res = await call(new Request('https://votes.test/api/v1/sponsors/slots'));

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=60');
    const body = await res.json();
    expect(Object.keys(body)).toHaveLength(28);
    expect(body.L1).toEqual({ status: 'open', priceCents: 14900, currency: 'USD' });
    expect(body.T01.priceCents).toBe(7500);
  });

  it("n'exige aucun secret Stripe : c'est une lecture publique", async () => {
    const res = await call(new Request('https://votes.test/api/v1/sponsors/slots'));
    expect(res.status).toBe(200);
  });
});

// =========================================================== POST /checkout ==

describe('POST /api/v1/sponsors/checkout — configuration', () => {
  it('échoue bruyamment en 500 quand STRIPE_SECRET_KEY manque', async () => {
    const fetchSpy = mockStripe();
    const res = await call(checkoutRequest({ slot: 'L1', months: 1, expectedPriceCents: 14900 }), {
      STRIPE_WEBHOOK_SECRET: 'whsec_test',
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'misconfigured' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('échoue bruyamment en 500 quand STRIPE_WEBHOOK_SECRET manque', async () => {
    const res = await call(checkoutRequest({ slot: 'L1', months: 1, expectedPriceCents: 14900 }), {
      STRIPE_SECRET_KEY: 'sk_test_abc',
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'misconfigured' });
  });

  it('refuse une origine étrangère au site', async () => {
    const fetchSpy = mockStripe();
    const res = await call(
      checkoutRequest({ slot: 'L1', months: 1, expectedPriceCents: 14900 }, { origin: 'https://evil.example' }),
      SECRETS
    );

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('forbidden_origin');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuse une méthode autre que POST', async () => {
    const res = await call(new Request('https://votes.test/api/v1/sponsors/checkout'), SECRETS);
    expect(res.status).toBe(405);
  });
});

describe('POST /api/v1/sponsors/checkout — validation', () => {
  it('refuse un slot inconnu en 400', async () => {
    const fetchSpy = mockStripe();
    const res = await call(checkoutRequest({ slot: 'L9', months: 1, expectedPriceCents: 14900 }), SECRETS);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('unknown_slot');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuse une durée non vendue en 400', async () => {
    const fetchSpy = mockStripe();
    const res = await call(checkoutRequest({ slot: 'L1', months: 2, expectedPriceCents: 29800 }), SECRETS);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('unsold_duration');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuse un corps illisible en 400', async () => {
    const request = new Request('https://votes.test/api/v1/sponsors/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: 'pas du json',
    });
    const res = await call(request, SECRETS);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_json');
  });

  it('refuse un slot déjà vendu en 409, sans toucher à Stripe', async () => {
    const fetchSpy = mockStripe();
    await env.DB.prepare(
      "INSERT INTO sponsor_slots (slot, kind, status) VALUES ('L1', 'rail', 'paid')"
    ).run();

    // L1 payé : le prochain rail vaut un cran de plus, et L1 lui-même est pris.
    const res = await call(checkoutRequest({ slot: 'L1', months: 1, expectedPriceCents: 21900 }), SECRETS);

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('slot_taken');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/sponsors/checkout — le prix ne vient jamais du client', () => {
  it('répond 409 price_changed avec le vrai montant, et ne crée aucune session', async () => {
    const fetchSpy = mockStripe();
    const res = await call(checkoutRequest({ slot: 'L1', months: 1, expectedPriceCents: 100 }), SECRETS);

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'price_changed', priceCents: 14900 });
    expect(fetchSpy).not.toHaveBeenCalled();
    // Aucune session créée : le slot ne doit pas rester réservé au passage.
    expect((await slotRow('L1'))?.status ?? 'open').toBe('open');
  });

  it('facture le prix serveur, pas un montant glissé dans le corps', async () => {
    const fetchSpy = mockStripe();
    const res = await call(checkoutRequest({
      slot: 'L1',
      months: 1,
      expectedPriceCents: 14900,
      // Champs pirates : tous ignorés.
      amountCents: 1,
      priceCents: 1,
      unit_amount: 1,
      currency: 'xof',
    }), SECRETS);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test_123' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const sent = stripeBodyOf(fetchSpy);
    expect(sent.get('line_items[0][price_data][unit_amount]')).toBe('14900');
    expect(sent.get('line_items[0][price_data][currency]')).toBe('usd');
    expect(sent.get('metadata[slot]')).toBe('L1');
    expect(sent.get('metadata[months]')).toBe('1');
  });

  it('facture trois mois au triple, toujours depuis le barème serveur', async () => {
    const fetchSpy = mockStripe();
    const res = await call(checkoutRequest({ slot: 'L1', months: 3, expectedPriceCents: 44700 }), SECRETS);

    expect(res.status).toBe(200);
    expect(stripeBodyOf(fetchSpy).get('line_items[0][price_data][unit_amount]')).toBe('44700');
  });

  it('suit le barème quand un slot du même compartiment est déjà payé', async () => {
    const fetchSpy = mockStripe();
    await env.DB.prepare(
      "INSERT INTO sponsor_slots (slot, kind, status) VALUES ('L1', 'rail', 'paid')"
    ).run();

    // Un rail payé : L2 vaut le deuxième barreau (21900), pas le premier.
    const bad = await call(checkoutRequest({ slot: 'L2', months: 1, expectedPriceCents: 14900 }), SECRETS);
    expect(bad.status).toBe(409);
    expect(await bad.json()).toMatchObject({ error: 'price_changed', priceCents: 21900 });
    expect(fetchSpy).not.toHaveBeenCalled();

    const ok = await call(checkoutRequest({ slot: 'L2', months: 1, expectedPriceCents: 21900 }), SECRETS);
    expect(ok.status).toBe(200);
    expect(stripeBodyOf(fetchSpy).get('line_items[0][price_data][unit_amount]')).toBe('21900');
  });
});

describe('POST /api/v1/sponsors/checkout — réservation', () => {
  it('réserve le slot et y attache la session Stripe', async () => {
    mockStripe();
    const res = await call(checkoutRequest({ slot: 'L1', months: 1, expectedPriceCents: 14900 }), SECRETS);
    expect(res.status).toBe(200);

    const row = await slotRow('L1');
    expect(row.status).toBe('reserved');
    expect(row.session_id).toBe('cs_test_123_1');
    expect(new Date(row.reserved_until).getTime()).toBeGreaterThan(Date.now());
  });

  it('deux acheteurs simultanés sur L1 : un seul aboutit, l’autre reçoit 409 slot_taken', async () => {
    mockStripe();
    const body = { slot: 'L1', months: 1, expectedPriceCents: 14900 };
    const [a, b] = await Promise.all([
      call(checkoutRequest(body, { ip: '203.0.113.7' }), SECRETS),
      call(checkoutRequest(body, { ip: '198.51.100.4' }), SECRETS),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    expect((await loser.json()).error).toBe('slot_taken');

    // Un seul slot réservé, une seule réservation gagnante.
    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM sponsor_slots WHERE status = 'reserved'"
    ).first();
    expect(count.c).toBe(1);
  });

  it('relibère le slot immédiatement si Stripe refuse de créer la session', async () => {
    mockStripe({ status: 402 });
    const res = await call(checkoutRequest({ slot: 'L1', months: 1, expectedPriceCents: 14900 }), SECRETS);

    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('stripe_unavailable');
    const row = await slotRow('L1');
    expect(row.status).toBe('open');
    expect(row.session_id).toBe(null);
    expect(row.reserved_until).toBe(null);
  });
});

describe('POST /api/v1/sponsors/checkout — rate limit', () => {
  it('a son propre seau : saturer le checkout ne bloque pas un vote', async () => {
    mockStripe();
    const now = new Date();
    const day = dayKey(now);
    const ipHash = await hashIp('203.0.113.7', env.VOTE_SALT, day);
    const minute = now.toISOString().slice(0, 16);
    // Seau `s:` saturé, seau des votes intact.
    await env.DB.prepare('INSERT INTO rate (ip_hash, minute, n) VALUES (?, ?, 31)')
      .bind('s:' + ipHash, minute).run();

    const res = await call(checkoutRequest({ slot: 'L1', months: 1, expectedPriceCents: 14900 }), SECRETS);
    expect(res.status).toBe(429);

    const vote = await call(new Request('https://votes.test/api/v1/vote', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7' },
      body: JSON.stringify({ slug: 'obsidian' }),
    }));
    expect(vote.status).toBe(200);
    expect(await vote.json()).toEqual({ count: 1, counted: true });
  });
});

// ============================================================ POST /webhook ==

describe('POST /api/v1/sponsors/webhook — signature', () => {
  it('échoue bruyamment en 500 sans secret de webhook', async () => {
    const payload = JSON.stringify(completedEvent());
    const request = new Request('https://votes.test/api/v1/sponsors/webhook', {
      method: 'POST', body: payload,
    });
    const res = await call(request, { STRIPE_SECRET_KEY: 'sk_test_abc' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'misconfigured' });
  });

  it('refuse un webhook sans signature, et laisse le slot réservé', async () => {
    await reserveL1();
    const res = await postWebhook(JSON.stringify(completedEvent()), { header: false });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('bad_signature');
    expect((await slotRow('L1')).status).toBe('reserved');
    const orders = await env.DB.prepare('SELECT COUNT(*) AS c FROM sponsor_orders').first();
    expect(orders.c).toBe(0);
  });

  it('refuse une signature faite avec un autre secret, et laisse le slot réservé', async () => {
    await reserveL1();
    const res = await postWebhook(JSON.stringify(completedEvent()), { secret: 'whsec_autre' });

    expect(res.status).toBe(400);
    expect((await slotRow('L1')).status).toBe('reserved');
  });

  it('refuse un événement hors tolérance, et laisse le slot réservé', async () => {
    await reserveL1();
    const res = await postWebhook(JSON.stringify(completedEvent()), { skew: -3600 });

    expect(res.status).toBe(400);
    expect((await slotRow('L1')).status).toBe('reserved');
  });

  it('refuse un corps modifié après signature', async () => {
    await reserveL1();
    const payload = JSON.stringify(completedEvent());
    const t = Math.floor(Date.now() / 1000);
    const sig = `t=${t},v1=${await sign(payload, 'whsec_test', t)}`;
    // Même objet JSON, octets différents : la signature ne doit plus valoir.
    const request = new Request('https://votes.test/api/v1/sponsors/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': sig },
      body: payload + ' ',
    });
    const res = await call(request, SECRETS);

    expect(res.status).toBe(400);
    expect((await slotRow('L1')).status).toBe('reserved');
  });
});

describe('POST /api/v1/sponsors/webhook — encaissement', () => {
  it('marque le slot payé et enregistre la commande avec les trois custom_fields', async () => {
    await reserveL1();
    const res = await postWebhook(JSON.stringify(completedEvent()));

    expect(res.status).toBe(200);

    const slot = await slotRow('L1');
    expect(slot.status).toBe('paid');
    expect(slot.session_id).toBe('cs_test_123');
    expect(slot.reserved_until).toBe(null);
    expect(slot.starts_on).toBe(dayKey(new Date()));
    expect(slot.ends_on > slot.starts_on).toBe(true);

    const order = await env.DB.prepare('SELECT * FROM sponsor_orders').first();
    expect(order).toMatchObject({
      session_id: 'cs_test_123',
      slot: 'L1',
      months: 1,
      amount_cents: 14900,
      currency: 'usd',
      email: 'acheteur@example.com',
      name: 'Acme',
      domain: 'acme.com',
      tagline: 'On fait des trucs',
      status: 'paid',
    });
  });

  it('rejoué : une seule commande, un seul slot occupé', async () => {
    await reserveL1();
    const payload = JSON.stringify(completedEvent());

    expect((await postWebhook(payload)).status).toBe(200);
    expect((await postWebhook(payload)).status).toBe(200);
    expect((await postWebhook(payload)).status).toBe(200);

    const orders = await env.DB.prepare('SELECT COUNT(*) AS c FROM sponsor_orders').first();
    expect(orders.c).toBe(1);
    const paid = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM sponsor_slots WHERE status = 'paid'"
    ).first();
    expect(paid.c).toBe(1);
  });

  it('ignore un événement d’un autre type sans rien écrire', async () => {
    await reserveL1();
    const res = await postWebhook(JSON.stringify({ id: 'evt_2', type: 'payment_intent.created', data: { object: {} } }));

    expect(res.status).toBe(200);
    expect((await slotRow('L1')).status).toBe('reserved');
    const orders = await env.DB.prepare('SELECT COUNT(*) AS c FROM sponsor_orders').first();
    expect(orders.c).toBe(0);
  });

  it('ne conclut rien tant que le paiement n’est pas encaissé', async () => {
    await reserveL1();
    const res = await postWebhook(JSON.stringify(completedEvent({ payment_status: 'unpaid' })));

    expect(res.status).toBe(200);
    expect((await slotRow('L1')).status).toBe('reserved');
    const orders = await env.DB.prepare('SELECT COUNT(*) AS c FROM sponsor_orders').first();
    expect(orders.c).toBe(0);
  });

  it('n’écrase pas un slot déjà vendu à quelqu’un d’autre', async () => {
    await env.DB.prepare(
      "INSERT INTO sponsor_slots (slot, kind, status, session_id) VALUES ('L1', 'rail', 'paid', 'cs_autre')"
    ).run();
    const res = await postWebhook(JSON.stringify(completedEvent()));

    // La commande est enregistrée (l'argent est encaissé, il faut une trace),
    // mais le slot reste à son propriétaire : un humain tranche.
    expect(res.status).toBe(200);
    const slot = await slotRow('L1');
    expect(slot.session_id).toBe('cs_autre');
    const order = await env.DB.prepare('SELECT session_id FROM sponsor_orders').first();
    expect(order.session_id).toBe('cs_test_123');
  });
});

// ================================================================= façade ===

describe('façade', () => {
  it('ne détourne pas une page HTML dont l’URL parle de sponsors', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (req) => {
      expect(req.url).toBe('https://saasmadefree.com/en/sponsor/');
      return new Response('<html>page sponsor</html>', {
        headers: { 'content-type': 'text/html' },
      });
    });

    const res = await call(new Request('https://saasmadefree.com/en/sponsor/', {
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/126.0 Safari/537.36' },
    }), SECRETS);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<html>page sponsor</html>');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rend 404 sur un chemin sponsor inconnu, sans toucher aux autres routes', async () => {
    const res = await call(new Request('https://votes.test/api/v1/sponsors/inconnu'), SECRETS);
    expect(res.status).toBe(404);
  });
});
