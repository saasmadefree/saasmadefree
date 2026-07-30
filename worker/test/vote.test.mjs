import { describe, it, expect, beforeEach } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
// Le brief lit la migration avec `readFileSync` + `node:fs`. Ce test s'exécute
// réellement à l'intérieur de workerd (c'est tout l'intérêt du harnais) : son
// `node:fs` n'expose qu'un `/bundle` virtuel contenant les modules bundlés, pas
// le disque réel (vérifié empiriquement : `readdirSync('.')` n'y liste que le
// worker bundlé). L'import Vite `?raw` a le même effet observable — charger le
// texte SQL de la migration dans le test — mais la lecture a lieu côté Node au
// moment du build, avant l'entrée dans le bac à sable, donc elle fonctionne.
import MIGRATION from '../migrations/0001_init.sql?raw';
import worker from '../src/index.mjs';

async function post(slug, ip = '203.0.113.7') {
  const request = new Request('https://votes.test/api/v1/vote', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify({ slug }),
  });
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

beforeEach(async () => {
  await env.DB.exec('DROP TABLE IF EXISTS votes');
  await env.DB.exec('DROP TABLE IF EXISTS rate');
  for (const stmt of MIGRATION.split(';').map((s) => s.trim()).filter(Boolean)) {
    await env.DB.exec(stmt.replace(/\s+/g, ' '));
  }
});

describe('POST /api/v1/vote', () => {
  it('compte un premier vote', async () => {
    const res = await post('notion');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 1, counted: true });
  });

  it('ne compte pas deux fois la même IP le même jour', async () => {
    await post('notion');
    const res = await post('notion');
    expect(await res.json()).toEqual({ count: 1, counted: false });
  });

  it('compte deux IP différentes séparément', async () => {
    await post('notion', '203.0.113.7');
    const res = await post('notion', '198.51.100.4');
    expect(await res.json()).toEqual({ count: 2, counted: true });
  });

  it('sépare les compteurs par outil', async () => {
    await post('notion');
    const res = await post('calendly');
    expect(await res.json()).toEqual({ count: 1, counted: true });
  });

  it('refuse un slug inconnu', async () => {
    const res = await post('slug-qui-nexiste-pas');
    expect(res.status).toBe(400);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('refuse un corps sans slug', async () => {
    const request = new Request('https://votes.test/api/v1/vote', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7' },
      body: '{}',
    });
    const ctx = createExecutionContext();
    const res = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(400);
  });

  it('renvoie 429 au-delà de trente requêtes par minute', async () => {
    let last;
    for (let i = 0; i < 32; i++) last = await post('notion', '192.0.2.99');
    expect(last.status).toBe(429);
    expect(last.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('expose les en-têtes CORS', async () => {
    const res = await post('notion');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});

describe('GET /api/v1/votes', () => {
  it('renvoie les compteurs par outil', async () => {
    await post('notion', '203.0.113.7');
    await post('notion', '198.51.100.4');
    await post('calendly', '203.0.113.7');
    const ctx = createExecutionContext();
    const res = await worker.fetch(new Request('https://votes.test/api/v1/votes'), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(await res.json()).toEqual({ notion: 2, calendly: 1 });
  });

  it('répond aussi sur l’alias du feed, avec un cache d’une heure', async () => {
    await post('notion', '203.0.113.7');
    const ctx = createExecutionContext();
    const res = await worker.fetch(new Request('https://votes.test/feed/v1/votes.json'), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(await res.json()).toEqual({ notion: 1 });
    expect(res.headers.get('cache-control')).toContain('max-age=3600');
  });
});

describe('méthodes non supportées', () => {
  it('renvoie 405 sur GET /api/v1/vote', async () => {
    const ctx = createExecutionContext();
    const res = await worker.fetch(new Request('https://votes.test/api/v1/vote'), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(405);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});

describe('purge de la table rate', () => {
  it('supprime au passage les lignes de rate plus vieilles que quelques minutes', async () => {
    await env.DB.prepare('INSERT INTO rate (ip_hash, minute, n) VALUES (?, ?, ?)')
      .bind('ip-hash-perime-1', '2000-01-01T00:00', 5).run();
    await env.DB.prepare('INSERT INTO rate (ip_hash, minute, n) VALUES (?, ?, ?)')
      .bind('ip-hash-perime-2', '2000-01-01T00:05', 3).run();

    const res = await post('notion', '203.0.113.50');
    expect(res.status).toBe(200);

    const { results } = await env.DB.prepare('SELECT ip_hash, minute FROM rate').all();
    expect(results.some((r) => r.minute.startsWith('2000-01-01'))).toBe(false);
    // Seule la ligne de la requête courante doit subsister : la purge n'a
    // pas non plus effacé la minute en cours, et le vote a bien été compté.
    expect(results).toHaveLength(1);
  });

  it('ne bloque pas un vote même si les lignes anciennes coexistent avec des lignes récentes', async () => {
    await env.DB.prepare('INSERT INTO rate (ip_hash, minute, n) VALUES (?, ?, ?)')
      .bind('ip-hash-perime-3', '1999-12-31T23:59', 1).run();

    const res = await post('calendly', '203.0.113.51');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 1, counted: true });
  });
});

describe('gestion des erreurs D1', () => {
  it('renvoie 500 avec les en-têtes CORS si un appel D1 non protégé échoue', async () => {
    // La table `rate` est écrite à chaque vote (upsert non protégé par un
    // try/catch, contrairement à la purge). La supprimer force ce point
    // précis à lever, sans passer par un mock : c'est une vraie erreur D1
    // ("no such table"), pas une simulation applicative.
    await env.DB.exec('DROP TABLE rate');
    const res = await post('notion', '203.0.113.60');
    expect(res.status).toBe(500);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});

describe('préflight OPTIONS', () => {
  it('répond 204 sans corps, avec les en-têtes CORS', async () => {
    const request = new Request('https://votes.test/api/v1/vote', { method: 'OPTIONS' });
    const ctx = createExecutionContext();
    const res = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(await res.text()).toBe('');
  });
});
