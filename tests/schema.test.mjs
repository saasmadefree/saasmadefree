import { describe, it, expect } from 'vitest';
import { compileValidators } from '../scripts/lib/load-data.mjs';

const validators = compileValidators('schema');

const validTool = {
  slug: 'notion',
  name: 'Notion',
  domains: ['notion.so', 'notion.com'],
  category: 'docs-and-wiki',
  pricing: {
    amount: 10, currency: 'USD', plan: 'Plus', basis: 'per-seat-monthly',
    source: 'https://www.notion.com/pricing', checkedOn: '2026-07-30', confidence: 'high',
  },
  verdict: 'kinda',
  verdictConfidence: 'medium',
  moatType: 'collaboration',
  diyTimeEstimate: 'weekend',
  requirements: ['anthropic-api-key'],
  alternatives: [{ project: 'appflowy', fit: 'full' }, { project: 'affine', fit: 'partial' }],
  relatedSlugs: ['obsidian', 'coda', 'craft'],
  markets: ['en', 'fr'],
  pagePriority: 5,
  verifiedOneShot: false,
};

describe('tool.schema.json', () => {
  it('accepte une fiche complète et correcte', () => {
    expect(validators.tool(validTool)).toBe(true);
  });

  it('refuse un verdict hors énumération', () => {
    expect(validators.tool({ ...validTool, verdict: 'maybe' })).toBe(false);
  });

  it('refuse un slug avec une majuscule', () => {
    expect(validators.tool({ ...validTool, slug: 'Notion' })).toBe(false);
  });

  it('refuse une source de prix qui n’est pas en http(s)', () => {
    expect(validators.tool({ ...validTool, pricing: { ...validTool.pricing, source: 'javascript:alert(1)' } })).toBe(false);
  });

  it('refuse une liste de domaines vide', () => {
    expect(validators.tool({ ...validTool, domains: [] })).toBe(false);
  });

  it('refuse un champ inconnu', () => {
    expect(validators.tool({ ...validTool, sponsored: true })).toBe(false);
  });

  it('refuse priorArt, retiré des données sources au profit de alternatives', () => {
    const legacy = { ...validTool, priorArt: [{ name: 'AppFlowy', url: 'https://appflowy.io' }] };
    expect(validators.tool(legacy)).toBe(false);
  });

  it('refuse un fit hors énumération', () => {
    expect(validators.tool({ ...validTool, alternatives: [{ project: 'appflowy', fit: 'best' }] })).toBe(false);
  });

  it('refuse plus de 12 alternatives', () => {
    const alternatives = Array.from({ length: 13 }, (_, i) => ({ project: `p${i}`, fit: 'niche' }));
    expect(validators.tool({ ...validTool, alternatives })).toBe(false);
  });

  it('refuse une date checkedOn mal formée', () => {
    const broken = { ...validTool, pricing: { ...validTool.pricing, checkedOn: '30/07/2026' } };
    expect(validators.tool(broken)).toBe(false);
  });
});

describe('agent.schema.json', () => {
  const validAgent = {
    id: 'cursor',
    name: 'Cursor',
    kind: 'deeplink',
    template: 'cursor://anysphere.cursor-deeplink/prompt?text={prompt}',
    homepage: 'https://cursor.com',
    maxLength: 8000,
    status: 'verified',
    verifiedOn: '2026-07-30',
    runHint: 'cursor-deeplink',
    docs: 'https://cursor.com/docs/integrations/deeplinks',
  };

  it('accepte un agent complet', () => {
    expect(validators.agent(validAgent)).toBe(true);
  });

  it('refuse une homepage ou des docs qui ne sont pas en http(s)', () => {
    expect(validators.agent({ ...validAgent, homepage: 'javascript:alert(1)' })).toBe(false);
    expect(validators.agent({ ...validAgent, docs: 'javascript:alert(1)' })).toBe(false);
    expect(validators.agent({ ...validAgent, docs: null })).toBe(true);
  });

  it('refuse un statut inconnu', () => {
    expect(validators.agent({ ...validAgent, status: 'maybe' })).toBe(false);
  });
});

describe('tool-i18n.schema.json', () => {
  const validI18n = {
    tagline: 'Un espace de travail tout-en-un.',
    verdictSummary: 'Un raisonnement honnête en un paragraphe.',
    coreLoopDIY: 'Ce que la version maison fait vraiment.',
    whatYouLose: ['la collaboration temps réel'],
    whyPeopleStillPay: 'Un paragraphe honnête.',
    notes: 'Une ligne éditoriale.',
    prompt: 'Construis-moi un…',
    faq: [
      { q: 'Q1', a: 'R1' }, { q: 'Q2', a: 'R2' },
      { q: 'Q3', a: 'R3' }, { q: 'Q4', a: 'R4' },
    ],
  };

  it('accepte une fiche traduite complète', () => {
    expect(validators.toolI18n(validI18n)).toBe(true);
  });

  it('refuse une FAQ de trois questions', () => {
    expect(validators.toolI18n({ ...validI18n, faq: validI18n.faq.slice(0, 3) })).toBe(false);
  });

  it('accepte une FAQ de six questions, une intro et des notes par projet', () => {
    const faq = [...validI18n.faq, { q: 'Q5', a: 'R5' }, { q: 'Q6', a: 'R6' }];
    const entry = { ...validI18n, faq, alternativesIntro: 'AppFlowy est le meilleur choix.',
      alternativeNotes: { appflowy: 'Couvre les pages et les bases.' } };
    expect(validators.toolI18n(entry)).toBe(true);
  });

  it('refuse une FAQ de sept questions', () => {
    const faq = Array.from({ length: 7 }, (_, i) => ({ q: `Q${i}`, a: `R${i}` }));
    expect(validators.toolI18n({ ...validI18n, faq })).toBe(false);
  });
});

describe('project.schema.json', () => {
  const validProject = {
    slug: 'listmonk', name: 'Listmonk', homepage: 'https://listmonk.app', repo: 'knadh/listmonk',
    license: 'AGPL-3.0', selfHostable: true, hosted: { exists: false },
    deploy: ['docker', 'binary'], stack: ['go', 'vue', 'postgresql'],
    categories: ['newsletter', 'email'],
    stats: { stars: 17000, lastCommit: '2026-10-10', createdAt: '2019-06-26', archived: false, checkedOn: '2026-10-17' },
    markets: ['en', 'fr'],
  };

  it("accepte l'exemple du spec", () => {
    expect(validators.project(validProject)).toBe(true);
  });

  it('accepte repo null (forge non GitHub) et stats absentes', () => {
    const { stats, ...noStats } = validProject;
    expect(validators.project({ ...noStats, repo: null })).toBe(true);
  });

  it('refuse un repo qui est une URL et pas owner/name', () => {
    expect(validators.project({ ...validProject, repo: 'https://github.com/knadh/listmonk' })).toBe(false);
  });

  it('accepte une offre hébergée complète, refuse une offre hébergée sans prix', () => {
    const hosted = { exists: true, priceFrom: 9, currency: 'USD', source: 'https://listmonk.app/pricing', checkedOn: '2026-10-17' };
    expect(validators.project({ ...validProject, hosted })).toBe(true);
    expect(validators.project({ ...validProject, hosted: { exists: true } })).toBe(false);
    expect(validators.project({ ...validProject, hosted: { exists: false, priceFrom: 9 } })).toBe(false);
  });

  it('refuse un champ inconnu', () => {
    expect(validators.project({ ...validProject, featured: true })).toBe(false);
  });

  // format: uri accepte « javascript:alert(1) » : le lien rendu serait un
  // script. Chaque URL d'un projet doit commencer par http(s)://.
  it('refuse une URL qui n’est pas en http(s) (homepage, source hébergée)', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://listmonk.app']) {
      expect(validators.project({ ...validProject, homepage: bad })).toBe(false);
      const hosted = { exists: true, priceFrom: 9, currency: 'USD', source: bad, checkedOn: '2026-10-17' };
      expect(validators.project({ ...validProject, hosted })).toBe(false);
      expect(validators.project({ ...validProject, hosted: { exists: false, checkedOn: '2026-10-17', source: bad } })).toBe(false);
    }
    expect(validators.project({ ...validProject, homepage: 'http://listmonk.app' })).toBe(true);
  });

  // « Pas d'offre hébergée » n'est un fait que vérifié : une date, et la
  // source qu'on a lue ce jour-là. Sans date, c'est une valeur par défaut.
  it('accepte hosted.exists false vérifié (checkedOn + source), refuse une date sans source', () => {
    const checked = { exists: false, checkedOn: '2026-10-17', source: 'https://listmonk.app' };
    expect(validators.project({ ...validProject, hosted: checked })).toBe(true);
    expect(validators.project({ ...validProject, hosted: { exists: false, checkedOn: '2026-10-17' } })).toBe(false);
    expect(validators.project({ ...validProject, hosted: { exists: false, checkedOn: '17/10/2026', source: checked.source } })).toBe(false);
  });

  it('accepte selfHostable vérifié (date + source), refuse une date sans source', () => {
    const ok = { ...validProject, selfHostableCheckedOn: '2026-10-17', selfHostableSource: 'https://listmonk.app/docs/installation' };
    expect(validators.project(ok)).toBe(true);
    expect(validators.project({ ...validProject, selfHostableCheckedOn: '2026-10-17' })).toBe(false);
    expect(validators.project({ ...ok, selfHostableSource: 'javascript:alert(1)' })).toBe(false);
  });
});

describe('project-i18n.schema.json', () => {
  const valid = {
    tagline: 'Newsletters et listes de diffusion auto-hébergées.',
    description: 'Une description factuelle.',
    strengths: ['a', 'b', 'c'], limits: ['x', 'y'], bestFor: 'Les petites équipes.',
  };

  it('accepte un texte complet', () => {
    expect(validators.projectI18n(valid)).toBe(true);
  });

  it('refuse une tagline de plus de 110 caractères', () => {
    expect(validators.projectI18n({ ...valid, tagline: 'x'.repeat(111) })).toBe(false);
  });

  it('refuse moins de 2 limites et moins de 3 points forts', () => {
    expect(validators.projectI18n({ ...valid, limits: ['x'] })).toBe(false);
    expect(validators.projectI18n({ ...valid, strengths: ['a', 'b'] })).toBe(false);
  });

  it('exige description et bestFor', () => {
    const { description, ...noDescription } = valid;
    const { bestFor, ...noBestFor } = valid;
    expect(validators.projectI18n(noDescription)).toBe(false);
    expect(validators.projectI18n(noBestFor)).toBe(false);
  });
});

describe('compare.schema.json et compare-i18n.schema.json', () => {
  const pair = { a: 'mailchimp', b: 'listmonk', kindA: 'tool', kindB: 'project', volume: { us: 90 }, checkedOn: '2026-10-20' };

  it("accepte l'exemple du spec, refuse un type de côté inconnu", () => {
    expect(validators.compare([pair])).toBe(true);
    expect(validators.compare([{ ...pair, kindB: 'saas' }])).toBe(false);
  });

  it('refuse une racine qui n’est pas un tableau', () => {
    expect(validators.compare({ pairs: [pair] })).toBe(false);
  });

  it('exige exactement 3 FAQ et 2 à 4 raisons de chaque côté', () => {
    const text = { summary: 'Un avis.', pickAIf: ['a', 'b'], pickBIf: ['a', 'b'],
      faq: [{ q: '1', a: '1' }, { q: '2', a: '2' }, { q: '3', a: '3' }] };
    expect(validators.compareI18n(text)).toBe(true);
    expect(validators.compareI18n({ ...text, faq: text.faq.slice(0, 2) })).toBe(false);
    expect(validators.compareI18n({ ...text, pickAIf: ['a'] })).toBe(false);
  });
});
