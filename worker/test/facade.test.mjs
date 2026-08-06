import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import MIGRATION_INIT from '../migrations/0001_init.sql?raw';
import MIGRATION_STATS from '../migrations/0003_stats.sql?raw';
import worker from '../src/index.mjs';

// Déviation contrôlée par rapport au brief : `fetchMock` (undici MockAgent)
// n'est pas exporté par `cloudflare:test` dans la version installée
// (@cloudflare/vitest-pool-workers 0.19.0 — vérifié : son fichier worker
// lib/cloudflare/test.mjs ne réexporte pas fetchMock, seulement SELF, env,
// createExecutionContext, etc.). On simule donc la sous-requête passthrough
// avec `vi.spyOn(globalThis, 'fetch')` : le test s'exécute dans le même
// isolate workerd que le SUT (import direct de `worker/src/index.mjs`, pas
// via SELF), donc l'identifiant global `fetch` résolu par `stats.mjs` au
// moment de l'appel voit bien le mock posé ici.
async function applyMigration(sql) {
  // 0003_stats.sql commence par un bloc de commentaires `--` (contrat de
  // rétention, spec §7) : contrairement à 0001_init.sql, la technique naïve
  // (split sur `;` puis aplatissement des retours à la ligne en espaces)
  // fusionnerait ce commentaire avec l'instruction SQL qui suit, puisqu'un
  // commentaire `--` s'étend jusqu'à la fin de ligne — or il n'y a plus de
  // fin de ligne une fois les retours à la ligne aplatis. On retire donc les
  // lignes de commentaire avant de répéter la même technique (voir
  // stats-beacon.test.mjs).
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

async function hitPage(ua, { path = '/en/tools/notion', body = '<html>page</html>', testEnv = env } = {}) {
  // La façade doit faire un passthrough exact : on vérifie que fetch() reçoit
  // bien la même requête (même URL), pas seulement qu'un 200 quelconque
  // ressort — sinon un test verrait passer une implémentation qui ignorerait
  // `request` et appellerait fetch() sur une URL en dur.
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (req) => {
    if (req.url !== `https://saasmadefree.com${path}`) {
      throw new Error(`fetch appelé avec une URL inattendue : ${req.url}`);
    }
    return new Response(body);
  });
  const request = new Request(`https://saasmadefree.com${path}`, {
    headers: ua ? { 'user-agent': ua } : {},
  });
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, testEnv, ctx);
  await waitOnExecutionContext(ctx);
  return { response, fetchSpy };
}

describe('façade saasmadefree.com', () => {
  it('sert la page, passe la requête telle quelle à fetch(), et compte un crawler IA', async () => {
    const { response: res, fetchSpy } = await hitPage('Mozilla/5.0; compatible; GPTBot/1.2; +https://openai.com/gptbot');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<html>page</html>');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const row = await env.DB.prepare('SELECT * FROM crawlers').first();
    expect(row).toMatchObject({ bot: 'gptbot', source: 'edge-worker', n: 1 });
  });

  it('incrémente au second passage du même bot', async () => {
    await hitPage('GPTBot/1.2');
    await hitPage('GPTBot/1.2');
    const row = await env.DB.prepare('SELECT n FROM crawlers').first();
    expect(row.n).toBe(2);
  });

  it("sert la page sans écrire pour un navigateur humain", async () => {
    const { response: res } = await hitPage('Mozilla/5.0 (Macintosh) Chrome/126.0 Safari/537.36');
    expect(res.status).toBe(200);
    const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM crawlers').first();
    expect(count.c).toBe(0);
  });

  it('fail-open : sert la page même si la table crawlers a disparu', async () => {
    await env.DB.exec('DROP TABLE crawlers');
    const { response: res } = await hitPage('GPTBot/1.2');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<html>page</html>');
  });

  it('fail-open : sert la page même sans VOTE_SALT', async () => {
    // Un env sans sel : la façade ne doit pas passer par le contrôle VOTE_SALT.
    const { response: res } = await hitPage('ClaudeBot/1.0', {
      path: '/fr/',
      body: 'ok',
      testEnv: { DB: env.DB, ALLOWED_ORIGIN: '*' },
    });
    expect(res.status).toBe(200);
  });
});
