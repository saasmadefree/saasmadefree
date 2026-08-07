import { describe, it, expect, beforeEach } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import MIGRATION_INIT from '../migrations/0001_init.sql?raw';
import MIGRATION_STATS from '../migrations/0003_stats.sql?raw';
import MIGRATION_SPONSORS from '../migrations/0004_sponsors.sql?raw';
import worker from '../src/index.mjs';
import { ensureSlots, expireSlots, readSlots } from '../src/sponsors.mjs';

// Harnais D1 partagé, repris de sponsors-slots.test.mjs (tâche 2, étape 6) —
// pas du brief, qui n'a pas la correction : 0004_sponsors.sql porte des
// commentaires de fin de ligne sur `kind` et `status` (`kind TEXT NOT NULL,
// -- 'rail' | 'tape'`). Filtrer seulement les lignes qui *commencent* par
// `--` laisserait passer ces commentaires de fin de ligne ; une fois les
// retours à la ligne aplatis en espaces, le `--` avale tout le reste de
// l'instruction CREATE TABLE. On tronque donc chaque ligne à la première
// occurrence de `--`, où qu'elle soit sur la ligne.
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

function daysAgo(n, from = new Date()) {
  return new Date(from.getTime() - n * 86_400_000).toISOString().slice(0, 10);
}

async function payL1(endsOn, startsOn = '2026-01-01') {
  await ensureSlots(env);
  await env.DB.prepare(
    `UPDATE sponsor_slots SET status = 'paid', session_id = 'cs_1', starts_on = ?, ends_on = ?
     WHERE slot = 'L1'`
  ).bind(startsOn, endsOn).run();
}

async function statusOf(slot) {
  return env.DB.prepare('SELECT status, session_id, starts_on, ends_on FROM sponsor_slots WHERE slot = ?')
    .bind(slot).first();
}

describe('expireSlots', () => {
  it('repasse open un slot paid dont ends_on est hier', async () => {
    const today = daysAgo(0);
    await payL1(daysAgo(1));

    const freed = await expireSlots(env, today);

    expect(freed).toBe(1);
    const row = await statusOf('L1');
    expect(row.status).toBe('open');
    expect(row.session_id).toBeNull();
    expect(row.starts_on).toBeNull();
    expect(row.ends_on).toBeNull();
  });

  it('un slot dont ends_on est aujourd’hui reste paid — bornes incluses, comme le site', async () => {
    const today = daysAgo(0);
    await payL1(today);

    const freed = await expireSlots(env, today);

    expect(freed).toBe(0);
    const row = await statusOf('L1');
    expect(row.status).toBe('paid');
  });

  it('libère un slot et fait redescendre le prix des autres du même compartiment', async () => {
    const today = daysAgo(0);
    await payL1(daysAgo(1));

    const before = await readSlots(env, new Date());
    // L1 encore paid à cet instant : L2 est renchéri par l'occupation du
    // compartiment rail.
    const priceBefore = before.L2.priceCents;

    await expireSlots(env, today);

    const after = await readSlots(env, new Date());
    expect(after.L2.priceCents).toBeLessThan(priceBefore);
  });

  it('est idempotent : un second passage ne libère rien de plus', async () => {
    const today = daysAgo(0);
    await payL1(daysAgo(1));

    const first = await expireSlots(env, today);
    const second = await expireSlots(env, today);

    expect(first).toBe(1);
    expect(second).toBe(0);
  });
});

// Contrat fail-quiet du handler `scheduled` (index.mjs) : une panne D1 durant
// l'expiration ne doit ni faire lever `scheduled`, ni empêcher le travail
// crawlers (`runScheduled`, dont la purge de `uniques`) de tourner dans le
// même passage. On force l'échec de `expireSlots` en supprimant la table
// qu'elle interroge — pas de mock, une vraie erreur D1 dans le même isolate
// workerd que le SUT.
describe('scheduled — fail-quiet', () => {
  it("une erreur D1 pendant l'expiration ne fait pas échouer le cron, et le job crawlers tourne quand même", async () => {
    await env.DB.exec('DROP TABLE sponsor_slots');
    const old = daysAgo(60);
    await env.DB.prepare('INSERT INTO uniques (day, ip_hash) VALUES (?, ?)').bind(old, 'vieux').run();

    const ctx = createExecutionContext();
    await expect(worker.scheduled({}, env, ctx)).resolves.toBeUndefined();
    await waitOnExecutionContext(ctx);

    // Preuve que le job crawlers (purgeUniques, appelé par runScheduled) a
    // bien tourné malgré l'échec de l'expiration : la ligne vieille de 60
    // jours a été purgée.
    const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM uniques').first();
    expect(count.c).toBe(0);
  });
});
