import { describe, it, expect } from 'vitest';
import { compileValidators, loadData } from '../scripts/lib/load-data.mjs';
import { validateAll, collectKeyPaths, compareKey } from '../scripts/lib/validate-rules.mjs';

const validators = compileValidators('schema');
const TODAY = '2026-07-30';

function makeTool(slug, over = {}) {
  return {
    slug, name: slug, domains: [`${slug}.com`], category: 'docs-and-wiki',
    pricing: { amount: 10, currency: 'USD', plan: 'Pro', basis: 'per-seat-monthly',
      source: 'https://example.com/pricing', checkedOn: '2026-07-01', confidence: 'high' },
    verdict: 'kinda', verdictConfidence: 'medium', moatType: 'collaboration',
    diyTimeEstimate: 'weekend', requirements: ['hosting'],
    relatedSlugs: ['b', 'c', 'd'], markets: ['en'], pagePriority: 5, verifiedOneShot: false,
    ...over,
  };
}

function makeI18n(over = {}) {
  return {
    tagline: 't', verdictSummary: 'v', coreLoopDIY: 'c', whatYouLose: ['x'],
    whyPeopleStillPay: 'w', prompt: 'p',
    faq: [{ q: '1', a: '1' }, { q: '2', a: '2' }, { q: '3', a: '3' }, { q: '4', a: '4' }],
    ...over,
  };
}

function makeData(over = {}) {
  const tools = new Map([
    ['a', makeTool('a')], ['b', makeTool('b')], ['c', makeTool('c')], ['d', makeTool('d')],
  ]);
  for (const slug of ['a', 'b', 'c', 'd']) {
    tools.get(slug).relatedSlugs = ['a', 'b', 'c', 'd'].filter((s) => s !== slug).slice(0, 3);
  }
  const i18n = new Map(['a', 'b', 'c', 'd'].map((s) => [`en/${s}`, makeI18n()]));
  const ui = new Map([['en', {
    requirements: { hosting: 'Hosting' },
    pricingBasis: { 'per-seat-monthly': 'Monthly per seat' },
    runHints: { clipboard: 'Paste it' },
    site: {
      stats: { viewsToday: 'Views today' },
      footer: { stats: 'Stats' },
    },
  }]]);
  const agents = [{
    id: 'clipboard-only', name: 'Autre agent', kind: 'clipboard', template: null,
    homepage: 'https://example.com', maxLength: null, status: 'verified',
    verifiedOn: TODAY, runHint: 'clipboard', docs: null,
  }];
  return { tools, i18n, ui, agents, categories: { 'docs-and-wiki': {} }, ...over };
}

describe('validateAll', () => {
  it('ne signale rien sur un jeu de données correct', () => {
    expect(validateAll(makeData(), validators, TODAY)).toEqual([]);
  });

  it('refuse un marqueur de gabarit resté dans une FAQ', () => {
    const data = makeData();
    data.i18n.get('en/a').faq[2] = { q: 'TODO', a: 'TODO — à réécrire' };
    const out = validateAll(data, validators, TODAY).join(' ');
    expect(out).toContain('faq[2].q');
    expect(out).toContain('TODO');
  });

  it('refuse un marqueur de gabarit dans un champ éditorial simple', () => {
    const data = makeData();
    data.i18n.get('en/a').whyPeopleStillPay = 'TBD';
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('whyPeopleStillPay');
  });

  it("n'attrape pas les mots légitimes qui ressemblent à un marqueur", () => {
    const data = makeData();
    // "todo" en minuscules est du vocabulaire courant du catalogue (Todoist,
    // TickTick, "todo list") : le garde-fou ne doit pas le confondre.
    data.i18n.get('en/a').coreLoopDIY = 'gérer une todo list, comme Todoist, sans compte';
    expect(validateAll(data, validators, TODAY)).toEqual([]);
  });

  it('signale un relatedSlug inexistant', () => {
    const data = makeData();
    data.tools.get('a').relatedSlugs = ['b', 'c', 'fantome'];
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('fantome');
  });

  it('signale un domaine présent dans deux fiches', () => {
    const data = makeData();
    data.tools.get('b').domains = ['a.com'];
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('a.com');
  });

  it('signale un domaine dupliqué même avec un préfixe www', () => {
    const data = makeData();
    data.tools.get('b').domains = ['www.a.com'];
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('a.com');
  });

  it('signale une langue déclarée sans fichier i18n', () => {
    const data = makeData();
    data.tools.get('a').markets = ['en', 'fr'];
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('data/i18n/fr/tools/a.json');
  });

  it('signale un prix vérifié il y a plus de 180 jours', () => {
    const data = makeData();
    data.tools.get('a').pricing.checkedOn = '2025-12-01';
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('180');
  });

  it('signale une variable de template hors liste blanche', () => {
    const data = makeData();
    data.agents[0].kind = 'url';
    data.agents[0].template = 'https://x.test/?q={prompt}&key={apikey}';
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('apikey');
  });

  it('signale un code requirements sans traduction', () => {
    const data = makeData();
    data.tools.get('a').requirements = ['database'];
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('database');
  });

  it('signale un code pricingBasis sans traduction', () => {
    const data = makeData();
    data.tools.get('a').pricing.basis = 'usage-based';
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('pricingBasis.usage-based');
  });

  it('signale un runHint sans traduction', () => {
    const data = makeData();
    data.agents[0].runHint = 'inconnu';
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('inconnu');
  });

  it('signale un agent de type url sans template', () => {
    const data = makeData();
    data.agents[0].kind = 'url';
    data.agents[0].template = null;
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('template');
  });
});

describe('site.stats — parité des clés entre langues', () => {
  it('accepte les données réelles du repo', async () => {
    const data = await loadData(process.cwd());
    const errors = validateAll(data, validators, new Date().toISOString().slice(0, 10));
    expect(errors.filter((e) => e.includes('site.stats'))).toEqual([]);
  });

  it('signale une clé manquante dans une langue', async () => {
    const data = await loadData(process.cwd());
    const fr = structuredClone(data.ui.get('fr'));
    delete fr.site.stats.viewsToday;
    data.ui.set('fr', fr);
    const errors = validateAll(data, validators, new Date().toISOString().slice(0, 10));
    expect(errors.some((e) => e.includes('fr/ui.json') && e.includes('site.stats.viewsToday'))).toBe(true);
  });

  it('signale un footer.stats manquant', async () => {
    const data = await loadData(process.cwd());
    const de = structuredClone(data.ui.get('de'));
    delete de.site.footer.stats;
    data.ui.set('de', de);
    const errors = validateAll(data, validators, new Date().toISOString().slice(0, 10));
    expect(errors.some((e) => e.includes('de/ui.json') && e.includes('footer.stats'))).toBe(true);
  });
});

describe('collectKeyPaths', () => {
  it('liste les chemins feuilles, pas les nœuds', () => {
    expect(collectKeyPaths({ a: { b: 'x', c: 'y' }, d: 'z' }, 'site'))
      .toEqual(['site.a.b', 'site.a.c', 'site.d']);
  });

  it('traite un tableau comme une feuille, pas comme un nœud à descendre', () => {
    // La parité ne vérifie que la présence de la clé, pas la forme de son
    // contenu (le schéma s'en charge) : un tableau ne doit donc pas être
    // parcouru élément par élément, juste compté comme un seul chemin.
    expect(collectKeyPaths({ a: ['x', 'y'] }, 'site')).toEqual(['site.a']);
  });
});

describe('parité des clés site.* entre langues publiées', () => {
  // 'a' est publié en en et fr (déclaré dans markets) : seules ces deux
  // locales doivent porter un bloc "site" complet — voir tests/site-shell.test.mjs,
  // « bloc "site" des locales — complet seulement pour les langues publiées ».
  function makeSiteData(frSite) {
    const tools = new Map([
      ['a', makeTool('a', { markets: ['en', 'fr'], relatedSlugs: [] })],
    ]);
    const i18n = new Map([
      ['en/a', makeI18n()],
      ['fr/a', makeI18n()],
    ]);
    const ui = new Map([
      ['en', {
        requirements: { hosting: 'Hosting' },
        pricingBasis: { 'per-seat-monthly': 'Monthly per seat' },
        runHints: { clipboard: 'Paste it' },
        site: {
          brand: 'X',
          home: { colName: 'Name' },
          stats: {},
          footer: { stats: 'Stats' },
        },
      }],
      ['fr', {
        requirements: { hosting: 'Hébergement' },
        pricingBasis: { 'per-seat-monthly': 'Mensuel par siège' },
        runHints: { clipboard: 'Coller' },
        site: frSite,
      }],
    ]);
    const agents = [{
      id: 'clipboard-only', name: 'Autre agent', kind: 'clipboard', template: null,
      homepage: 'https://example.com', maxLength: null, status: 'verified',
      verifiedOn: TODAY, runHint: 'clipboard', docs: null,
    }];
    return { tools, i18n, ui, agents, categories: { 'docs-and-wiki': {} } };
  }

  it('signale une clé site présente en en et absente ailleurs', () => {
    const data = makeSiteData({ brand: 'X', home: {}, stats: {}, footer: { stats: 'Stats' } });
    const errors = validateAll(data, validators, TODAY);
    expect(errors).toContain('data/i18n/fr/ui.json : clé site manquante "site.home.colName"');
  });

  it('ne signale rien quand toutes les locales publiées portent les clés de en', () => {
    const data = makeSiteData({ brand: 'X', home: { colName: 'Nom' }, stats: {}, footer: { stats: 'Stats' } });
    const errors = validateAll(data, validators, TODAY);
    expect(errors.filter((e) => e.includes('clé site manquante'))).toEqual([]);
  });

  it('signale une clé morte présente dans une locale publiée et absente de en', () => {
    const data = makeSiteData({
      brand: 'X', home: { colName: 'Nom', extra: 'Fuite' }, stats: {}, footer: { stats: 'Stats' },
    });
    const errors = validateAll(data, validators, TODAY);
    expect(errors).toContain(
      'data/i18n/fr/ui.json : clé site.home.extra absente de en — clé morte ou faute de frappe'
    );
  });

  it("ne signale rien pour une locale non publiée avec un bloc site partiel", () => {
    // 'es' n'est déclarée dans aucun markets : c'est une locale non publiée,
    // avec un bloc site partiel { stats, footer } comme le veut la convention
    // du repo. Le contrôle de parité (scopé aux langues publiées) ne doit pas
    // la comparer au bloc complet de en, sous peine de signaler tout le reste
    // du bloc site comme "manquant" alors qu'il n'a jamais existé pour elle.
    const data = makeSiteData({ brand: 'X', home: { colName: 'Nom' }, stats: {}, footer: { stats: 'Stats' } });
    data.ui.set('es', { site: { stats: {}, footer: { stats: 'Estadísticas' } } });
    const errors = validateAll(data, validators, TODAY);
    expect(errors.filter((e) => e.includes('clé site manquante'))).toEqual([]);
    expect(errors.filter((e) => e.includes('interdite dans une locale non publiée'))).toEqual([]);
  });

  // Verrou locales réduites : une langue non publiée ne porte que
  // { footer, stats } par convention (voir tests/site-shell.test.mjs, « une
  // locale non publiée ne porte que les clés partagées par toutes »). Rien
  // avant ce contrôle n'empêchait une clé de premier niveau étrangère de s'y
  // glisser en silence — elle ne casserait aucun gabarit tant que la page
  // correspondante n'est pas rendue pour cette langue, et resterait invisible
  // jusqu'à la publication de la locale.
  it('signale une clé site de premier niveau interdite dans une locale non publiée', () => {
    const data = makeSiteData({ brand: 'X', home: { colName: 'Nom' }, stats: {}, footer: { stats: 'Stats' } });
    data.ui.set('es', { site: { home: { colName: 'Nombre' }, stats: {}, footer: { stats: 'Estadísticas' } } });
    const errors = validateAll(data, validators, TODAY);
    expect(errors).toContain('data/i18n/es/ui.json : clé site.home interdite dans une locale non publiée');
  });

  it('accepte footer et stats, dans n’importe quel ordre, pour une locale non publiée', () => {
    const data = makeSiteData({ brand: 'X', home: { colName: 'Nom' }, stats: {}, footer: { stats: 'Stats' } });
    data.ui.set('es', { site: { footer: { stats: 'Estadísticas' }, stats: {} } });
    const errors = validateAll(data, validators, TODAY);
    expect(errors.filter((e) => e.includes('interdite dans une locale non publiée'))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Projets open source, alternatives, comparatifs (spec §5, §7)
// ---------------------------------------------------------------------------

function makeProject(slug, over = {}) {
  return {
    slug, name: slug, homepage: `https://github.com/acme/${slug}`, repo: `acme/${slug}`,
    selfHostable: true, hosted: { exists: false }, deploy: [], stack: [],
    categories: ['docs-and-wiki'], markets: ['en'],
    ...over,
  };
}

const words = (n) => Array.from({ length: n }, (_, i) => `mot${i}`).join(' ');

function makeProjectI18n(over = {}) {
  return {
    tagline: 'Un wiki auto-hébergé.',
    description: words(150),
    strengths: ['s1', 's2', 's3'],
    limits: ['l1', 'l2'],
    bestFor: 'Les équipes qui hébergent déjà leurs outils.',
    ...over,
  };
}

const sixFaq = Array.from({ length: 6 }, (_, i) => ({ q: `q${i}`, a: `a${i}` }));

function makeAltData() {
  const data = makeData({
    projects: new Map([['outline', makeProject('outline')], ['wikijs', makeProject('wikijs')]]),
    projectI18n: new Map([['en/outline', makeProjectI18n()], ['en/wikijs', makeProjectI18n()]]),
    compare: [],
    compareI18n: new Map(),
    bannedPhrases: { en: ['revolutioniz', 'seamless'], fr: ['robuste'] },
  });
  data.tools.get('a').alternatives = [
    { project: 'outline', fit: 'full' }, { project: 'wikijs', fit: 'partial' },
  ];
  return data;
}

function makePair(over = {}) {
  return { a: 'a', b: 'outline', kindA: 'tool', kindB: 'project', volume: { us: 90 }, checkedOn: TODAY, ...over };
}

function makeCompareI18n(over = {}) {
  return {
    summary: words(100), pickAIf: ['x', 'y'], pickBIf: ['x', 'y'],
    faq: [{ q: '1', a: '1' }, { q: '2', a: '2' }, { q: '3', a: '3' }],
    ...over,
  };
}

describe('alternatives et projets', () => {
  it('accepte un jeu de données avec projets, textes et alternatives', () => {
    expect(validateAll(makeAltData(), validators, TODAY)).toEqual([]);
  });

  it('rejects alternatives pointing to unknown project', () => {
    const data = makeAltData();
    data.tools.get('a').alternatives.push({ project: 'fantome', fit: 'niche' });
    const out = validateAll(data, validators, TODAY);
    const line = out.find((e) => e.includes('fantome'));
    expect(line).toBeDefined();
    expect(line).toContain('data/tools/a.json');
    expect(line).toContain('alternatives');
  });

  it('refuse le même projet cité deux fois dans alternatives', () => {
    const data = makeAltData();
    data.tools.get('a').alternatives.push({ project: 'outline', fit: 'niche' });
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('"outline"');
  });

  it('accepts a tool without alternatives', () => {
    const data = makeAltData();
    delete data.tools.get('a').alternatives;
    expect(validateAll(data, validators, TODAY)).toEqual([]);
  });

  it('rejects project i18n missing for a declared market', () => {
    const data = makeAltData();
    data.projects.get('outline').markets = ['en', 'fr'];
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('data/i18n/fr/projects/outline.json');
  });

  // Les projets créés par la migration priorArt → projects n'ont encore aucun
  // texte : ils ne sont pas publiables (portes de la Task A3), mais leur
  // existence est légale. La règle ci-dessus ne vise qu'un projet déjà rédigé
  // dans une langue et pas dans une autre de ses markets.
  it('accepte un projet sans aucun texte (migré, pas encore rédigé)', () => {
    const data = makeAltData();
    data.projectI18n.delete('en/wikijs');
    expect(validateAll(data, validators, TODAY)).toEqual([]);
  });

  it('refuse un texte de projet sans fichier data/projects correspondant', () => {
    const data = makeAltData();
    data.projectI18n.set('en/fantome', makeProjectI18n());
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('data/projects/fantome.json');
  });

  it('refuse un projet dont le champ slug ne correspond pas au fichier', () => {
    const data = makeAltData();
    data.projects.get('outline').slug = 'outline-wiki';
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('data/projects/outline.json');
  });

  it('rejects project description under 120 or over 320 words', () => {
    for (const n of [119, 321]) {
      const data = makeAltData();
      data.projectI18n.get('en/outline').description = words(n);
      const out = validateAll(data, validators, TODAY).join(' ');
      expect(out).toContain('data/i18n/en/projects/outline.json');
      expect(out).toContain(`${n} mots`);
    }
    for (const n of [120, 320]) {
      const data = makeAltData();
      data.projectI18n.get('en/outline').description = words(n);
      expect(validateAll(data, validators, TODAY)).toEqual([]);
    }
  });

  it('rejects banned phrase in any i18n text field', () => {
    const data = makeAltData();
    data.projectI18n.get('en/outline').strengths[1] = 'Plunk is revolutionizing email';
    const out = validateAll(data, validators, TODAY).join(' ');
    expect(out).toContain('data/i18n/en/projects/outline.json');
    expect(out).toContain('revolutioniz');
  });

  it('attrape une tournure interdite sans tenir compte de la casse, dans une fiche outil', () => {
    const data = makeAltData();
    data.i18n.get('en/a').faq[1].a = 'A Seamless experience.';
    const out = validateAll(data, validators, TODAY).join(' ');
    expect(out).toContain('data/i18n/en/tools/a.json');
    expect(out).toContain('faq[1].a');
    expect(out).toContain('seamless');
  });

  it("n'applique pas la liste au prompt, qui s'adresse à un agent", () => {
    const data = makeAltData();
    data.i18n.get('en/a').prompt = 'Build a robust, seamless importer.';
    expect(validateAll(data, validators, TODAY)).toEqual([]);
  });

  it("applique la liste de la langue du fichier, pas celle d'une autre", () => {
    const data = makeAltData();
    data.tools.get('a').markets = ['en', 'fr'];
    data.i18n.set('fr/a', makeI18n({ tagline: 'Un outil robuste.' }));
    data.i18n.get('en/a').tagline = 'Robuste is a French word.';
    const out = validateAll(data, validators, TODAY);
    expect(out.join(' ')).toContain('data/i18n/fr/tools/a.json');
    expect(out.join(' ')).not.toContain('data/i18n/en/tools/a.json');
  });

  it('rejects alternativeNotes key not listed in tool.alternatives', () => {
    const data = makeAltData();
    data.i18n.get('en/a').alternativeNotes = { outline: 'Couvre le wiki.', mautic: 'Rien à voir.' };
    const out = validateAll(data, validators, TODAY).join(' ');
    expect(out).toContain('data/i18n/en/tools/a.json');
    expect(out).toContain('alternativeNotes');
    expect(out).toContain('mautic');
    expect(out).not.toContain('"outline"');
  });
});

describe('FAQ : 4 ou 6 entrées', () => {
  it('requires 6 faq entries once the i18n entry has alternativesIntro', () => {
    const data = makeAltData();
    data.i18n.get('en/a').alternativesIntro = 'Outline est la meilleure option.';
    const out = validateAll(data, validators, TODAY).join(' ');
    expect(out).toContain('data/i18n/en/tools/a.json');
    expect(out).toContain('6');
    data.i18n.get('en/a').faq = sixFaq;
    expect(validateAll(data, validators, TODAY)).toEqual([]);
  });

  it('accepts 4 faq entries on a migrated tool with 3 alternatives and no intro', () => {
    const data = makeAltData();
    data.projects.set('bookstack', makeProject('bookstack'));
    data.tools.get('a').alternatives.push({ project: 'bookstack', fit: 'partial' });
    expect(data.i18n.get('en/a').faq).toHaveLength(4);
    expect(validateAll(data, validators, TODAY)).toEqual([]);
  });

  it('refuse 5 entrées : une fiche est à 4 (avant enrichissement) ou à 6', () => {
    const data = makeAltData();
    data.i18n.get('en/a').faq = sixFaq.slice(0, 5);
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('faq');
  });
});

describe('comparatifs', () => {
  it('compareKey forme la clé a-vs-b', () => {
    expect(compareKey('mailchimp', 'listmonk')).toBe('mailchimp-vs-listmonk');
  });

  it('accepte une paire valide et son texte', () => {
    const data = makeAltData();
    data.compare = [makePair()];
    data.compareI18n.set('en/a-vs-outline', makeCompareI18n());
    expect(validateAll(data, validators, TODAY)).toEqual([]);
  });

  it('rejects compare pair with unknown side', () => {
    const data = makeAltData();
    data.compare = [makePair({ b: 'fantome' })];
    const out = validateAll(data, validators, TODAY).join(' ');
    expect(out).toContain('data/compare.json');
    expect(out).toContain('fantome');
  });

  it('refuse un côté qui existe, mais pas sous le type déclaré', () => {
    const data = makeAltData();
    data.compare = [makePair({ kindB: 'tool' })];
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('outline');
  });

  it('rejects duplicate compare pair (a-vs-b and b-vs-a)', () => {
    const data = makeAltData();
    data.compare = [makePair(), makePair({ a: 'outline', b: 'a', kindA: 'project', kindB: 'tool' })];
    const out = validateAll(data, validators, TODAY).join(' ');
    expect(out).toContain('data/compare.json');
    expect(out).toContain('a-vs-outline');
    expect(out).toContain('outline-vs-a');
  });

  it('refuse un texte de comparatif sans paire déclarée', () => {
    const data = makeAltData();
    data.compareI18n.set('en/a-vs-wikijs', makeCompareI18n());
    expect(validateAll(data, validators, TODAY).join(' ')).toContain('data/i18n/en/compare/a-vs-wikijs.json');
  });

  it('applique les tournures interdites aux textes de comparatif', () => {
    const data = makeAltData();
    data.compare = [makePair()];
    data.compareI18n.set('en/a-vs-outline', makeCompareI18n({ pickBIf: ['seamless sync', 'y'] }));
    const out = validateAll(data, validators, TODAY).join(' ');
    expect(out).toContain('data/i18n/en/compare/a-vs-outline.json');
    expect(out).toContain('seamless');
  });
});
