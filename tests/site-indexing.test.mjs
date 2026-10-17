import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import {
  readDist, sitemapIndexProblems, noindexInSitemaps, sitemapUrlProblems, canonicalProblems,
  hreflangProblems, brokenInternalLinks,
} from '../scripts/lib/dist-audit.mjs';
import { buildSitemaps } from '../scripts/lib/site-seo.mjs';

const O = 'https://saasmadefree.com';

// ---------------------------------------------------------------------------
// 1. Les contrôles eux-mêmes, sur un faux dist/ construit ici avec des défauts
//    connus : chaque contrôle doit trouver le sien, et rien d'autre.
// ---------------------------------------------------------------------------
function page({ lang = 'en', path, robots = null, canonical = path, hreflang = [], body = '' }) {
  const links = hreflang.map(([l, p]) => `<link rel="alternate" hreflang="${l}" href="${O}${p}">`).join('\n');
  return `<!doctype html><html lang="${lang}"><head>
${robots ? `<meta name="robots" content="${robots}">` : ''}
${canonical ? `<link rel="canonical" href="${O}${canonical}">` : ''}
${links}
</head><body>${body}</body></html>`;
}

describe('dist-audit — sur un dist/ de fixtures', () => {
  let dir;
  let dist;
  const write = (rel, text) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  };

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'smf-dist-'));
    // Collection : en indexable, fr noindex (moins de 3 éléments).
    write('en/collections/self-hosted.html', page({
      path: '/en/collections/self-hosted',
      hreflang: [['en', '/en/collections/self-hosted'], ['x-default', '/en/collections/self-hosted']],
      body: '<a href="/fr/collections/self-hosted">FR</a><a href="/en/tools/mailchimp">ok</a><img src="/icon.png">',
    }));
    write('fr/collections/self-hosted.html', page({ lang: 'fr', path: '/fr/collections/self-hosted', robots: 'noindex,follow' }));
    // Fiche en + fr, symétrique.
    const toolAlt = [['en', '/en/tools/mailchimp'], ['fr', '/fr/tools/mailchimp'], ['x-default', '/en/tools/mailchimp']];
    write('en/tools/mailchimp.html', page({ path: '/en/tools/mailchimp', hreflang: toolAlt }));
    write('fr/tools/mailchimp.html', page({ lang: 'fr', path: '/fr/tools/mailchimp', hreflang: toolAlt }));
    write('icon.png', 'x');
    write('robots.txt', `Sitemap: ${O}/sitemap-index.xml\n`);
    const { files, index } = buildSitemaps([
      { kind: 'tools', path: '/en/tools/mailchimp', lastmod: '2026-10-01' },
      { kind: 'tools', path: '/fr/tools/mailchimp', lastmod: '2026-10-01' },
      { kind: 'lists', path: '/en/collections/self-hosted' },
    ]);
    for (const f of files) write(f.name, f.xml);
    write('sitemap-index.xml', index);
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('un dist/ conforme ne lève aucun problème', () => {
    dist = readDist(dir);
    for (const check of [sitemapIndexProblems, noindexInSitemaps, sitemapUrlProblems, canonicalProblems, hreflangProblems, brokenInternalLinks]) {
      expect(check(dist), check.name).toEqual([]);
    }
  });

  it('repère une page noindex entrée dans un sitemap', () => {
    const { files } = buildSitemaps([{ kind: 'lists', path: '/fr/collections/self-hosted' }]);
    write('sitemap-lists.xml', files[0].xml);
    expect(noindexInSitemaps(readDist(dir))).toEqual([`sitemap-lists.xml : ${O}/fr/collections/self-hosted est noindex`]);
  });

  it('repère une URL de sitemap qui ne répond pas en 200 (fichier en dossier → 308)', () => {
    write('en/sponsor/index.html', page({ path: '/en/sponsor' }));
    const { files } = buildSitemaps([{ kind: 'pages', path: '/en/sponsor' }]);
    write('sitemap-pages.xml', files[0].xml);
    const { index } = buildSitemaps([
      { kind: 'pages', path: '/en/sponsor' }, { kind: 'tools', path: '/en/tools/mailchimp' },
      { kind: 'lists', path: '/fr/collections/self-hosted' },
    ]);
    write('sitemap-index.xml', index);
    expect(sitemapUrlProblems(readDist(dir))).toContain(`sitemap-pages.xml : ${O}/en/sponsor sans page construite`);
  });

  it('repère une canonical vers une autre langue', () => {
    write('fr/tools/notion.html', page({ lang: 'fr', path: '/fr/tools/notion', canonical: '/en/tools/notion' }));
    expect(canonicalProblems(readDist(dir))).toContain(`/fr/tools/notion : canonical ${O}/en/tools/notion`);
  });

  it('repère un hreflang vers une version noindex, et un hreflang sans retour', () => {
    write('en/categories/x.html', page({
      path: '/en/categories/x',
      hreflang: [['en', '/en/categories/x'], ['fr', '/fr/collections/self-hosted'], ['x-default', '/en/categories/x']],
    }));
    const problems = hreflangProblems(readDist(dir));
    expect(problems).toContain(`/en/categories/x → ${O}/fr/collections/self-hosted : version noindex citée`);
    expect(problems).toContain(`/en/categories/x → ${O}/fr/collections/self-hosted : pas de lien retour`);
  });

  it('repère un lien interne qui ne vise aucun fichier servi en 200', () => {
    write('en/index.html', page({ path: '/en/', body: '<a href="/en/categories/x/">x</a><a href="/missing.css">c</a>' }));
    expect(brokenInternalLinks(readDist(dir)).sort()).toEqual(['/en/ → /en/categories/x/', '/en/ → /missing.css']);
  });
});

// ---------------------------------------------------------------------------
// 2. Le vrai site construit. Sauté tant qu'aucun build n'a tourné ; en CI, le
//    job `data-and-code` lance `npm run build` AVANT `npx vitest run`.
// ---------------------------------------------------------------------------
const built = existsSync(join('dist', 'sitemap-index.xml'));

describe.skipIf(!built)('site construit — indexation (dist/)', () => {
  const dist = built ? readDist('dist') : null;

  it('robots.txt pointe vers l’index, et /sitemap.xml sert le même index', () => {
    expect(readFileSync(join('dist', 'robots.txt'), 'utf8')).toContain(`Sitemap: ${O}/sitemap-index.xml`);
    expect(readFileSync(join('dist', 'sitemap.xml'), 'utf8')).toBe(dist.indexXml);
    expect(sitemapIndexProblems(dist)).toEqual([]);
  });

  it('no noindex page appears in any sitemap', () => {
    expect(noindexInSitemaps(dist)).toEqual([]);
  });

  it('every sitemap url has a built file', () => {
    expect(sitemapUrlProblems(dist)).toEqual([]);
  });

  it('toutes les fiches du sitemap sont datées (lastmod)', () => {
    const tools = dist.sitemaps.find((s) => s.name === 'sitemap-tools.xml').xml;
    expect(tools.match(/<url>/g).length).toBe(tools.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g).length);
  });

  it('canonical = l’URL de la page elle-même, jamais une autre langue', () => {
    expect(canonicalProblems(dist)).toEqual([]);
  });

  it('hreflang set is symmetric across a page’s alternates', () => {
    expect(hreflangProblems(dist)).toEqual([]);
  });

  it('no internal 404 in dist', () => {
    expect(brokenInternalLinks(dist).slice(0, 20)).toEqual([]);
  });
});
