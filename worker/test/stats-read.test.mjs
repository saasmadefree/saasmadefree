import { describe, it, expect, beforeEach } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import MIGRATION_INIT from '../migrations/0001_init.sql?raw';
import MIGRATION_STATS from '../migrations/0003_stats.sql?raw';
import worker from '../src/index.mjs';
import { dayKey } from '../src/hash.mjs';

async function applyMigration(sql) {
  // 0003_stats.sql commence par un bloc de commentaires `--` (contrat de
  // rétention, spec §7) : contrairement à 0001_init.sql, la technique de
  // vote.test.mjs (split sur `;` puis aplatissement des retours à la ligne
  // en espaces) fusionnerait ce commentaire avec l'instruction SQL qui suit,
  // puisqu'un commentaire `--` s'étend jusqu'à la fin de ligne — or il n'y a
  // plus de fin de ligne une fois les retours à la ligne aplatis. On retire
  // donc les lignes de commentaire avant de répéter la même technique.
  const withoutComments = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  for (const stmt of withoutComments.split(';').map((s) => s.trim()).filter(Boolean)) {
    await env.DB.exec(stmt.replace(/\s+/g, ' '));
  }
}

beforeEach(async () => {
  for (const table of ['votes', 'rate', 'hits', 'uniques', 'events', 'crawlers']) {
    await env.DB.exec(`DROP TABLE IF EXISTS ${table}`);
  }
  await applyMigration(MIGRATION_INIT);
  await applyMigration(MIGRATION_STATS);
});

async function getStats() {
  const ctx = createExecutionContext();
  const res = await worker.fetch(new Request('https://votes.test/api/v1/stats'), env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

function daysAgo(n) {
  return dayKey(new Date(Date.now() - n * 86_400_000));
}

describe('GET /api/v1/stats', () => {
  it('renvoie la forme complète, à zéro, sur base vide', async () => {
    const res = await getStats();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('max-age=60');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const body = await res.json();
    expect(body).toMatchObject({
      today: { views: 0, visitors: 0 },
      peak: null,
      views14d: [],
      visitors7d: 0,
      topPages7d: [],
      copies7d: { total: 0, byAgent: [], topPrompts: [] },
      aiReferrals: { d7: [], d30: [] },
      crawlers7d: [],
      langs7d: [],
      votes: { total: 0, top: [] },
    });
    expect(typeof body.generatedAt).toBe('string');
  });

  it('agrège hits, uniques, events, crawlers et votes', async () => {
    const today = daysAgo(0);
    const stmts = [
      env.DB.prepare('INSERT INTO hits (day, path, lang, n) VALUES (?, ?, ?, ?)').bind(today, '/en/tools/notion', 'en', 7),
      env.DB.prepare('INSERT INTO hits (day, path, lang, n) VALUES (?, ?, ?, ?)').bind(daysAgo(3), '/fr/', 'fr', 5),
      env.DB.prepare('INSERT INTO hits (day, path, lang, n) VALUES (?, ?, ?, ?)').bind(daysAgo(20), '/en/', 'en', 90),
      env.DB.prepare('INSERT INTO uniques (day, ip_hash) VALUES (?, ?)').bind(today, 'h1'),
      env.DB.prepare('INSERT INTO uniques (day, ip_hash) VALUES (?, ?)').bind(daysAgo(2), 'h2'),
      env.DB.prepare('INSERT INTO events (day, kind, subject, n) VALUES (?, ?, ?, ?)').bind(today, 'copy', 'obsidian|clipboard', 3),
      env.DB.prepare('INSERT INTO events (day, kind, subject, n) VALUES (?, ?, ?, ?)').bind(today, 'open_agent', 'obsidian|cursor', 2),
      env.DB.prepare('INSERT INTO events (day, kind, subject, n) VALUES (?, ?, ?, ?)').bind(today, 'ai_referral', 'chatgpt', 4),
      env.DB.prepare('INSERT INTO events (day, kind, subject, n) VALUES (?, ?, ?, ?)').bind(daysAgo(10), 'ai_referral', 'perplexity', 6),
      env.DB.prepare("INSERT INTO crawlers (day, bot, source, n) VALUES (?, 'gptbot', 'edge-worker', 12)").bind(today),
      env.DB.prepare("INSERT INTO crawlers (day, bot, source, n) VALUES (?, 'gptbot', 'cloudflare-api', 15)").bind(today),
      env.DB.prepare("INSERT INTO votes (ip_hash, slug, day) VALUES ('v1', 'obsidian', ?)").bind(today),
      env.DB.prepare("INSERT INTO votes (ip_hash, slug, day) VALUES ('v2', 'obsidian', ?)").bind(today),
    ];
    await env.DB.batch(stmts);

    const body = await (await getStats()).json();
    expect(body.today.views).toBe(7);
    expect(body.today.visitors).toBe(1);
    // Le pic porte sur toute l'histoire, pas seulement 14 jours.
    expect(body.peak).toEqual({ day: daysAgo(20), views: 90 });
    // La fenêtre 14 jours exclut le jour à J-20.
    expect(body.views14d.map((r) => r.views).reduce((a, b) => a + b, 0)).toBe(12);
    expect(body.visitors7d).toBe(2); // somme des uniques quotidiens (visiteurs-jours)
    expect(body.topPages7d[0]).toEqual({ path: '/en/tools/notion', views: 7 });
    expect(body.copies7d.total).toBe(5);
    expect(body.copies7d.byAgent).toEqual(expect.arrayContaining([
      { agent: 'clipboard', n: 3 }, { agent: 'cursor', n: 2 },
    ]));
    expect(body.copies7d.topPrompts).toEqual([{ slug: 'obsidian', n: 5 }]);
    expect(body.aiReferrals.d7).toEqual([{ ai: 'chatgpt', n: 4 }]);
    expect(body.aiReferrals.d30).toEqual(expect.arrayContaining([
      { ai: 'chatgpt', n: 4 }, { ai: 'perplexity', n: 6 },
    ]));
    const gptbot = body.crawlers7d.find((c) => c.bot === 'gptbot');
    expect(gptbot).toMatchObject({ label: 'GPTBot', vendor: 'OpenAI', edge: 12, cf: 15, lastSeen: today });
    expect(body.langs7d).toEqual(expect.arrayContaining([
      { lang: 'en', views: 7 }, { lang: 'fr', views: 5 },
    ]));
    expect(body.votes).toEqual({ total: 2, top: [{ slug: 'obsidian', n: 2 }] });
  });
});
