import { describe, it, expect } from 'vitest';
import {
  isDisplayableProject, statsAreFresh, alternativesFor, replacedTools,
  indexable, toolTitleVars, toolDateModified, inactiveAlternativesFor, STATS_MAX_AGE_DAYS, PROJECT_MAX_IDLE_DAYS,
  popularAlternatives,
} from '../scripts/lib/site-alternatives.mjs';

const today = '2026-10-17';

function stats(over = {}) {
  return {
    stars: 1200, lastCommit: '2026-10-01', createdAt: '2020-01-01',
    archived: false, checkedOn: '2026-10-17', ...over,
  };
}

function project(slug, over = {}) {
  return { slug, name: slug, repo: `org/${slug}`, stats: stats(), ...over };
}

function tool(slug, over = {}) {
  return { slug, name: slug, pagePriority: 5, alternatives: [], ...over };
}

describe('constantes', () => {
  it('fixe les seuils des Global Constraints', () => {
    expect(STATS_MAX_AGE_DAYS).toBe(45);
    expect(PROJECT_MAX_IDLE_DAYS).toBe(365);
  });
});

describe('isDisplayableProject', () => {
  it('archived project is not displayable', () => {
    expect(isDisplayableProject(project('a', { stats: stats({ archived: true }) }), today)).toBe(false);
  });

  it('last commit 2025-10-16 (366 days) is not displayable', () => {
    expect(isDisplayableProject(project('a', { stats: stats({ lastCommit: '2025-10-16' }) }), today)).toBe(false);
  });

  it('last commit 2025-10-17 (365 days) is still displayable', () => {
    expect(isDisplayableProject(project('a', { stats: stats({ lastCommit: '2025-10-17' }) }), today)).toBe(true);
  });

  it('repo null (no stats) is displayable without metrics', () => {
    const p = project('a', { repo: null, stats: undefined });
    delete p.stats;
    expect(isDisplayableProject(p, today)).toBe(true);
    expect(statsAreFresh(p, today)).toBe(false);
  });

  it('un projet actif et non archivé est affichable', () => {
    expect(isDisplayableProject(project('a'), today)).toBe(true);
  });

  it('des stats périmées ne retirent pas le projet (seules les métriques se masquent)', () => {
    const p = project('a', { stats: stats({ checkedOn: '2026-01-01' }) });
    expect(isDisplayableProject(p, today)).toBe(true);
    expect(statsAreFresh(p, today)).toBe(false);
  });
});

describe('statsAreFresh', () => {
  it('stats checkedOn 46 days ago → statsAreFresh false', () => {
    expect(statsAreFresh(project('a', { stats: stats({ checkedOn: '2026-09-01' }) }), today)).toBe(false);
  });

  it('stats checkedOn 45 days ago → statsAreFresh true', () => {
    expect(statsAreFresh(project('a', { stats: stats({ checkedOn: '2026-09-02' }) }), today)).toBe(true);
  });

  it('compte les jours en UTC, sans dérive au passage à l’heure d’été', () => {
    // Passage à l'heure d'été en Europe le 29/03/2026 : une soustraction en
    // heure locale donnerait 44,96 j et un arrondi par défaut tomberait à 44.
    expect(statsAreFresh(project('a', { stats: stats({ checkedOn: '2026-02-12' }) }), '2026-03-29')).toBe(true);
    expect(statsAreFresh(project('a', { stats: stats({ checkedOn: '2026-02-11' }) }), '2026-03-29')).toBe(false);
    expect(isDisplayableProject(project('a', { stats: stats({ lastCommit: '2025-03-29' }) }), '2026-03-29')).toBe(true);
    expect(isDisplayableProject(project('a', { stats: stats({ lastCommit: '2025-03-28' }) }), '2026-03-29')).toBe(false);
  });
});

describe('alternativesFor', () => {
  const projects = new Map([
    ['a', project('a')],
    ['b', project('b', { stats: stats({ archived: true }) })],
    ['c', project('c', { repo: null, stats: undefined })],
  ]);

  it("garde l'ordre de tool.alternatives et ne retient que les projets affichables", () => {
    const t = tool('x', { alternatives: [
      { project: 'c', fit: 'partial' },
      { project: 'b', fit: 'full' },
      { project: 'a', fit: 'niche' },
    ] });
    const alts = alternativesFor(t, projects, today);
    expect(alts.map((x) => [x.project.slug, x.fit])).toEqual([['c', 'partial'], ['a', 'niche']]);
    expect(alts[1].project).toBe(projects.get('a'));
  });

  it('ignore un slug inconnu et une fiche sans alternatives', () => {
    expect(alternativesFor(tool('x', { alternatives: [{ project: 'zz', fit: 'full' }] }), projects, today)).toEqual([]);
    const bare = tool('x');
    delete bare.alternatives;
    expect(alternativesFor(bare, projects, today)).toEqual([]);
  });
});

describe('inactiveAlternativesFor', () => {
  const projects = new Map([
    ['live', project('live')],
    ['arch', project('arch', { stats: stats({ archived: true, lastCommit: '2026-10-01' }) })],
    ['old', project('old', { stats: stats({ lastCommit: '2025-03-04' }) })],
    ['norepo', project('norepo', { repo: null, stats: undefined })],
  ]);

  it("rend les projets cités mais non affichables, dans l'ordre de la fiche, avec leur raison", () => {
    const t = tool('x', { alternatives: [
      { project: 'old', fit: 'full' }, { project: 'live', fit: 'full' }, { project: 'zz', fit: 'full' },
      { project: 'arch', fit: 'niche' }, { project: 'norepo', fit: 'partial' },
    ] });
    const out = inactiveAlternativesFor(t, projects, today);
    expect(out.map((x) => [x.project.slug, x.reason, x.lastCommit])).toEqual([
      ['old', 'stale', '2025-03-04'], ['arch', 'archived', '2026-10-01'],
    ]);
    expect(out[0].project).toBe(projects.get('old'));
  });

  it('archivé l’emporte sur inactif ; rien pour une fiche sans alternatives', () => {
    const both = new Map([['b', project('b', { stats: stats({ archived: true, lastCommit: '2020-01-01' }) })]]);
    expect(inactiveAlternativesFor(tool('x', { alternatives: [{ project: 'b', fit: 'full' }] }), both, today)[0].reason).toBe('archived');
    const bare = tool('x');
    delete bare.alternatives;
    expect(inactiveAlternativesFor(bare, projects, today)).toEqual([]);
  });

  it('affichables et inactifs partitionnent les alternatives connues', () => {
    const t = tool('x', { alternatives: [...projects.keys()].map((slug) => ({ project: slug, fit: 'full' })) });
    const shown = alternativesFor(t, projects, today).map((x) => x.project.slug);
    const inactive = inactiveAlternativesFor(t, projects, today).map((x) => x.project.slug);
    expect([...shown, ...inactive].sort()).toEqual([...projects.keys()].sort());
  });
});

describe('replacedTools', () => {
  it('replacedTools sorts by pagePriority', () => {
    const tools = new Map([
      ['low', tool('low', { pagePriority: 2, alternatives: [{ project: 'p', fit: 'full' }] })],
      ['none', tool('none', { pagePriority: 10, alternatives: [{ project: 'q', fit: 'full' }] })],
      ['high', tool('high', { pagePriority: 9, alternatives: [{ project: 'p', fit: 'niche' }] })],
      ['mid', tool('mid', { pagePriority: 5, alternatives: [{ project: 'p', fit: 'partial' }] })],
    ]);
    expect(replacedTools('p', tools).map((t) => t.slug)).toEqual(['high', 'mid', 'low']);
  });

  it('départage les égalités par slug et accepte un tableau', () => {
    const tools = [
      tool('b', { alternatives: [{ project: 'p', fit: 'full' }] }),
      tool('a', { alternatives: [{ project: 'p', fit: 'full' }] }),
      tool('c'),
    ];
    expect(replacedTools('p', tools).map((t) => t.slug)).toEqual(['a', 'b']);
  });
});

describe('indexable', () => {
  const p = project('p');
  const tools = new Map([['t', tool('t', { alternatives: [{ project: 'p', fit: 'full' }] })]]);
  const projectI18n = new Map([['fr/p', { description: '…' }]]);

  it("n'expose pas de porte pour les fiches (toujours indexables, Ruling 2)", () => {
    expect(indexable.tool).toBeUndefined();
  });

  it('projet : texte dans la langue ET au moins une fiche qui le cite', () => {
    expect(indexable.project(p, 'fr', { projectI18n, tools, today })).toBe(true);
    expect(indexable.project(p, 'en', { projectI18n, tools, today })).toBe(false);
    expect(indexable.project(p, 'fr', { projectI18n, tools: new Map(), today })).toBe(false);
  });

  it('archived project with text and citing tool is not indexable', () => {
    const archived = project('p', { stats: stats({ archived: true }) });
    expect(indexable.project(archived, 'fr', { projectI18n, tools, today })).toBe(false);
  });

  it('stale project (last commit 366 days ago) with text and citing tool is not indexable', () => {
    const stale = project('p', { stats: stats({ lastCommit: '2025-10-16' }) });
    expect(indexable.project(stale, 'fr', { projectI18n, tools, today })).toBe(false);
  });

  it('projet sans dépôt (pas de stats) avec texte et fiche qui le cite : indexable', () => {
    const noRepo = project('p', { repo: null });
    delete noRepo.stats;
    expect(indexable.project(noRepo, 'fr', { projectI18n, tools, today })).toBe(true);
  });

  it('projet : refuse un contexte sans today en chaîne — jamais un NaN silencieux', () => {
    expect(() => indexable.project(p, 'fr', { projectI18n, tools })).toThrow(/today/);
    expect(() => indexable.project(p, 'fr', { projectI18n, tools, today: new Date() })).toThrow(/today/);
  });

  it('comparatif : texte rédigé pour la paire dans la langue', () => {
    const compareI18n = new Map([['fr/a-vs-b', { intro: '…' }]]);
    const pair = { a: 'a', b: 'b', kindA: 'tool', kindB: 'project' };
    expect(indexable.compare(pair, 'fr', { compareI18n })).toBe(true);
    expect(indexable.compare(pair, 'en', { compareI18n })).toBe(false);
    expect(indexable.compare({ ...pair, a: 'b', b: 'a' }, 'fr', { compareI18n })).toBe(false);
  });

  it('liste : au moins 3 éléments', () => {
    expect(indexable.list([1, 2])).toBe(false);
    expect(indexable.list([1, 2, 3])).toBe(true);
  });
});

describe('toolDateModified', () => {
  it('prend le relevé le plus récent : prix ou chiffres GitHub des projets affichés', () => {
    const t = { pricing: { checkedOn: '2026-07-30' } };
    expect(toolDateModified(t, [])).toBe('2026-07-30');
    expect(toolDateModified(t, [{ project: { stats: { checkedOn: '2026-10-16' } } }, { project: {} }])).toBe('2026-10-16');
    expect(toolDateModified({ pricing: { checkedOn: '2026-11-01' } }, [{ project: { stats: { checkedOn: '2026-10-16' } } }])).toBe('2026-11-01');
  });
});

describe('toolTitleVars', () => {
  it('archived project drops below threshold → fallback title', () => {
    const projects = new Map([
      ['a', project('a')],
      ['b', project('b')],
      ['c', project('c', { stats: stats({ archived: true }) })],
    ]);
    const t = tool('notion', { name: 'Notion', alternatives: [
      { project: 'a', fit: 'full' }, { project: 'b', fit: 'full' }, { project: 'c', fit: 'full' },
    ] });
    const alts = alternativesFor(t, projects, today);
    expect(toolTitleVars(t, alts, '2026-10-17')).toEqual({ n: 2, name: 'Notion', year: '2026', fallback: true });
  });

  it('3 alternatives affichables → titre normal, année tirée de buildDate', () => {
    const t = tool('notion', { name: 'Notion' });
    expect(toolTitleVars(t, [{}, {}, {}], '2027-01-02')).toEqual({ n: 3, name: 'Notion', year: '2027', fallback: false });
  });
});

describe('popularAlternatives', () => {
  const t = (slug, pagePriority, names, markets = ['en', 'fr']) => ({ slug, pagePriority, markets, alternativeNames: names });
  const TOOLS = [
    t('a', 5, ['x']), t('b', 9, []), t('c', 5, ['x', 'y', 'z']), t('d', 5, ['x', 'y']),
    t('e', 9, ['x']), t('f', 99, ['x'], ['fr']), t('g', 5, ['x', 'y']),
  ];

  it('sorted by pagePriority desc, then displayable alternative count desc, then slug', () => {
    expect(popularAlternatives(TOOLS, 'en').map((x) => x.slug)).toEqual(['e', 'b', 'c', 'd', 'g', 'a']);
  });

  it('only tools published in the language', () => {
    expect(popularAlternatives(TOOLS, 'fr')[0].slug).toBe('f');
  });

  it('limit, 12 by default, and the current tool excluded', () => {
    const many = Array.from({ length: 20 }, (_, i) => t(`t${String(i).padStart(2, '0')}`, 5, []));
    expect(popularAlternatives(many, 'en')).toHaveLength(12);
    expect(popularAlternatives(TOOLS, 'en', 2).map((x) => x.slug)).toEqual(['e', 'b']);
    expect(popularAlternatives(TOOLS, 'en', 2, { exclude: 'e' }).map((x) => x.slug)).toEqual(['b', 'c']);
  });

  it('accepts a Map', () => {
    expect(popularAlternatives(new Map(TOOLS.map((x) => [x.slug, x])), 'en', 1)[0].slug).toBe('e');
  });
});
