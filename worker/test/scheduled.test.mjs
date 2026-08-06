import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from 'cloudflare:test';
import MIGRATION_INIT from '../migrations/0001_init.sql?raw';
import MIGRATION_STATS from '../migrations/0003_stats.sql?raw';
import { runScheduled, purgeUniques } from '../src/stats.mjs';
import { dayKey } from '../src/hash.mjs';

// Déviation contrôlée par rapport au brief : `fetchMock` (undici MockAgent)
// n'est pas exporté par `cloudflare:test` dans la version installée
// (@cloudflare/vitest-pool-workers 0.19.0 — vérifié deux fois : son fichier
// worker lib/cloudflare/test.mjs ne réexporte pas fetchMock, seulement SELF,
// env, createExecutionContext, etc.). On simule donc l'appel GraphQL avec
// `vi.spyOn(globalThis, 'fetch')`, comme le fait déjà facade.test.mjs pour la
// sous-requête passthrough : le test s'exécute dans le même isolate workerd
// que le SUT (import direct de `src/stats.mjs`), donc l'identifiant global
// `fetch` résolu par `stats.mjs` au moment de l'appel voit bien le mock posé
// ici.
async function applyMigration(sql) {
  // 0003_stats.sql commence par un bloc de commentaires `--` : la technique
  // naïve (split sur `;` puis aplatissement des retours à la ligne en
  // espaces) fusionnerait ce commentaire avec l'instruction SQL qui suit. On
  // retire donc les lignes de commentaire avant de répéter la même technique
  // (voir stats-beacon.test.mjs / facade.test.mjs).
  const withoutComments = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  for (const stmt of withoutComments.split(';').map((s) => s.trim()).filter(Boolean)) {
    await env.DB.exec(stmt.replace(/\s+/g, ' '));
  }
}

afterEach(() => vi.restoreAllMocks());

beforeEach(async () => {
  for (const table of ['votes', 'rate', 'hits', 'uniques', 'events', 'crawlers']) {
    await env.DB.exec(`DROP TABLE IF EXISTS ${table}`);
  }
  await applyMigration(MIGRATION_INIT);
  await applyMigration(MIGRATION_STATS);
});

function daysAgo(n) {
  return dayKey(new Date(Date.now() - n * 86_400_000));
}

// Pose le mock GraphQL et vérifie au passage la forme de l'appel (URL,
// méthode, en-tête Authorization) — ce que `fetchMock.intercept({ path,
// method })` du brief garantissait par construction, et qu'il faut donc
// vérifier explicitement avec un spy générique sur `fetch`.
function mockGraphql(groups, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer jeton-de-test');
    if (status !== 200) return new Response('boom', { status });
    return new Response(JSON.stringify({
      data: { viewer: { zones: [{ httpRequestsAdaptiveGroups: groups }] } },
    }), { status: 200 });
  });
}

const ENV_WITH_TOKEN = () => ({ DB: env.DB, CF_API_TOKEN: 'jeton-de-test', CF_ZONE_TAG: 'zone123' });

describe('runScheduled — GraphQL', () => {
  it('écrit les volumes de la veille en source cloudflare-api', async () => {
    const fetchSpy = mockGraphql([
      { count: 42, dimensions: { userAgent: 'Mozilla/5.0; compatible; GPTBot/1.2' } },
      { count: 7, dimensions: { userAgent: 'Mozilla/5.0 (compatible; ClaudeBot/1.0)' } },
      { count: 3, dimensions: { userAgent: 'curl/8.0' } }, // non reconnu : ignoré
    ]);
    await runScheduled(ENV_WITH_TOKEN(), new Date());
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const { results } = await env.DB.prepare(
      "SELECT bot, n FROM crawlers WHERE source = 'cloudflare-api' ORDER BY bot"
    ).all();
    expect(results).toEqual([
      { bot: 'claudebot', n: 7 },
      { bot: 'gptbot', n: 42 },
    ]);
    const day = await env.DB.prepare("SELECT day FROM crawlers WHERE bot = 'gptbot'").first();
    expect(day.day).toBe(daysAgo(1)); // la veille, pas aujourd'hui
  });

  it('est idempotent : relancer remplace, ne double pas', async () => {
    const fetchSpy = mockGraphql([{ count: 42, dimensions: { userAgent: 'GPTBot/1.2' } }]);
    const e = ENV_WITH_TOKEN();
    await runScheduled(e, new Date());
    await runScheduled(e, new Date());
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const row = await env.DB.prepare("SELECT n FROM crawlers WHERE bot = 'gptbot'").first();
    expect(row.n).toBe(42);
  });

  it("sans token : pas d'appel réseau, mais la purge tourne", async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('fetch ne doit pas être appelé sans token/zone');
    });
    await env.DB.prepare('INSERT INTO uniques (day, ip_hash) VALUES (?, ?)').bind(daysAgo(60), 'vieux').run();
    await runScheduled({ DB: env.DB }, new Date());
    const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM uniques').first();
    expect(count.c).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("une erreur GraphQL n'empêche pas la purge et ne lève pas", async () => {
    mockGraphql([], 500);
    await env.DB.prepare('INSERT INTO uniques (day, ip_hash) VALUES (?, ?)').bind(daysAgo(60), 'vieux').run();
    await expect(runScheduled(ENV_WITH_TOKEN(), new Date())).resolves.toBeUndefined();
    const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM uniques').first();
    expect(count.c).toBe(0);
  });
});

describe('purgeUniques', () => {
  it('supprime au-delà de 45 jours, garde le récent', async () => {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO uniques (day, ip_hash) VALUES (?, ?)').bind(daysAgo(46), 'vieux'),
      env.DB.prepare('INSERT INTO uniques (day, ip_hash) VALUES (?, ?)').bind(daysAgo(10), 'recent'),
    ]);
    await purgeUniques({ DB: env.DB }, new Date());
    const { results } = await env.DB.prepare('SELECT ip_hash FROM uniques').all();
    expect(results).toEqual([{ ip_hash: 'recent' }]);
  });
});
