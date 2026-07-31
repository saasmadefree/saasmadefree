// scripts/import-upstream.mjs
//
// Transforms upstream "Can I Vibecode It?" app entries (MIT License, see
// NOTICE and README.md#attribution) into our two-halves data model:
//
//   data/tools/<slug>.json              — facts, language-neutral
//   data/i18n/en/tools/<slug>.json      — an editorial DRAFT, English only
//
// The upstream schema differs from ours field by field; see CONTRIBUTING.md
// and docs/import-report.md for the mapping tables this script implements.
//
// The editorial draft this script writes is NOT publishable as-is: it carries
// over tagline/verdictSummary/coreLoopDIY/whatYouLose/whyPeopleStillPay/notes
// (attributed, upstream-authored) and the upstream prompt verbatim, but the
// prompt must be rewritten and the faq[] written from scratch by hand before
// the entry can pass review — see CONTRIBUTING.md.
//
// Re-runnable: never overwrites a data/tools/<slug>.json or
// data/i18n/<lang>/tools/<slug>.json that already exists on disk. Running the
// same command twice changes nothing on disk (besides log output).
//
// Usage:
//   node scripts/import-upstream.mjs --source <dir-of-upstream-apps> --limit 25
//   node scripts/import-upstream.mjs --source <dir> --slugs notion,airtable
//   node scripts/import-upstream.mjs --source <dir> --limit 25 --dry-run
//
// Node 22+, ESM, no dependency beyond what the repo already has.

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeDomain } from './lib/validate-rules.mjs';

// ---------------------------------------------------------------------------
// pricing.basis — the 21 upstream free-text values collapse to our 5 codes.
// Unknown values fail loudly rather than being guessed at.
// ---------------------------------------------------------------------------
const BASIS_MAP = new Map([
  ['monthly', 'flat-monthly'],
  ['monthly EUR list', 'flat-monthly'],
  ['flat monthly, 3 active programs and 25k sends', 'flat-monthly'],
  ['monthly per seat', 'per-seat-monthly'],
  ['monthly per user', 'per-seat-monthly'],
  ['monthly per workspace', 'per-seat-monthly'],
  ['monthly per product', 'per-seat-monthly'],
  ['monthly per person', 'per-seat-monthly'],
  ['monthly per member', 'per-seat-monthly'],
  ['monthly per editor', 'per-seat-monthly'],
  ['monthly per Doc Maker', 'per-seat-monthly'],
  ['monthly per collaborator', 'per-seat-monthly'],
  ['monthly per channel', 'per-seat-monthly'],
  ['annual effective per month', 'annual-effective-monthly'],
  ['yearly per user', 'annual-effective-monthly'],
  ['monthly per user, billed yearly', 'annual-effective-monthly'],
  ['pay as you go', 'usage-based'],
  ['monthly capacity', 'usage-based'],
  ['monthly at 500 contacts', 'usage-based'],
  ['monthly at 1k subscribers', 'usage-based'],
  ['one-time', 'one-time'],
]);

function mapBasis(basis, slug) {
  const code = BASIS_MAP.get(basis);
  if (!code) {
    throw new Error(
      `"${slug}" : pricing.basis upstream inconnu "${basis}" — ajouter ce libellé à BASIS_MAP ` +
      'après avoir vérifié dans quelle case des 5 codes il tombe (voir CONTRIBUTING.md).'
    );
  }
  return code;
}

// ---------------------------------------------------------------------------
// diyTimeEstimate — 4 recurring upstream strings map cleanly. Two upstream
// entries use one-off, multi-clause sentences that need a human judgement
// call instead of a mechanical mapping (see docs/import-report.md); those are
// listed here as explicit per-slug overrides rather than guessed at.
// ---------------------------------------------------------------------------
const DIY_TIME_MAP = new Map([
  ['one sitting', 'one-sitting'],
  ['weekend', 'weekend'],
  ['multi-day', 'week'],
  ['not realistically solo', 'more'],
]);

const DIY_TIME_OVERRIDES = new Map([
  // Filled in by hand, per slug, the day those specific upstream entries are
  // actually imported — see docs/import-report.md for why this can't be a
  // mechanical rule.
]);

function mapDiyTime(value, slug) {
  if (DIY_TIME_OVERRIDES.has(slug)) return DIY_TIME_OVERRIDES.get(slug);
  const code = DIY_TIME_MAP.get(value);
  if (!code) {
    throw new Error(
      `"${slug}" : diyTimeEstimate upstream inconnu "${value}" — c'est probablement l'une des ` +
      `phrases longues qui exigent un jugement humain plutôt qu'un mapping mécanique ; ajouter ` +
      `une entrée dans DIY_TIME_OVERRIDES après avoir tranché.`
    );
  }
  return code;
}

// ---------------------------------------------------------------------------
// requirements[] — lossy on purpose. Free text -> our closed 8-code enum via
// keyword rules. A requirement string can trip more than one rule (e.g.
// "domain/HTTPS" implies both domain and hosting). Generic "LLM API" /
// "LLM API key" mentions with no vendor named default to anthropic-api-key,
// matching this project's own convention (see data/i18n/en/tools/notion.json)
// — documented as a judgement call in docs/import-report.md, and reconciled
// by hand against whatever the rewritten prompt actually specifies.
// ---------------------------------------------------------------------------
const REQUIREMENT_RULES = [
  { test: /anthropic/i, codes: ['anthropic-api-key'] },
  { test: /\bopenai\b|\bgpt-\d|\bchatgpt\b/i, codes: ['openai-api-key'] },
  { test: /\bllm api\b/i, codes: ['anthropic-api-key'] },
  {
    test: /hosted (app|backend|cron|scheduler)|hosting\b|\bVPS\b|\bDocker\b|cloud account|static hosting|reverse proxy|always-on box/i,
    codes: ['hosting'],
  },
  { test: /\bdatabase\b|\bSQLite\b/i, codes: ['database'] },
  { test: /\bdomain\b|\bDNS\b|\bSSL\b|\bHTTPS\b/i, codes: ['domain'] },
  {
    test: /\boauth\b|calendar oauth|api access (for|per) (each )?social network/i,
    codes: ['oauth-app'],
  },
  {
    test: /email (service|provider)|\bSMTP\b|\bSPF\b|\bDKIM\b|\bDMARC\b|transactional.*email|unsubscribe.*compliance/i,
    codes: ['email-provider'],
  },
];

const REQUIREMENT_ORDER = [
  'anthropic-api-key', 'openai-api-key', 'hosting', 'domain', 'database',
  'oauth-app', 'email-provider', 'none',
];

function mapRequirements(list) {
  const codes = new Set();
  for (const raw of list ?? []) {
    for (const rule of REQUIREMENT_RULES) {
      if (rule.test.test(raw)) for (const c of rule.codes) codes.add(c);
    }
  }
  if (codes.size === 0) return ['none'];
  return REQUIREMENT_ORDER.filter((c) => codes.has(c));
}

// ---------------------------------------------------------------------------
// pricing.amount / currency
// ---------------------------------------------------------------------------
function parseCurrency(native) {
  if (typeof native === 'string') {
    const m = native.match(/([A-Z]{3})\s*$/);
    if (m) return m[1];
  }
  return 'USD';
}

function parseAmountFromNative(native, slug) {
  if (typeof native === 'string') {
    const m = native.match(/^(\d+(?:\.\d+)?)/);
    if (m) return Number(m[1]);
  }
  throw new Error(
    `"${slug}" : priceMonthly est absent et pricing.native ("${native}") ne contient pas de ` +
    'montant exploitable — impossible de déduire pricing.amount sans inventer un chiffre.'
  );
}

// ---------------------------------------------------------------------------
// domains[] — the bare upstream domain, plus a hand-verified application
// subdomain where one is known to exist. Each addition below was confirmed
// by fetching it (see docs/import-report.md) rather than guessed from the
// product's naming convention. When unsure, we emit only the bare domain.
// ---------------------------------------------------------------------------
const EXTRA_DOMAINS = new Map([
  ['1password.com', ['my.1password.com']], // confirmed: 1Password account portal
  ['bitwarden.com', ['vault.bitwarden.com']], // confirmed: Bitwarden Web Vault
  ['hey.com', ['app.hey.com']], // confirmed: HEY sign-in page
  ['kit.com', ['app.kit.com']], // confirmed: Kit ("Log In - Kit") portal
  ['chatgpt.com', ['chat.openai.com']], // confirmed: 308-redirects to chatgpt.com
]);

function buildDomains(entry) {
  const bare = normalizeDomain(entry.domain);
  return [bare, ...(EXTRA_DOMAINS.get(bare) ?? [])];
}

// ---------------------------------------------------------------------------
// relatedSlugs — exactly three, distinct, never self, and (for a partial
// import like this one) restricted to slugs actually present in this run's
// batch, since that's the only set guaranteed to exist in data/tools/ once
// this run finishes. Three passes, in order:
//   1. upstream's own relatedSlugs, kept where they land inside the batch
//   2. same category, within the batch, ranked by pagePriority then slug
//   3. curated subject-adjacency clusters (a human judgement call — see
//      docs/import-report.md), which cross category lines on purpose
//   4. last resort: anything else in the batch, deterministic order
// ---------------------------------------------------------------------------
const SUBJECT_CLUSTERS = [
  // AI-powered subscriptions (assistants, writing, audio, coding agents)
  ['chatgpt', 'claude', 'grammarly', 'gamma', 'elevenlabs', 'granola', 'cursor',
    'github-copilot', 'perplexity', 'gemini'],
  // no-code / build-without-code
  ['bubble', 'glide', 'airtable', 'carrd', 'bannerbear', 'tally', 'coda'],
  // content, audience and growth
  ['ahrefs', 'beehiiv', 'kit', 'buffer', 'ghost-pro', 'feedly', 'mailchimp', 'semrush'],
  // visual / design
  ['canva', 'figma', 'gamma', 'carrd', 'adobe-express', 'whimsical'],
  // security and day-to-day utility for developers/solopreneurs
  ['1password', 'bitwarden', 'hey-email', 'github-copilot', 'cursor', 'dashlane'],
  // running a one-person business (billing, courses, site, email)
  ['invoice-ninja', 'kajabi', 'ghost-pro', 'carrd', 'kit'],
];

function computeRelatedSlugs(entry, batchBySlug) {
  const chosen = [];
  const add = (slug) => {
    if (!slug || slug === entry.slug) return;
    if (!batchBySlug.has(slug)) return;
    if (chosen.includes(slug)) return;
    if (chosen.length >= 3) return;
    chosen.push(slug);
  };

  for (const s of entry.relatedSlugs ?? []) add(s);

  if (chosen.length < 3) {
    const sameCategory = [...batchBySlug.values()]
      .filter((o) => o.category === entry.category && o.slug !== entry.slug)
      .sort((a, b) => (b.pagePriority - a.pagePriority) || a.slug.localeCompare(b.slug));
    for (const o of sameCategory) add(o.slug);
  }

  if (chosen.length < 3) {
    for (const cluster of SUBJECT_CLUSTERS) {
      if (!cluster.includes(entry.slug)) continue;
      for (const s of cluster) add(s);
      if (chosen.length >= 3) break;
    }
  }

  if (chosen.length < 3) {
    const rest = [...batchBySlug.values()]
      .filter((o) => o.slug !== entry.slug)
      .sort((a, b) => (b.pagePriority - a.pagePriority) || a.slug.localeCompare(b.slug));
    for (const o of rest) add(o.slug);
  }

  if (chosen.length < 3) {
    throw new Error(`"${entry.slug}" : impossible de calculer 3 relatedSlugs distincts dans ce lot.`);
  }
  return chosen.slice(0, 3);
}

// ---------------------------------------------------------------------------
// existing repo state — never re-import a slug already on disk, never import
// a domain already claimed by an existing entry.
// ---------------------------------------------------------------------------
async function loadExisting(dataDir) {
  const tools = new Map();
  const domains = new Set();
  const dir = join(dataDir, 'tools');
  let files = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  for (const f of files) {
    const tool = JSON.parse(await readFile(join(dir, f), 'utf8'));
    tools.set(tool.slug, tool);
    for (const d of tool.domains ?? []) domains.add(normalizeDomain(d));
  }
  return { tools, domains };
}

function eligibility(entry, existing) {
  if (existing.tools.has(entry.slug)) {
    return { ok: false, reason: 'slug already present in data/tools (existing curated entry)' };
  }
  const bare = normalizeDomain(entry.domain);
  if (existing.domains.has(bare)) {
    return { ok: false, reason: `domain "${bare}" already claimed by an existing entry` };
  }
  if (!entry.pricing?.plan || !entry.pricing?.source) {
    return { ok: false, reason: 'incomplete upstream pricing (null plan and/or source — nothing to substantiate a price with)' };
  }
  if (entry.priceMonthly == null && !entry.pricing?.native) {
    return { ok: false, reason: 'no priceMonthly and no pricing.native to derive an amount from' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// the two halves
// ---------------------------------------------------------------------------
function buildToolFact(entry, batchBySlug) {
  const fact = {
    slug: entry.slug,
    name: entry.name,
    domains: buildDomains(entry),
    category: entry.category,
  };
  if (entry.subcategory) fact.subcategory = entry.subcategory;
  fact.pricing = {
    amount: entry.priceMonthly ?? parseAmountFromNative(entry.pricing.native, entry.slug),
    currency: parseCurrency(entry.pricing.native),
    plan: entry.pricing.plan,
    basis: mapBasis(entry.pricing.basis, entry.slug),
    source: entry.pricing.source,
    checkedOn: entry.pricing.checkedOn,
    confidence: entry.pricing.confidence,
  };
  fact.verdict = entry.verdict;
  fact.verdictConfidence = entry.verdictConfidence;
  fact.moatType = entry.moatType;
  fact.diyTimeEstimate = mapDiyTime(entry.diyTimeEstimate, entry.slug);
  fact.requirements = mapRequirements(entry.requirements);
  if (entry.priorArt?.length) {
    fact.priorArt = entry.priorArt.map((p) => {
      const item = { name: p.name, url: p.url };
      if (p.license) item.license = p.license;
      return item;
    });
  }
  fact.relatedSlugs = computeRelatedSlugs(entry, batchBySlug);
  fact.markets = ['en'];
  fact.pagePriority = entry.pagePriority;
  fact.verifiedOneShot = entry.verifiedOneShot;
  return fact;
}

function buildI18nDraft(entry) {
  const draft = {
    tagline: entry.tagline,
    verdictSummary: entry.verdictSummary,
    coreLoopDIY: entry.coreLoopDIY,
    whatYouLose: entry.whatYouLose,
    whyPeopleStillPay: entry.whyPeopleStillPay,
  };
  if (entry.notes) draft.notes = entry.notes;
  draft.prompt = entry.prompt;
  draft.faq = [
    { q: 'TODO', a: 'TODO — replace with 4 tool-specific FAQ entries before this file is published (see CONTRIBUTING.md).' },
    { q: 'TODO', a: 'TODO' },
    { q: 'TODO', a: 'TODO' },
    { q: 'TODO', a: 'TODO' },
  ];
  return draft;
}

async function writeJson(path, value, dryRun) {
  if (dryRun) return;
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { limit: null, slugs: null, source: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--source') args.source = argv[++i];
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--slugs') args.slugs = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--dry-run') args.dryRun = true;
    else throw new Error(`argument inconnu : ${a}`);
  }
  if (!args.source) throw new Error('--source <dir> est obligatoire (dossier des JSON amont, un fichier par app).');
  if (!args.limit && !args.slugs) throw new Error('fournir --limit N ou --slugs a,b,c.');
  return args;
}

async function loadUpstream(sourceDir) {
  const files = (await readdir(sourceDir)).filter((f) => f.endsWith('.json'));
  const entries = [];
  for (const f of files) {
    entries.push(JSON.parse(await readFile(join(sourceDir, f), 'utf8')));
  }
  return entries;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const dataDir = join(rootDir, 'data');

  const upstream = await loadUpstream(args.source);
  const upstreamBySlug = new Map(upstream.map((e) => [e.slug, e]));
  const existing = await loadExisting(dataDir);

  let selected;
  if (args.slugs) {
    selected = args.slugs.map((slug) => {
      const entry = upstreamBySlug.get(slug);
      if (!entry) throw new Error(`slug demandé introuvable dans --source : "${slug}"`);
      return entry;
    });
  } else {
    const ranked = [...upstream].sort(
      (a, b) => (b.pagePriority - a.pagePriority) || a.slug.localeCompare(b.slug)
    );
    selected = [];
    const skippedForLimit = [];
    for (const entry of ranked) {
      if (selected.length >= args.limit) break;
      const check = eligibility(entry, existing);
      if (!check.ok) {
        skippedForLimit.push(`  - ${entry.slug} : ${check.reason}`);
        continue;
      }
      selected.push(entry);
    }
    if (skippedForLimit.length) {
      console.log(`Ignoré(s) pendant la sélection des ${args.limit} (inéligibles) :\n${skippedForLimit.join('\n')}`);
    }
    if (selected.length < args.limit) {
      console.log(`Attention : seulement ${selected.length}/${args.limit} candidats éligibles trouvés.`);
    }
  }

  const batchBySlug = new Map(selected.map((e) => [e.slug, e]));
  const domainsSeen = new Set(existing.domains);

  let wroteFacts = 0;
  let wroteDrafts = 0;
  let skippedFacts = 0;
  let skippedDrafts = 0;

  for (const entry of selected) {
    const factPath = join(dataDir, 'tools', `${entry.slug}.json`);
    const i18nPath = join(dataDir, 'i18n', 'en', 'tools', `${entry.slug}.json`);

    if (existsSync(factPath)) {
      console.log(`= ${entry.slug} : data/tools déjà présent, inchangé.`);
      skippedFacts += 1;
    } else {
      const check = eligibility(entry, existing);
      if (!check.ok) {
        console.log(`! ${entry.slug} : ignoré (${check.reason}).`);
        skippedFacts += 1;
      } else {
        const fact = buildToolFact(entry, batchBySlug);
        const collided = fact.domains.filter((d) => domainsSeen.has(normalizeDomain(d)));
        if (collided.length) {
          console.log(`! ${entry.slug} : ignoré (domaine(s) déjà revendiqué(s) dans ce lot : ${collided.join(', ')}).`);
          skippedFacts += 1;
        } else {
          for (const d of fact.domains) domainsSeen.add(normalizeDomain(d));
          await writeJson(factPath, fact, args.dryRun);
          console.log(`+ ${entry.slug} : data/tools/${entry.slug}.json (relatedSlugs: ${fact.relatedSlugs.join(', ')})`);
          wroteFacts += 1;
        }
      }
    }

    if (existsSync(i18nPath)) {
      console.log(`= ${entry.slug} : data/i18n/en/tools déjà présent, inchangé (éditorial existant jamais écrasé).`);
      skippedDrafts += 1;
    } else {
      await writeJson(i18nPath, buildI18nDraft(entry), args.dryRun);
      console.log(`+ ${entry.slug} : data/i18n/en/tools/${entry.slug}.json (brouillon — prompt et faq à réécrire).`);
      wroteDrafts += 1;
    }
  }

  console.log(
    `\n${args.dryRun ? '[dry-run] ' : ''}Terminé — facts: ${wroteFacts} écrite(s), ${skippedFacts} ignorée(s)/déjà là ; ` +
    `i18n/en: ${wroteDrafts} écrite(s) (brouillon), ${skippedDrafts} déjà là.`
  );
}

await main();
