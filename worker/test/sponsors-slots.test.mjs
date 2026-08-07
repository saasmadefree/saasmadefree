import { describe, it, expect, beforeEach } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import MIGRATION_INIT from '../migrations/0001_init.sql?raw';
import MIGRATION_STATS from '../migrations/0003_stats.sql?raw';
import MIGRATION_SPONSORS from '../migrations/0004_sponsors.sql?raw';
import worker from '../src/index.mjs';
import {
  ensureSlots, readSlots, assignPaidSlot, SLOT_ASSIGNED, SLOT_CONFLICT, SLOT_RETRY,
} from '../src/sponsors.mjs';

// Identique à stats-read.test.mjs, avec un complément : 0004_sponsors.sql ne
// se contente pas d'un bloc de commentaires en tête de fichier, il porte
// aussi des commentaires de fin de ligne sur les colonnes `kind` et `status`
// (`kind TEXT NOT NULL, -- 'rail' | 'tape'`). Filtrer seulement les lignes
// qui *commencent* par `--` laisserait passer ces commentaires de fin de
// ligne ; une fois les retours à la ligne aplatis en espaces, le `--` avale
// tout le reste de l'instruction CREATE TABLE. On tronque donc chaque ligne
// à la première occurrence de `--`, où qu'elle soit sur la ligne.
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

/** Requête sur le worker, avec un env enrichi pour les routes qui exigent Stripe. */
async function call(request, overrides = {}) {
  const ctx = createExecutionContext();
  const res = await worker.fetch(request, { ...env, ...overrides }, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

async function countSlots() {
  const row = await env.DB.prepare('SELECT COUNT(*) AS c FROM sponsor_slots').first();
  return row.c;
}

describe('ensureSlots', () => {
  it('crée les 28 lignes manquantes', async () => {
    await ensureSlots(env);
    expect(await countSlots()).toBe(28);
  });

  it('est idempotent : un second appel ne crée aucune ligne de plus', async () => {
    await ensureSlots(env);
    await ensureSlots(env);
    expect(await countSlots()).toBe(28);
  });
});

describe('readSlots', () => {
  it('rend un prix sur un slot libre et aucun prix sur un slot payé', async () => {
    await ensureSlots(env);
    await env.DB.prepare("UPDATE sponsor_slots SET status = 'paid' WHERE slot = 'L1'").run();

    const out = await readSlots(env, new Date());

    expect(out.L2.status).toBe('open');
    expect(typeof out.L2.priceCents).toBe('number');
    expect(out.L1.status).toBe('paid');
    expect(out.L1.priceCents).toBeUndefined();
  });

  it('repasse open une réservation dont reserved_until est dans le passé', async () => {
    await ensureSlots(env);
    const past = new Date(Date.now() - 60_000).toISOString();
    await env.DB.prepare(
      "UPDATE sponsor_slots SET status = 'reserved', session_id = 'sess_1', reserved_until = ? WHERE slot = 'L1'"
    ).bind(past).run();

    const out = await readSlots(env, new Date());

    expect(out.L1.status).toBe('open');
    expect(typeof out.L1.priceCents).toBe('number');
  });

  it('un slot payé fait monter le prix des autres slots du même compartiment, mais pas ceux de l’autre bandeau', async () => {
    await ensureSlots(env);
    await env.DB.prepare("UPDATE sponsor_slots SET status = 'paid' WHERE slot = 'T01'").run();

    const out = await readSlots(env, new Date());

    // T02 est dans le même compartiment (top) que T01 payé : son prix monte.
    expect(out.T02.priceCents).toBeGreaterThan(7500);
    // B01 est dans l'autre bandeau (bottom) : le prix reste au plancher.
    expect(out.B01.priceCents).toBe(7500);
  });

  it('repasse open une réservation sans échéance — sinon elle bloquerait à jamais', async () => {
    // Inatteignable aujourd'hui (reserveSlot pose toujours une échéance), mais
    // une comparaison SQL avec NULL n'est jamais vraie : sans garde explicite,
    // une telle ligne — import, reprise manuelle — ne serait plus jamais
    // libérée par personne.
    await ensureSlots(env);
    await env.DB.prepare(
      "UPDATE sponsor_slots SET status = 'reserved', session_id = 'h:abc:1', reserved_until = NULL WHERE slot = 'L1'"
    ).run();

    const out = await readSlots(env, new Date());

    expect(out.L1.status).toBe('open');
  });

  it('un slot réservé ne fait pas monter le prix', async () => {
    await ensureSlots(env);
    await env.DB.prepare(
      "UPDATE sponsor_slots SET status = 'reserved', session_id = 'sess_2', reserved_until = ? WHERE slot = 'T01'"
    ).bind(new Date(Date.now() + 60_000).toISOString()).run();

    const out = await readSlots(env, new Date());

    expect(out.T02.priceCents).toBe(7500);
  });
});

// assignPaidSlot — testé directement, parce que le verdict SLOT_RETRY n'est
// plus atteignable par la route depuis que le webhook balaie lui-même les
// réservations mortes (constat N1). Il subsiste pour ce que le balayage ne
// couvre pas : celui-ci est best-effort et avale ses erreurs, donc une panne
// D1 passagère peut laisser une ligne morte en place. La branche doit rester
// vérifiée là où elle est atteignable.
describe('assignPaidSlot', () => {
  const now = new Date();
  const HOLD = 'h:abcdef:11111111-1111-1111-1111-111111111111';
  const AUTRE = 'h:999999:22222222-2222-2222-2222-222222222222';

  async function seed(sql, ...binds) {
    await ensureSlots(env);
    await env.DB.prepare(sql).bind(...binds).run();
  }

  it('attribue quand le slot est tenu par cette réservation', async () => {
    await seed(
      "UPDATE sponsor_slots SET status = 'reserved', session_id = ?, reserved_until = ? WHERE slot = 'L1'",
      HOLD, new Date(Date.now() + 600_000).toISOString()
    );
    const verdict = await assignPaidSlot(env, { slot: 'L1', holdId: HOLD, sessionId: 'cs_1', months: 1, now });
    expect(verdict).toBe(SLOT_ASSIGNED);
  });

  it('attribue au rejeu d’un événement déjà honoré', async () => {
    await seed("UPDATE sponsor_slots SET status = 'paid', session_id = 'cs_1' WHERE slot = 'L1'");
    const verdict = await assignPaidSlot(env, { slot: 'L1', holdId: HOLD, sessionId: 'cs_1', months: 1, now });
    expect(verdict).toBe(SLOT_ASSIGNED);
  });

  it('conflit quand un autre le détient valablement', async () => {
    await seed("UPDATE sponsor_slots SET status = 'paid', session_id = 'cs_autre' WHERE slot = 'L1'");
    expect(await assignPaidSlot(env, { slot: 'L1', holdId: HOLD, sessionId: 'cs_1', months: 1, now }))
      .toBe(SLOT_CONFLICT);

    await seed(
      "UPDATE sponsor_slots SET status = 'reserved', session_id = ?, reserved_until = ? WHERE slot = 'L2'",
      AUTRE, new Date(Date.now() + 600_000).toISOString()
    );
    expect(await assignPaidSlot(env, { slot: 'L2', holdId: HOLD, sessionId: 'cs_1', months: 1, now }))
      .toBe(SLOT_CONFLICT);
  });

  it('réessayable quand une réservation morte n’a pas été balayée', async () => {
    await seed(
      "UPDATE sponsor_slots SET status = 'reserved', session_id = ?, reserved_until = ? WHERE slot = 'L1'",
      AUTRE, new Date(Date.now() - 60_000).toISOString()
    );
    expect(await assignPaidSlot(env, { slot: 'L1', holdId: HOLD, sessionId: 'cs_1', months: 1, now }))
      .toBe(SLOT_RETRY);
  });
});
