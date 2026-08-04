import { describe, it, expect, beforeEach } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
// Même technique que vote.test.mjs : l'import Vite `?raw` charge le SQL côté
// Node avant l'entrée dans workerd, où node:fs ne voit pas le disque réel.
import MIGRATION_INIT from '../migrations/0001_init.sql?raw';
import MIGRATION_STATS from '../migrations/0003_stats.sql?raw';
import worker from '../src/index.mjs';

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

async function beacon(body, ip = '203.0.113.7') {
  const request = new Request('https://votes.test/api/v1/stats/beacon', {
    method: 'POST',
    // Pas d'en-tête content-type : navigator.sendBeacon(url, string) envoie
    // text/plain — le worker doit parser le JSON quand même.
    headers: { 'cf-connecting-ip': ip },
    body: JSON.stringify(body),
  });
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

beforeEach(async () => {
  for (const table of ['votes', 'rate', 'hits', 'uniques', 'events', 'crawlers']) {
    await env.DB.exec(`DROP TABLE IF EXISTS ${table}`);
  }
  await applyMigration(MIGRATION_INIT);
  await applyMigration(MIGRATION_STATS);
});

describe('POST /api/v1/stats/beacon — view', () => {
  it('répond 204 avec CORS et enregistre hit + unique', async () => {
    const res = await beacon({ type: 'view', path: '/en/tools/notion', lang: 'en', ref: 'none' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const hit = await env.DB.prepare('SELECT * FROM hits').first();
    expect(hit).toMatchObject({ path: '/en/tools/notion', lang: 'en', n: 1 });
    const uniq = await env.DB.prepare('SELECT COUNT(*) AS c FROM uniques').first();
    expect(uniq.c).toBe(1);
  });

  it('incrémente n pour la même page, sans doubler le visiteur', async () => {
    await beacon({ type: 'view', path: '/en/', lang: 'en', ref: 'none' });
    await beacon({ type: 'view', path: '/en/', lang: 'en', ref: 'none' });
    const hit = await env.DB.prepare('SELECT n FROM hits').first();
    expect(hit.n).toBe(2);
    const uniq = await env.DB.prepare('SELECT COUNT(*) AS c FROM uniques').first();
    expect(uniq.c).toBe(1);
  });

  it("enregistre une provenance IA en ai_referral", async () => {
    await beacon({ type: 'view', path: '/fr/', lang: 'fr', ref: 'chatgpt' });
    const ev = await env.DB.prepare('SELECT * FROM events').first();
    expect(ev).toMatchObject({ kind: 'ai_referral', subject: 'chatgpt', n: 1 });
  });

  it("enregistre une provenance non-IA en referral", async () => {
    await beacon({ type: 'view', path: '/fr/', lang: 'fr', ref: 'google' });
    const ev = await env.DB.prepare('SELECT * FROM events').first();
    expect(ev).toMatchObject({ kind: 'referral', subject: 'google' });
  });

  it("n'enregistre aucun événement pour ref none", async () => {
    await beacon({ type: 'view', path: '/fr/', lang: 'fr', ref: 'none' });
    const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM events').first();
    expect(count.c).toBe(0);
  });
});

describe('POST /api/v1/stats/beacon — copy / open_agent', () => {
  it('enregistre une copie sous slug|agent', async () => {
    await beacon({ type: 'copy', slug: 'obsidian', agent: 'clipboard' });
    const ev = await env.DB.prepare('SELECT * FROM events').first();
    expect(ev).toMatchObject({ kind: 'copy', subject: 'obsidian|clipboard', n: 1 });
  });

  it('enregistre une ouverture agent', async () => {
    await beacon({ type: 'open_agent', slug: 'obsidian', agent: 'cursor' });
    const ev = await env.DB.prepare('SELECT * FROM events').first();
    expect(ev).toMatchObject({ kind: 'open_agent', subject: 'obsidian|cursor' });
  });
});

describe('POST /api/v1/stats/beacon — rejets silencieux', () => {
  const invalides = [
    ['type inconnu', { type: 'pageview', path: '/en/', lang: 'en', ref: 'none' }],
    ['langue inconnue', { type: 'view', path: '/xx/', lang: 'xx', ref: 'none' }],
    ['ref hors liste', { type: 'view', path: '/en/', lang: 'en', ref: 'https://evil.example' }],
    ['path non conforme', { type: 'view', path: 'javascript:alert(1)', lang: 'en', ref: 'none' }],
    ['slug inconnu', { type: 'copy', slug: 'pas-un-outil', agent: 'clipboard' }],
    ['agent inconnu', { type: 'copy', slug: 'obsidian', agent: 'winrar' }],
    ['corps non-objet', 'quarante-deux'],
  ];
  for (const [nom, body] of invalides) {
    it(`ignore ${nom} : 204, zéro écriture`, async () => {
      const res = await beacon(body);
      expect(res.status).toBe(204);
      for (const table of ['hits', 'uniques', 'events']) {
        const row = await env.DB.prepare(`SELECT COUNT(*) AS c FROM ${table}`).first();
        expect(row.c, table).toBe(0);
      }
    });
  }

  it('ignore un JSON invalide sans lever', async () => {
    const request = new Request('https://votes.test/api/v1/stats/beacon', {
      method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.7' }, body: '{pas du json',
    });
    const ctx = createExecutionContext();
    const res = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(204);
  });
});

describe('POST /api/v1/stats/beacon — rate limit', () => {
  it("cesse d'écrire au-delà de trente requêtes par minute, sans changer la réponse", async () => {
    for (let i = 0; i < 35; i++) {
      const res = await beacon({ type: 'view', path: '/en/', lang: 'en', ref: 'none' }, '192.0.2.50');
      expect(res.status).toBe(204);
    }
    const hit = await env.DB.prepare('SELECT n FROM hits').first();
    expect(hit.n).toBeLessThanOrEqual(30);
  });
});

describe('POST /api/v1/stats/beacon — gestion des erreurs D1', () => {
  it('répond quand même 204 avec CORS si le limiteur de débit échoue (table rate absente)', async () => {
    // Même principe que vote.test.mjs ("gestion des erreurs D1") : on
    // supprime la table `rate`, utilisée par overRateLimit avant même
    // d'atteindre recordBeacon, pour forcer une vraie erreur D1 (pas une
    // simulation). Le contrat fail-open du beacon ne tolère aucune
    // exception, contrairement à la route de vote.
    await env.DB.exec('DROP TABLE rate');
    const res = await beacon({ type: 'view', path: '/en/', lang: 'en', ref: 'none' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
