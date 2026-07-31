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
//   node scripts/import-upstream.mjs --source <dir> --slugs baserow-cloud,airtable
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
  // --- added for the 608-entry upstream refresh (see docs/import-report.md) ---
  ['annual-equivalent', 'annual-effective-monthly'],
  ['annual-equivalent per seat', 'annual-effective-monthly'],
  ['annual-equivalent per user', 'annual-effective-monthly'],
  ['monthly approximate', 'flat-monthly'],
  ['monthly base', 'flat-monthly'],
  ['monthly equivalent', 'flat-monthly'],
  ['monthly-equivalent', 'flat-monthly'],
  ['monthly household', 'flat-monthly'],
  ['monthly starting', 'flat-monthly'],
  ['monthly minimum plus usage', 'usage-based'],
  ['monthly per container', 'usage-based'],
  ['monthly per dyno', 'usage-based'],
  ['monthly per host', 'usage-based'],
  ['monthly per project', 'usage-based'],
  ['monthly per service', 'usage-based'],
  ['monthly per agent', 'per-seat-monthly'],
  ['monthly per computer', 'per-seat-monthly'],
  ['monthly per creator', 'per-seat-monthly'],
  ['monthly per employee', 'per-seat-monthly'],
  ['monthly per employee starting', 'per-seat-monthly'],
  ['monthly per license', 'per-seat-monthly'],
  ['monthly per location', 'per-seat-monthly'],
  ['monthly per maker', 'per-seat-monthly'],
  ['monthly per organizer', 'per-seat-monthly'],
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
  // the 608-entry refresh phrases the same two buckets as "closest consolation
  // build: X" for entries where the DIY version is explicitly a lesser
  // substitute rather than a full replacement — same terminal duration either
  // way, so it collapses onto the same two codes.
  ['closest consolation build: one sitting', 'one-sitting'],
  ['closest consolation build: multi-day', 'week'],
]);

const DIY_TIME_OVERRIDES = new Map([
  // "one sitting (dictation only), multi-week with call capture" — the DIY
  // prompt scopes down to the dictation loop (upstream's own "one sitting"
  // half); call-capture/CRM matching is out of scope, named explicitly in
  // whatYouLose rather than attempted. See docs/import-report.md.
  ['superscribe', 'one-sitting'],
  // "one sitting for the dashboard, a weekend-plus for native app polish" —
  // upstream's own coreLoopDIY *is* the dashboard half ("one sitting");
  // native-app polish is a nice-to-have beyond that core loop, not it.
  ['uncircle', 'one-sitting'],
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
// matching this project's own convention (see data/i18n/en/tools/v0.json)
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

// A numeric amount can be derived either from priceMonthly, or from a
// pricing.native string that starts with a digit. In the 608-entry refresh,
// 47 entries have neither: pricing.native is itself a category word ("custom",
// "usage-based", "transaction-based", "revenue share", "region-dependent",
// "free-or-variable", "one-time-or-variable", "usage-or-custom", "user-selected
// monthly") — upstream's own pricing.notes on every one of these says verbatim
// "canonical monthly amount is null." plan and source are present, so the
// existing null-plan/null-source eligibility check doesn't catch them; this
// one does. See docs/import-report.md for the full list and reasoning.
function hasDerivableAmount(entry) {
  if (entry.priceMonthly != null) return true;
  const native = entry.pricing?.native;
  return typeof native === 'string' && /^\d+(?:\.\d+)?/.test(native);
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

// domains[] — replace the bare upstream domain entirely when it would be a
// hostname shared with a much larger, unrelated product. The extension
// matcher works on hostnames only, so a product living at a path or a shared
// apex domain of a bigger platform needs a narrower, product-specific
// hostname instead — or gets skipped rather than firing wrongly on unrelated
// traffic. Each override below was confirmed by fetching it (see
// docs/import-report.md), not guessed from naming convention.
const DOMAIN_OVERRIDES = new Map([
  // github-copilot: github.com is GitHub itself (every repo/issue/PR) —
  // fixed upstream of this script, kept here as the documented precedent.
  ['github.com', 'githubcopilot.com'],
  // adobe.com is Adobe's entire corporate site (Photoshop, Acrobat, Creative
  // Cloud, ...) — Adobe Express has its own confirmed hostname.
  ['adobe.com', 'new.express.adobe.com'],
  // umami.is is the open-source project's own site (self-hosters land there
  // too) — the paid hosted product is confirmed to live at cloud.umami.is.
  ['umami.is', 'cloud.umami.is'],
  // readwise.io covers Readwise's original highlights product too — Reader
  // is confirmed to live at its own read.readwise.io hostname.
  ['readwise.io', 'read.readwise.io'],
]);

// domains[] — per-SLUG override, checked before DOMAIN_OVERRIDES. Needed when
// two *different* upstream entries share the same bare domain (a real
// within-608 collision, not a hostname-too-broad problem) and each needs its
// own narrower, confirmed hostname. Every value below was confirmed by
// fetching it — see docs/import-report.md, "domain collisions" section.
const SLUG_DOMAIN_OVERRIDES = new Map([
  ['adobe-acrobat-pro', 'acrobat.adobe.com'], // adobe.com also claimed by adobe-express (-> new.express.adobe.com) and adobe-lightroom
  ['adobe-lightroom', 'lightroom.adobe.com'],
  ['apple-music', 'music.apple.com'], // apple.com also claimed by icloud-plus
  ['icloud-plus', 'icloud.com'], // iCloud's real product domain is not a subdomain of apple.com at all
  ['microsoft-teams-essentials', 'teams.microsoft.com'], // microsoft.com also claimed by microsoft-365-personal (excluded, see MANUAL_EXCLUSIONS)
  ['proton-drive-plus', 'drive.proton.me'], // proton.me also claimed by proton-pass-plus
  ['proton-pass-plus', 'pass.proton.me'],
  ['quicken-simplifi', 'simplifi.quicken.com'], // quicken.com also claimed by quicken-classic-deluxe; simplifi.com does not resolve to Quicken (verified)
  ['v0', 'v0.app'], // Vercel rebranded v0.dev -> v0.app in January 2026 (confirmed: v0.dev is stale, v0.app is live); not a collision, just an upstream-stale domain
]);

// Manual exclusions beyond the automatic eligibility() checks — a real
// upstream entry with complete pricing, but excluded for a reason the
// mechanical checks can't express. See docs/import-report.md.
const MANUAL_EXCLUSIONS = new Map([
  ['google-ai-pro', 'same product as our existing "gemini" entry — "Google AI Pro" is the 2026 rebrand of Gemini Advanced, and gemini.json\'s pricing.plan is already literally "Google AI Pro" at the same $19.99. A second entry would be a duplicate page for one subscription, not two.'],
  ['microsoft-365-personal', 'no confirmed product-specific hostname exists: the pricing page lives at a path on the huge microsoft.com corporate domain, and the web-app hostname (m365.cloud.microsoft) is shared across every Microsoft 365 tier, not this one. Excluded per the domain-safety rule rather than firing on unrelated Microsoft traffic.'],
  ['readwise', 'same underlying subscription as our existing "readwise-reader" entry — upstream\'s own data has both "readwise" and "readwise-reader" on the identical domain (readwise.io) with the identical pricing.plan ("Readwise Full"). It\'s already blocked by the domain-collision check via DOMAIN_OVERRIDES, but is listed here explicitly so the reason is documented rather than looking like an ordinary domain clash.'],
  ['notion', 'deliberately removed from the catalogue by owner decision (see docs/import-report.md) — was previously hand-curated data/tools/notion.json, deleted along with its i18n files and 27 relatedSlugs repointed. Without this entry, "slug already present" no longer blocks upstream\'s own notion.json from being re-imported by a future --limit run, so it\'s excluded here explicitly. Do not re-add without a new owner decision.'],
]);

function buildDomains(entry) {
  const slugOverride = SLUG_DOMAIN_OVERRIDES.get(entry.slug);
  if (slugOverride) return [normalizeDomain(slugOverride)];
  const upstreamBare = normalizeDomain(entry.domain);
  const bare = DOMAIN_OVERRIDES.get(upstreamBare) ?? upstreamBare;
  return [bare, ...(EXTRA_DOMAINS.get(bare) ?? [])];
}

// ---------------------------------------------------------------------------
// relatedSlugs — exactly three, distinct, never self, and restricted to
// slugs actually guaranteed to exist in data/tools/ once this run finishes:
// that's the union of everything already on disk (prior batches, and the
// four hand-curated entries) plus this run's own batch. As the catalogue
// grows, most entries resolve at pass 2 (same category) — pass 3 is the
// fallback for genuinely thin categories, not the common case. Four passes:
//   1. upstream's own relatedSlugs, kept where they land inside the pool
//   2. same category, within the pool, ranked by pagePriority then slug
//   3. curated subject-adjacency clusters (a human judgement call — see
//      docs/import-report.md), which cross category lines on purpose
//   4. last resort: anything else in the pool, deterministic order
// ---------------------------------------------------------------------------
const SUBJECT_CLUSTERS = [
  // AI-powered subscriptions (assistants, writing, audio, coding agents)
  ['chatgpt', 'claude', 'grammarly', 'gamma', 'elevenlabs', 'granola', 'cursor',
    'github-copilot', 'perplexity', 'gemini', 'quillbot', 'jasper', 'midjourney',
    'runway', 'krisp'],
  // no-code / build-without-code
  ['bubble', 'glide', 'airtable', 'carrd', 'bannerbear', 'tally', 'coda', 'softr',
    'webflow', 'framer'],
  // content, audience and growth
  ['ahrefs', 'beehiiv', 'kit', 'buffer', 'ghost-pro', 'feedly', 'mailchimp', 'semrush',
    'surfer-seo', 'frase', 'typefully', 'later', 'postiz', 'post-bridge', 'superx'],
  // visual / design
  ['canva', 'figma', 'gamma', 'carrd', 'adobe-express', 'whimsical', 'sleek',
    'beautiful-ai'],
  // security and day-to-day utility for developers/solopreneurs
  ['1password', 'bitwarden', 'hey-email', 'github-copilot', 'cursor', 'dashlane',
    'raycast-pro'],
  // running a one-person business (billing, courses, site, email)
  ['invoice-ninja', 'kajabi', 'ghost-pro', 'carrd', 'kit', 'podia', 'teachable',
    'freshbooks', 'xero', 'quickbooks-online'],
  // tasks, calendar and personal organization
  ['todoist', 'sunsama', 'motion', 'akiflow', 'reclaim-ai', 'meetergo', 'savvycal'],
  // meeting notes and transcription
  ['granola', 'otter-ai', 'fireflies-ai', 'fathom-ai', 'tldv', 'superwhisper',
    'superscribe'],
  // analytics and site measurement
  ['plausible', 'umami-cloud', 'simple-analytics', 'fathom-analytics', 'bitly',
    'lnkflow'],
  // automation and integration plumbing
  ['zapier', 'make', 'ifttt', 'n8n-cloud'],
  // dev tools
  ['cursor', 'github-copilot', 'replit', 'codesandbox', 'linear', 'uncircle', 'wabery'],
  // personal finance
  ['ynab', 'monarch-money', 'copilot-money'],
  // screen/video recording and editing
  ['loom', 'tella', 'descript', 'capcut'],
  // read-it-later, bookmarks, RSS
  ['readwise-reader', 'raindrop-io', 'inoreader', 'feedly'],
  // community platforms
  ['circle', 'mighty-networks'],
  // whiteboards and diagramming
  ['miro', 'whimsical'],
  // website builders
  ['carrd', 'webflow', 'framer', 'squarespace', 'wix'],
  // hosting
  ['vercel', 'netlify'],
];

// Upstream's own relatedSlugs are occasionally incoherent (semrush -> an
// accounting tool is a real example hit during import, not hypothetical) —
// trusting them blindly reproduces that noise whenever the coincidence of
// batch membership happens to preserve the one bad link. An upstream link is
// only trusted if it's corroborated: same category, or already paired with
// this slug in a curated SUBJECT_CLUSTERS entry.
function upstreamLinkIsCoherent(entry, candidateSlug, pool, entryCategory) {
  const candidate = pool.get(candidateSlug);
  if (candidate && candidate.category === entryCategory) return true;
  return SUBJECT_CLUSTERS.some((c) => c.includes(entry.slug) && c.includes(candidateSlug));
}

function computeRelatedSlugs(entry, pool) {
  // entry is still the raw upstream object (raw category string); pool
  // members carry our normalized category slugs (see main()). Map once here
  // so every comparison below is apples-to-apples.
  const entryCategory = mapCategory(entry.category, entry.slug);
  const chosen = [];
  const add = (slug) => {
    if (!slug || slug === entry.slug) return;
    if (!pool.has(slug)) return;
    if (chosen.includes(slug)) return;
    if (chosen.length >= 3) return;
    chosen.push(slug);
  };

  for (const s of entry.relatedSlugs ?? []) {
    if (upstreamLinkIsCoherent(entry, s, pool, entryCategory)) add(s);
  }

  if (chosen.length < 3) {
    const sameCategory = [...pool.values()]
      .filter((o) => o.category === entryCategory && o.slug !== entry.slug)
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
    const rest = [...pool.values()]
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
  if (MANUAL_EXCLUSIONS.has(entry.slug)) {
    return { ok: false, reason: MANUAL_EXCLUSIONS.get(entry.slug) };
  }
  const slugOverride = SLUG_DOMAIN_OVERRIDES.get(entry.slug);
  const upstreamBare = normalizeDomain(entry.domain);
  const bare = slugOverride ? normalizeDomain(slugOverride) : (DOMAIN_OVERRIDES.get(upstreamBare) ?? upstreamBare);
  if (existing.domains.has(bare)) {
    return { ok: false, reason: `domain "${bare}" already claimed by an existing entry` };
  }
  if (!entry.pricing?.plan || !entry.pricing?.source) {
    return { ok: false, reason: 'incomplete upstream pricing (null plan and/or source — nothing to substantiate a price with)' };
  }
  if (!hasDerivableAmount(entry)) {
    return { ok: false, reason: 'no numeric amount anywhere (pricing.native is a category word like "custom"/"usage-based"/"transaction-based" — upstream itself notes "canonical monthly amount is null")' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// category — the 608-entry upstream refresh uses 75 distinct raw category
// values against our post-merge 33 (see docs/import-report.md, "Task 1").
// Most collapse 1:1 onto an existing slug; several are the same duplicate/
// near-duplicate pattern Task 1 already fixed once, applied to the new
// upstream vocabulary rather than reproducing it. Only the raw values we've
// actually decided how to place are listed — an unmapped value throws rather
// than silently spawning a new single-tool category (the exact problem this
// map exists to prevent). New verticals with no home yet in our 33 (crm,
// customer-support, cloud-storage, documents, photo-editing, project
// management, time tracking, video-conferencing, hr, legal, travel, home,
// wellness, career, education, localization, monitoring, media/audio
// streaming) are deliberately left unmapped — see docs/import-report.md for
// the full plan for when a future batch picks one of them up.
// ---------------------------------------------------------------------------
const CATEGORY_MAP = new Map([
  // direct — already our slug, upstream's own name matches
  ['security', 'security'], ['seo-marketing', 'seo-marketing'], ['databases', 'databases'],
  ['newsletter', 'newsletter'], ['no-code-apps', 'no-code-apps'], ['social-media', 'social-media'],
  ['design', 'design'], ['website-builder', 'website-builder'], ['dev-tools', 'dev-tools'],
  ['presentations', 'presentations'], ['email', 'email'], ['finance-accounting', 'finance-accounting'],
  ['creator-commerce', 'creator-commerce'], ['automation', 'automation'], ['scheduling', 'scheduling'],
  ['forms', 'forms'], ['tasks', 'tasks'], ['hosting', 'hosting'], ['personal-finance', 'personal-finance'],
  ['community', 'community'], ['notes-knowledge', 'notes-knowledge'], ['screen-recording', 'screen-recording'],
  ['productivity-utilities', 'productivity-utilities'], ['meeting-notes', 'meeting-notes'],
  ['ai-writing', 'ai-writing'], ['analytics', 'analytics'], ['voice-dictation', 'voice-dictation'],
  ['whiteboard', 'whiteboard'], ['read-it-later', 'read-it-later'], ['ai-audio', 'ai-audio'],
  ['ai-image', 'ai-image'], ['audio-video', 'audio-video'], ['ai-assistant', 'ai-assistant'],
  // consolidations — same pattern as Task 1's merge, applied to new upstream vocabulary
  ['docs-and-wiki', 'notes-knowledge'], ['docs-databases', 'notes-knowledge'],
  ['forms-and-surveys', 'forms'],
  ['bookmarks', 'read-it-later'], ['rss-research', 'read-it-later'], ['reading', 'read-it-later'],
  ['tasks-calendar', 'tasks'],
  ['diagrams', 'whiteboard'],
  ['ai-search', 'ai-assistant'],
  ['publishing', 'newsletter'],
  ['commerce', 'creator-commerce'],
  ['ai-video', 'ai-audio'], ['voice-ai', 'ai-audio'],
  ['generative-media', 'ai-image'],
  ['podcasting', 'audio-video'],
  ['writing-assistant', 'ai-writing'],
  ['waitlists', 'forms'], ['testimonials', 'forms'],
  ['link-in-bio', 'social-media'],
  ['qr-codes', 'productivity-utilities'],
  ['og-images', 'design'], ['screenshots', 'design'],
]);

function mapCategory(category, slug) {
  const target = CATEGORY_MAP.get(category);
  if (!target) {
    throw new Error(
      `"${slug}" : catégorie amont "${category}" non mappée — décider où elle va dans notre ` +
      'taxonomie (catégorie existante, ou nouvelle catégorie créée dans data/categories.json ' +
      'avec emoji + 7 langues) puis ajouter l\'entrée à CATEGORY_MAP. Voir docs/import-report.md.'
    );
  }
  return target;
}

// ---------------------------------------------------------------------------
// the two halves
// ---------------------------------------------------------------------------
function buildToolFact(entry, pool) {
  const fact = {
    slug: entry.slug,
    name: entry.name,
    domains: buildDomains(entry),
    category: mapCategory(entry.category, entry.slug),
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
  fact.relatedSlugs = computeRelatedSlugs(entry, pool);
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

  // relatedSlugs pool: everything already on disk (prior batches, hand-
  // curated entries) plus this run's own selection — the union guaranteed to
  // exist in data/tools/ once this run finishes. Existing tools already have
  // {slug, category, pagePriority}; upstream entries use the same field
  // names, so no reshaping is needed.
  // The pool feeds relatedSlugs' same-category matching (computeRelatedSlugs /
  // upstreamLinkIsCoherent), which compares .category fields directly. Existing
  // on-disk tools already carry our normalized category slugs; upstream
  // entries in `selected` still carry raw upstream category strings. Without
  // normalizing here, a merged category (e.g. upstream's "voice-ai" -> our
  // "ai-audio") would silently fail to match its already-imported peers.
  const pool = new Map(existing.tools);
  for (const e of selected) {
    // Entries that will later turn out ineligible (manual exclusion, bad
    // pricing, a category not yet mapped) still need a pool entry so
    // relatedSlugs computation for OTHER entries in the batch doesn't crash
    // on a missing lookup — but they'll never be written, so an unmapped
    // category here is harmless: it just won't match anything.
    let category = e.category;
    try { category = mapCategory(e.category, e.slug); } catch { /* left raw, see comment above */ }
    pool.set(e.slug, { ...e, category });
  }
  const domainsSeen = new Set(existing.domains);

  let wroteFacts = 0;
  let wroteDrafts = 0;
  let skippedFacts = 0;
  let skippedDrafts = 0;

  for (const entry of selected) {
    const factPath = join(dataDir, 'tools', `${entry.slug}.json`);
    const i18nPath = join(dataDir, 'i18n', 'en', 'tools', `${entry.slug}.json`);

    // The i18n draft must never be written for a slug that doesn't (or won't)
    // have a fact file — validate-rules.mjs rejects an i18n entry with no
    // matching data/tools/<slug>.json. factWillExist tracks whether a fact
    // file exists after this iteration, either already on disk or just
    // written; it's what gates the i18n draft below.
    let factWillExist = false;

    if (existsSync(factPath)) {
      console.log(`= ${entry.slug} : data/tools déjà présent, inchangé.`);
      skippedFacts += 1;
      factWillExist = true;
    } else {
      const check = eligibility(entry, existing);
      if (!check.ok) {
        console.log(`! ${entry.slug} : ignoré (${check.reason}).`);
        skippedFacts += 1;
      } else {
        const fact = buildToolFact(entry, pool);
        const collided = fact.domains.filter((d) => domainsSeen.has(normalizeDomain(d)));
        if (collided.length) {
          console.log(`! ${entry.slug} : ignoré (domaine(s) déjà revendiqué(s) dans ce lot : ${collided.join(', ')}).`);
          skippedFacts += 1;
        } else {
          for (const d of fact.domains) domainsSeen.add(normalizeDomain(d));
          await writeJson(factPath, fact, args.dryRun);
          console.log(`+ ${entry.slug} : data/tools/${entry.slug}.json (relatedSlugs: ${fact.relatedSlugs.join(', ')})`);
          wroteFacts += 1;
          factWillExist = true;
        }
      }
    }

    if (!factWillExist) {
      console.log(`  (${entry.slug} : brouillon i18n non écrit — pas de fiche data/tools correspondante.)`);
      continue;
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
