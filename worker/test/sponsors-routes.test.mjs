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
// Identifiant de réservation de la forme produite par `holdIdFor` : `h:<hash>:<uuid>`.
const HOLD = 'h:0123456789abcdef:11111111-2222-3333-4444-555555555555';

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
        metadata: { slot: 'L1', months: '1', hold: HOLD },
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

/** Place L1 en réservé au nom d'une réservation, comme le ferait un checkout. */
async function reserveL1(holdId = HOLD, { expiredSince = null } = {}) {
  const until = expiredSince
    ? new Date(Date.now() - expiredSince).toISOString()
    : new Date(Date.now() + 600_000).toISOString();
  await env.DB.prepare(
    `INSERT INTO sponsor_slots (slot, kind, status, session_id, reserved_until)
     VALUES ('L1', 'rail', 'reserved', ?, ?)`
  ).bind(holdId, until).run();
}

async function orderRow(sessionId = 'cs_test_123') {
  return env.DB.prepare('SELECT * FROM sponsor_orders WHERE session_id = ?').bind(sessionId).first();
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
  it('réserve le slot sous un identifiant de réservation qui voyage par Stripe', async () => {
    const fetchSpy = mockStripe();
    const res = await call(checkoutRequest({ slot: 'L1', months: 1, expectedPriceCents: 14900 }), SECRETS);
    expect(res.status).toBe(200);

    const row = await slotRow('L1');
    expect(row.status).toBe('reserved');
    expect(row.session_id).toMatch(/^h:[0-9a-f]{64}:/);
    expect(new Date(row.reserved_until).getTime()).toBeGreaterThan(Date.now());

    // Le même identifiant part dans les métadonnées : c'est lui qui reviendra
    // dans le webhook désigner la réservation à honorer.
    expect(stripeBodyOf(fetchSpy).get('metadata[hold]')).toBe(row.session_id);
  });

  it('demande à Stripe une session qui expire avant la réservation', async () => {
    const fetchSpy = mockStripe();
    const before = Date.now();
    await call(checkoutRequest({ slot: 'L1', months: 1, expectedPriceCents: 14900 }), SECRETS);

    const expiresAt = Number(stripeBodyOf(fetchSpy).get('expires_at'));
    // Plancher de Stripe : au moins 30 minutes après la création, sinon l'API
    // refuse la session. On demande donc un peu plus.
    expect(expiresAt).toBeGreaterThan(Math.floor(before / 1000) + 30 * 60);

    // Et surtout : la session doit mourir AVANT la réservation, jamais après.
    const reservedUntil = new Date((await slotRow('L1')).reserved_until).getTime() / 1000;
    expect(expiresAt).toBeLessThan(reservedUntil);
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

  it('relibère le slot immédiatement si Stripe refuse de créer la session, et journalise la cause', async () => {
    mockStripe({ status: 402 });
    // Le 502 aplatit toutes les pannes Stripe en un seul message : sans cette
    // trace, une clé API révoquée serait indiscernable d'une panne de Stripe.
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await call(checkoutRequest({ slot: 'L1', months: 1, expectedPriceCents: 14900 }), SECRETS);

    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('stripe_unavailable');
    const row = await slotRow('L1');
    expect(row.status).toBe('open');
    expect(row.session_id).toBe(null);
    expect(row.reserved_until).toBe(null);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [message, err] = logSpy.mock.calls[0];
    expect(message).toContain('Stripe');
    expect(String(err?.message ?? err)).toContain('402');
  });
});

describe('POST /api/v1/sponsors/checkout — page de retour', () => {
  it('renvoie l’acheteur vers la page qui existe dans SA langue', async () => {
    const fetchSpy = mockStripe();
    await call(checkoutRequest({ slot: 'L1', months: 1, expectedPriceCents: 14900, lang: 'fr' }), SECRETS);

    const sent = stripeBodyOf(fetchSpy);
    expect(sent.get('success_url')).toBe('https://saasmadefree.com/fr/sponsor?paid=1');
    expect(sent.get('cancel_url')).toBe('https://saasmadefree.com/fr/sponsor');
  });

  it('retombe sur l’anglais plutôt que de fabriquer une URL morte', async () => {
    const fetchSpy = mockStripe();
    // Langue absente, inconnue, ou franchement hostile : jamais de destination
    // choisie par l'appelant, jamais de page inexistante.
    for (const lang of [undefined, 'xx', '../../evil', 'https://evil.example', 42]) {
      await env.DB.prepare("UPDATE sponsor_slots SET status = 'open', session_id = NULL, reserved_until = NULL").run();
      fetchSpy.mockClear();
      await call(checkoutRequest({ slot: 'L1', months: 1, expectedPriceCents: 14900, lang }), SECRETS);

      const sent = stripeBodyOf(fetchSpy);
      expect(sent.get('success_url')).toBe('https://saasmadefree.com/en/sponsor?paid=1');
      expect(sent.get('cancel_url')).toBe('https://saasmadefree.com/en/sponsor');
    }
  });
});

describe('POST /api/v1/sponsors/checkout — plafond de réservations', () => {
  const body = (slot) => ({ slot, months: 1, expectedPriceCents: slot.startsWith('L') || slot.startsWith('R') ? 14900 : 7500 });

  it('refuse une troisième réservation simultanée du même visiteur', async () => {
    mockStripe();
    expect((await call(checkoutRequest(body('L1')), SECRETS)).status).toBe(200);
    expect((await call(checkoutRequest(body('L2')), SECRETS)).status).toBe(200);

    const res = await call(checkoutRequest(body('L3')), SECRETS);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('too_many_reservations');
    // Le troisième slot n'a pas été touché : le refus arrive avant la réservation.
    expect((await slotRow('L3')).status).toBe('open');
  });

  it('ne pénalise pas un autre visiteur', async () => {
    mockStripe();
    await call(checkoutRequest(body('L1'), { ip: '203.0.113.7' }), SECRETS);
    await call(checkoutRequest(body('L2'), { ip: '203.0.113.7' }), SECRETS);

    const res = await call(checkoutRequest(body('L3'), { ip: '198.51.100.4' }), SECRETS);
    expect(res.status).toBe(200);
  });

  it('ne compte pas les réservations mortes contre un acheteur légitime', async () => {
    mockStripe();
    await call(checkoutRequest(body('L1')), SECRETS);
    await call(checkoutRequest(body('L2')), SECRETS);
    // Les deux paniers sont abandonnés : leur échéance est passée.
    await env.DB.prepare(
      "UPDATE sponsor_slots SET reserved_until = ? WHERE status = 'reserved'"
    ).bind(new Date(Date.now() - 60_000).toISOString()).run();

    const res = await call(checkoutRequest(body('L3')), SECRETS);
    expect(res.status).toBe(200);
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

  it('n’écrase pas un slot déjà vendu à quelqu’un d’autre, et ne fait pas passer la commande pour honorée', async () => {
    await env.DB.prepare(
      "INSERT INTO sponsor_slots (slot, kind, status, session_id) VALUES ('L1', 'rail', 'paid', 'cs_autre')"
    ).run();
    const res = await postWebhook(JSON.stringify(completedEvent()));

    // L'argent est encaissé : il faut une trace. Mais le slot reste à son
    // propriétaire, et la commande ne ment pas sur ce qui s'est passé —
    // sinon rien ne distinguerait ce cas d'une vente honorée.
    expect(res.status).toBe(200);
    expect((await slotRow('L1')).session_id).toBe('cs_autre');
    expect(await orderRow()).toMatchObject({ session_id: 'cs_test_123', status: 'unassigned' });
  });

  it('refuse aussi un slot réservé par quelqu’un d’autre, réservation encore vivante', async () => {
    await reserveL1('h:unautrevisiteur:99999999-9999-9999-9999-999999999999');
    const res = await postWebhook(JSON.stringify(completedEvent()));

    // Réservation vivante : retenter ne la libérerait pas. On acquitte, et un
    // humain tranche sur la commande `unassigned`.
    expect(res.status).toBe(200);
    expect((await slotRow('L1')).status).toBe('reserved');
    expect((await orderRow()).status).toBe('unassigned');
  });

  it('réessayable quand aucune réservation vivante ne bloque : ça se répare tout seul', async () => {
    // Réservation d'un autre visiteur, déjà échue mais pas encore balayée —
    // exactement ce que produit une session Stripe qui survit à sa
    // réservation. Personne ne détient plus le slot, donc l'attribution n'est
    // pas perdue : elle est reportée.
    await reserveL1('h:unautrevisiteur:99999999-9999-9999-9999-999999999999', { expiredSince: 60_000 });

    const deferred = await postWebhook(JSON.stringify(completedEvent()));
    expect(deferred.status).toBe(503);
    expect((await deferred.json()).error).toBe('slot_assignment_deferred');
    // La commande existe déjà, marquée non honorée : l'argent n'est jamais
    // encaissé sans trace, même quand l'attribution est reportée.
    expect((await orderRow()).status).toBe('unassigned');

    // Stripe retente ; entre-temps la réservation morte a été balayée.
    await env.DB.prepare(
      "UPDATE sponsor_slots SET status = 'open', session_id = NULL, reserved_until = NULL WHERE slot = 'L1'"
    ).run();
    const retry = await postWebhook(JSON.stringify(completedEvent()));

    expect(retry.status).toBe(200);
    expect((await slotRow('L1')).status).toBe('paid');
    // Et la commande est corrigée : `unassigned` ne doit pas rester à vie.
    expect((await orderRow()).status).toBe('paid');
    const orders = await env.DB.prepare('SELECT COUNT(*) AS c FROM sponsor_orders').first();
    expect(orders.c).toBe(1);
  });

  it('honore un paiement dont la réservation avait expiré, si personne ne l’a repris', async () => {
    // Le cas nominal du décalage session/réservation : la réservation a été
    // balayée, le slot est libre, l'acheteur qui a payé le récupère.
    await env.DB.prepare(
      "INSERT INTO sponsor_slots (slot, kind, status) VALUES ('L1', 'rail', 'open')"
    ).run();
    const res = await postWebhook(JSON.stringify(completedEvent()));

    expect(res.status).toBe(200);
    expect((await slotRow('L1')).status).toBe('paid');
    expect((await orderRow()).status).toBe('paid');
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
