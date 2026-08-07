import { dayKey, hashIp } from './hash.mjs';
import { SLUGS } from './slugs.generated.mjs';
import { recordBeacon, buildStatsPayload, serveFacade, runScheduled } from './stats.mjs';
import {
  SELLABLE_MONTHS, CHECKOUT_MINUTES, MAX_HOLDS_PER_VISITOR,
  SLOT_ASSIGNED, SLOT_RETRY,
  kindOf, priceCentsFor, paidCounts, ensureSlots, releaseExpiredReservations,
  readSlots, checkoutUrls, holdIdFor, countHolds, reserveSlot, releaseSlot,
  assignPaidSlot, recordOrder,
} from './sponsors.mjs';
import { createCheckoutSession, verifyStripeSignature, customFieldValue } from './stripe.mjs';

const RATE_LIMIT_PER_MINUTE = 30;
const RATE_RETENTION_MINUTES = 2;

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

function json(body, status, env, cacheControl = 'no-store') {
  // Fetch interdit un corps sur les statuts "null body" (101/204/205/304) :
  // le préflight OPTIONS répond en 204, donc il ne doit jamais recevoir de
  // corps sous peine de lever un TypeError à l'exécution dans workerd.
  const responseBody = NULL_BODY_STATUSES.has(status) ? null : JSON.stringify(body);
  return new Response(responseBody, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': env.ALLOWED_ORIGIN ?? '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'cache-control': cacheControl,
    },
  });
}

function minuteKey(date) {
  return date.toISOString().slice(0, 16);
}

// La table `rate` n'a pas de purge native : chaque couple (ip_hash, minute)
// distinct insère une ligne, et rien ne la supprime jamais. Une fois sa
// minute passée, une ligne ne peut plus être relue par le limiteur (qui ne
// consulte que la minute en cours) : elle est purgeable sans risque. On la
// purge ici de façon opportuniste, à chaque vote, avec une seule instruction.
// Best-effort : un échec de purge ne doit jamais empêcher un vote légitime
// d'être comptabilisé, donc on avale toute erreur.
async function pruneRate(env, now) {
  const cutoff = minuteKey(new Date(now.getTime() - RATE_RETENTION_MINUTES * 60_000));
  try {
    await env.DB.prepare('DELETE FROM rate WHERE minute < ?').bind(cutoff).run();
  } catch {
    // Nettoyage best-effort : on ignore volontairement l'échec.
  }
}

async function overRateLimit(env, ipHash, now) {
  await pruneRate(env, now);
  const minute = minuteKey(now);
  const row = await env.DB.prepare(
    `INSERT INTO rate (ip_hash, minute, n) VALUES (?, ?, 1)
     ON CONFLICT(ip_hash, minute) DO UPDATE SET n = n + 1
     RETURNING n`
  ).bind(ipHash, minute).first();
  return (row?.n ?? 0) > RATE_LIMIT_PER_MINUTE;
}

// Les trois échecs métier de sponsors.mjs se traduisent en statuts distincts.
// La correspondance porte sur le CODE, jamais sur le message : celui-ci est
// écrit en français pour un humain et doit pouvoir être reformulé sans rien
// casser. Un code absent de cette table est un bug, pas un cas prévu : il
// remonte au filet global et sort en 500 plutôt que d'être traduit au hasard.
const SPONSOR_ERROR_STATUS = {
  unknown_slot: 400,
  unsold_duration: 400,
  inventory_full: 409,
};

/**
 * POST /api/v1/sponsors/checkout — ouvre une session de paiement.
 *
 * Le corps ne porte que `slot`, `months`, `expectedPriceCents` et `lang`. Tout
 * autre champ est ignoré : le montant facturé est recalculé ici, depuis les
 * barèmes générés et l'état de la base. Un `amountCents` glissé dans le corps
 * ne change donc rien. `lang` ne choisit qu'une page de retour, et seulement
 * parmi les langues du site.
 */
async function handleSponsorCheckout(request, env) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, env);

  // Même patron que VOTE_SALT : un secret absent est une panne, pas une
  // dégradation silencieuse. Encaisser à moitié serait pire que refuser.
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return json({ error: 'misconfigured' }, 500, env);
  }

  // ALLOWED_ORIGIN vaut "*", ce qui convient à une lecture publique mais pas
  // à une route qui déclenche un paiement. Comparaison stricte, donc fermée
  // par défaut : en-tête absent ou SPONSOR_ORIGIN non déployé → refus.
  if (request.headers.get('origin') !== env.SPONSOR_ORIGIN) {
    return json({ error: 'forbidden_origin' }, 403, env);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, env);
  }
  const slot = body?.slot;
  const months = body?.months;
  const expectedPriceCents = body?.expectedPriceCents;
  const lang = body?.lang;

  const now = new Date();
  const ip = request.headers.get('cf-connecting-ip') ?? '0.0.0.0';
  const ipHash = await hashIp(ip, env.VOTE_SALT, dayKey(now));
  // Seau dédié ('s:'), comme le beacon utilise 'b:' : un abus de checkout ne
  // doit jamais consommer le quota de vote d'un visiteur légitime.
  if (await overRateLimit(env, 's:' + ipHash, now)) {
    return json({ error: 'rate_limited' }, 429, env);
  }

  await ensureSlots(env);
  await releaseExpiredReservations(env, now);

  // Plafond de réservations simultanées. Le rate limit à la minute ne protège
  // rien ici : 28 requêtes suffisent à geler tout l'inventaire, soit 3 % du
  // budget d'une seule IP, et rien ne coûte à l'attaquant puisque réserver ne
  // demande ni compte ni paiement. Le comptage vient APRÈS la libération des
  // réservations mortes, sinon un acheteur légitime paierait pour ses propres
  // paniers abandonnés.
  if (await countHolds(env, ipHash) >= MAX_HOLDS_PER_VISITOR) {
    return json({ error: 'too_many_reservations' }, 429, env);
  }

  let priceCents;
  try {
    priceCents = priceCentsFor(slot, months, await paidCounts(env));
  } catch (err) {
    const status = SPONSOR_ERROR_STATUS[err?.code];
    if (!status) throw err;
    return json({ error: err.code }, status, env);
  }

  // `expectedPriceCents` ne facture rien : il sert uniquement à détecter une
  // dérive entre le prix affiché à l'acheteur et le prix du moment (un autre
  // slot vendu entre-temps fait monter le barème). Différent — ou absent —
  // on refuse en rendant le vrai montant, et aucune session n'est créée.
  if (expectedPriceCents !== priceCents) {
    return json({ error: 'price_changed', priceCents, currency: 'USD' }, 409, env);
  }

  // Réserver AVANT de créer la session. L'inverse laisserait une session
  // payable sur un slot que quelqu'un d'autre vient de prendre. L'identifiant
  // de réservation reste dans la ligne jusqu'au paiement : il voyage par les
  // métadonnées Stripe et revient dans le webhook, ce qui évite une seconde
  // écriture juste après la création de la session — et la fenêtre de panne
  // qui va avec.
  const holdId = holdIdFor(ipHash);
  if (!(await reserveSlot(env, slot, holdId, now))) {
    return json({ error: 'slot_taken' }, 409, env);
  }

  let session;
  try {
    session = await createCheckoutSession(env, {
      slot,
      months,
      amountCents: priceCents,
      ...checkoutUrls(env.SPONSOR_ORIGIN, lang),
      // La session doit mourir avant la réservation, jamais après.
      expiresAt: Math.floor(now.getTime() / 1000) + CHECKOUT_MINUTES * 60,
      holdId,
    });
  } catch (err) {
    // Journalisé avant d'être aplati en 502 : sans cette ligne, une clé API
    // révoquée et une panne de Stripe deviennent le même message, et la
    // première est indiagnosticable depuis la réponse.
    console.error('sponsors: création de session Stripe impossible', err);
    // Aucune session créée : le slot ne doit pas rester bloqué le temps d'une
    // réservation entière pour une panne qui n'est pas celle de l'acheteur.
    await releaseSlot(env, slot, holdId);
    return json({ error: 'stripe_unavailable' }, 502, env);
  }

  return json({ url: session.url }, 200, env);
}

/**
 * POST /api/v1/sponsors/webhook — seule preuve de paiement.
 *
 * Jamais la redirection `success_url`, qu'un visiteur peut atteindre à la
 * main sans avoir rien payé.
 */
async function handleSponsorWebhook(request, env) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, env);
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return json({ error: 'misconfigured' }, 500, env);
  }

  // Corps BRUT, avant tout JSON.parse : la signature porte sur les octets
  // exacts reçus, et re-sérialiser un objet parsé ne redonnerait pas la même
  // chaîne — une requête légitime serait rejetée.
  const raw = await request.text();
  const now = new Date();
  const signature = request.headers.get('stripe-signature');
  if (!(await verifyStripeSignature(raw, signature, env.STRIPE_WEBHOOK_SECRET, now))) {
    return json({ error: 'bad_signature' }, 400, env);
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid_json' }, 400, env);
  }

  // Tout autre événement est acquitté en 200 : répondre en erreur ferait
  // re-tenter Stripe en boucle sur un message qu'on ne traitera jamais.
  if (event?.type !== 'checkout.session.completed') {
    return json({ received: true }, 200, env);
  }
  const session = event?.data?.object;
  // « completed » ne veut pas dire encaissé : certains moyens de paiement se
  // règlent en différé. Le slot n'est attribué qu'une fois l'argent reçu.
  if (session?.payment_status !== 'paid') {
    return json({ received: true, pending: true }, 200, env);
  }

  const slot = session.metadata?.slot;
  const months = Number(session.metadata?.months);
  const sessionId = session.id;
  // Métadonnées inexploitables : on refuse bruyamment plutôt que d'écrire une
  // commande fausse. L'événement reste visible en échec dans le tableau de
  // bord Stripe, ce qu'un 200 silencieux ne permettrait pas.
  if (!kindOf(slot) || !SELLABLE_MONTHS.has(months) || typeof sessionId !== 'string') {
    return json({ error: 'invalid_event' }, 400, env);
  }

  // L'identifiant de réservation revient par les métadonnées. Absent (session
  // antérieure au déploiement, métadonnées tronquées), une chaîne vide ne
  // correspond à aucune réservation : seule la branche `open` pourra jouer.
  const holdId = typeof session.metadata?.hold === 'string' ? session.metadata.hold : '';

  // La ligne du slot peut ne pas exister si aucune route ne l'a encore créée.
  await ensureSlots(env);
  // Balayage des réservations mortes AVANT d'attribuer. Sans lui, le webhook
  // dépendrait d'un balayage fait ailleurs — or seuls `GET /slots` et le
  // checkout le font, et rien n'appelle encore `/slots` (c'est la tâche 6).
  // Un paiement arrivé après l'expiration de sa propre réservation resterait
  // alors bloqué en SLOT_RETRY à CHAQUE tentative, pendant les trois jours de
  // relance, jusqu'à ce que Stripe désactive le point de terminaison — et ce
  // ne seraient plus les ventes de cet événement qui seraient perdues, mais
  // toutes les suivantes. Ici, le cas se résout dès la première livraison.
  await releaseExpiredReservations(env, now);
  const verdict = await assignPaidSlot(env, { slot, holdId, sessionId, months, now });

  // L'attribution vient AVANT l'enregistrement parce que c'est elle qui
  // détermine le statut de la commande : l'inverse écrirait un statut avant de
  // savoir s'il est vrai. L'ordre est sûr parce que rien ne se perd si le
  // second appel échoue — Stripe rejoue, `assignPaidSlot` rendra alors
  // SLOT_ASSIGNED (le slot porte déjà cette session) et la commande sera
  // écrite au second passage. La commande est enregistrée dans TOUS les cas,
  // y compris quand le slot n'a pas pu être attribué : l'argent est encaissé,
  // il faut une trace. Son statut dit lequel des deux s'est produit — jamais
  // `paid` par défaut.
  await recordOrder(env, {
    sessionId,
    slot,
    months,
    amountCents: Number(session.amount_total ?? 0),
    currency: session.currency ?? 'usd',
    email: session.customer_details?.email ?? null,
    name: customFieldValue(session, 'sponsor_name'),
    domain: customFieldValue(session, 'sponsor_domain'),
    tagline: customFieldValue(session, 'sponsor_tagline'),
    status: verdict === SLOT_ASSIGNED ? 'paid' : 'unassigned',
    createdAt: now.toISOString(),
  });

  if (verdict === SLOT_RETRY) {
    // Chemin quasi inatteignable depuis que le balayage a lieu juste au-dessus
    // (une réservation morte n'en est plus une au moment de l'attribution). Il
    // reste pour ce que le balayage ne couvre pas : il est best-effort et
    // avale ses erreurs, donc une panne D1 passagère peut laisser la ligne en
    // place. Réessayable est alors la bonne réponse — Stripe retente pendant
    // trois jours, et la tentative suivante passera par la branche `open`.
    return json({ error: 'slot_assignment_deferred' }, 503, env);
  }
  // SLOT_CONFLICT : l'état est cohérent et stable, retenter n'y changerait
  // rien. On acquitte, et la commande `unassigned` attend un humain.
  return json({ received: true }, 200, env);
}

async function countFor(env, slug) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS c FROM votes WHERE slug = ?')
    .bind(slug).first();
  return row?.c ?? 0;
}

async function handle(request, env) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') return json({}, 204, env);

  // Un VOTE_SALT absent ou vide s'interpole dans hashIp comme la chaîne
  // littérale "undefined" (template literal) : rien ne lève, le worker
  // continue à fonctionner, les votes continuent à être comptés — et chaque
  // ip_hash stocké devient cassable par force brute sur tout l'espace IPv4 en
  // s'appuyant sur `day`, déjà présent dans la même ligne. Personne n'est
  // prévenu. On échoue bruyamment ici plutôt que de laisser cette régression
  // silencieuse produire des lignes irréversiblement compromises.
  if (!env.VOTE_SALT) {
    return json({ error: 'misconfigured' }, 500, env);
  }

  // Lecture publique des stats (spec §8) : une seule forme, cacheable 60 s à
  // l'edge — c'est le « refreshed every minute » de la page /stats.
  if (url.pathname === '/api/v1/stats' && request.method === 'GET') {
    return json(await buildStatsPayload(env, new Date()), 200, env, 'public, max-age=60');
  }

  // Beacon d'audience (spec §3) : toujours 204, y compris sur entrée invalide
  // ou erreur D1 — un compteur d'audience n'a pas le droit d'avoir un avis
  // visible. Le rate limiting réutilise la table `rate` des votes.
  if (url.pathname === '/api/v1/stats/beacon') {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, env);
    let body = null;
    try { body = await request.json(); } catch { /* corps illisible : ignoré */ }
    const now = new Date();
    const day = dayKey(now);
    const ip = request.headers.get('cf-connecting-ip') ?? '0.0.0.0';
    const ipHash = await hashIp(ip, env.VOTE_SALT, day);
    // Le try/catch englobe aussi overRateLimit (et donc la purge de `rate`) :
    // le contrat fail-open ("toujours 204") ne souffre aucune exception, y
    // compris si le limiteur lui-même échoue (table `rate` absente, panne
    // D1) — contrairement à la route de vote, où un tel échec peut rester
    // visible en 500.
    try {
      // Le beacon a son propre seau de rate-limit : 30 vues/min ne doivent
      // jamais faire échouer un vote légitime. Même table `rate`, même
      // ip_hash de base (identique au hachage des votes), mais préfixé pour
      // que les deux compteurs (b:<hash> pour le beacon, <hash> pour le vote)
      // restent indépendants. `ipHash` sans préfixe reste inchangé pour
      // `uniques`, qui doit garder l'identité visiteur du schéma de hachage
      // des votes.
      if (!(await overRateLimit(env, 'b:' + ipHash, now))) {
        await recordBeacon(env, body, ipHash, day);
      }
    } catch { /* fail-open */ }
    return json({}, 204, env);
  }

  const isCountsRoute = url.pathname === '/api/v1/votes' || url.pathname === '/feed/v1/votes.json';
  if (isCountsRoute && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT slug, COUNT(*) AS c FROM votes GROUP BY slug'
    ).all();
    const counts = {};
    for (const row of results) counts[row.slug] = row.c;
    return json(counts, 200, env, 'public, max-age=3600');
  }

  // Routes sponsors (spec §10). Chemins comparés en égalité stricte, jamais
  // en préfixe : le worker sert aussi de façade devant les pages HTML du site,
  // et une route d'API n'a pas le droit de happer une page comme /en/sponsor/.
  if (url.pathname === '/api/v1/sponsors/slots') {
    if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, env);
    // Lecture publique, sans secret : c'est ce que la page /sponsor rafraîchit.
    return json(await readSlots(env, new Date()), 200, env, 'public, max-age=60');
  }
  if (url.pathname === '/api/v1/sponsors/checkout') return handleSponsorCheckout(request, env);
  if (url.pathname === '/api/v1/sponsors/webhook') return handleSponsorWebhook(request, env);

  if (url.pathname !== '/api/v1/vote') return json({ error: 'not_found' }, 404, env);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, env);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, env);
  }

  const slug = body?.slug;
  if (typeof slug !== 'string' || !SLUGS.has(slug)) {
    return json({ error: 'unknown_slug' }, 400, env);
  }

  const now = new Date();
  const day = dayKey(now);
  const ip = request.headers.get('cf-connecting-ip') ?? '0.0.0.0';
  const ipHash = await hashIp(ip, env.VOTE_SALT, day);

  if (await overRateLimit(env, ipHash, now)) {
    return json({ error: 'rate_limited', count: await countFor(env, slug), counted: false }, 429, env);
  }

  const inserted = await env.DB.prepare(
    'INSERT OR IGNORE INTO votes (ip_hash, slug, day) VALUES (?, ?, ?) RETURNING slug'
  ).bind(ipHash, slug, day).first();

  return json({ count: await countFor(env, slug), counted: inserted !== null }, 200, env);
}

export default {
  // Filet de sécurité : tout appel D1 non protégé plus haut (l'upsert de
  // `rate`, l'insert de `votes`, les deux `COUNT(*)`) peut lever. Sans ce
  // filet, l'exception traverserait `fetch()` et Cloudflare renverrait sa
  // propre réponse d'erreur par défaut — qui ne passe pas par `json()` et
  // n'a donc aucun en-tête CORS. Le navigateur bloquerait alors la réponse
  // avant même que l'appelant ne voie le code de statut, et un vote valide
  // disparaîtrait sans que personne ne soit prévenu. Le `await` est
  // nécessaire : sans lui, une promesse rejetée serait renvoyée telle
  // quelle au lieu d'être levée, et ce `catch` ne s'exécuterait jamais.
  async fetch(request, env, ctx) {
    try {
      // Les routes zone de l'apex (pages HTML du site) passent par la façade
      // crawlers — avant tout contrôle de configuration : la façade n'utilise
      // ni VOTE_SALT ni la moindre donnée personnelle, et doit servir les
      // pages même si le worker est mal configuré.
      if (new URL(request.url).hostname === 'saasmadefree.com') {
        return await serveFacade(request, env, ctx);
      }
      return await handle(request, env);
    } catch {
      return json({ error: 'internal_error' }, 500, env);
    }
  },

  async scheduled(controller, env, ctx) {
    // Fail-quiet : un cron qui lève serait re-tenté par la plateforme sans
    // que personne ne le voie ; on préfère journaliser l'absence de données.
    try { await runScheduled(env, new Date()); } catch { /* rien */ }
  },
};
