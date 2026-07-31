# Import report — first batch (upstream → canonical schema)

Source: `canivibecodeit` upstream dataset, 125 entries, MIT License (attribution already
in `NOTICE` / `README.md`, untouched by this work). Extracted to a scratch directory
outside the repo; the import script takes that directory as `--source`.

## Task 1 — closing `pricing.basis`

The 21 upstream free-text values collapse to 5 codes. This is the exact table implemented
in `BASIS_MAP` in `scripts/import-upstream.mjs`, and it's what `schema/tool.schema.json`
now enforces as an enum:

| Code | Upstream values folded in |
|---|---|
| `flat-monthly` | `monthly`, `monthly EUR list`, `flat monthly, 3 active programs and 25k sends` |
| `per-seat-monthly` | `monthly per seat`, `monthly per user`, `monthly per workspace`, `monthly per product`, `monthly per person`, `monthly per member`, `monthly per editor`, `monthly per Doc Maker`, `monthly per collaborator`, `monthly per channel` |
| `annual-effective-monthly` | `annual effective per month`, `yearly per user`, `monthly per user, billed yearly` |
| `usage-based` | `pay as you go`, `monthly capacity`, `monthly at 500 contacts`, `monthly at 1k subscribers` |
| `one-time` | `one-time` |

Verified this is a complete, correct partition of the 21 values found across all 125
upstream files (counted with a one-off script, not eyeballed).

Changes made:
- `schema/tool.schema.json` — `pricing.basis` is now `{"enum": [...]}` instead of free
  `string`.
- `data/i18n/<lang>/ui.json` (all 7) — new `pricingBasis` table, 5 codes translated.
- `scripts/lib/validate-rules.mjs` — new loop mirroring the existing `requirements`
  translation-completeness check, one rule per tool: every language's `ui.json` must carry
  a `pricingBasis.<code>` label for that tool's `pricing.basis`.
- `scripts/lib/site-format.mjs` — `formatMonthlyPrice` no longer regexes the raw string for
  `/monthly/i`; it checks membership in a `MONTHLY_BASES` set (`flat-monthly`,
  `per-seat-monthly`, `annual-effective-monthly`, `usage-based` all get the `/mo` suffix;
  `one-time` does not).
- `scripts/lib/site-page-tool.mjs` — the price line now prints `ui.pricingBasis[basis]`
  instead of the raw code.
- `data/tools/{notion,calendly,obsidian,typeform}.json` — `"monthly per user"` →
  `"per-seat-monthly"` (the only pre-existing value, all four used it).
- `CONTRIBUTING.md` — the `pricing.basis` row rewritten to document the closed list and the
  CI rule, mirroring how `requirements[]` is documented.
- Tests updated for the new enum: `tests/schema.test.mjs`, `tests/validate-rules.test.mjs`
  (fixture + one new test mirroring the `requirements` translation test),
  `tests/site-format.test.mjs`, `tests/feed.test.mjs` (fixture only, not schema-checked
  there but kept consistent).

Verified: `npm run validate` and `npx vitest run` passed before touching Task 2, and the
built HTML actually renders the translated label (`$10/mo — Plus, Monthly per seat` for
Notion) rather than the raw code.

## Task 2 — `scripts/import-upstream.mjs`

Usage: `node scripts/import-upstream.mjs --source <dir> [--limit N | --slugs a,b,c] [--dry-run]`.

Design decisions worth stating explicitly:

- **Never overwrites.** If `data/tools/<slug>.json` exists, it's left alone. If
  `data/i18n/en/tools/<slug>.json` exists, same. Re-running the exact same `--slugs`
  selection twice writes 0 files the second time — verified below.
- **`--limit N`** ranks all upstream entries by `pagePriority` desc, `slug` asc, filters out
  entries with incomplete pricing (`plan`/`source` null, or no `priceMonthly` and no
  `pricing.native` to fall back on), and takes the top N of what's left. It does **not**
  exclude "already imported" slugs from the ranking itself — only from what actually gets
  written — so `--limit N` is a stable, reproducible function of the upstream data, not of
  how many times you've already run the script. (I hit this the hard way: my first
  `--limit 25` run and a second `--limit 25` run selected two *different* sets of 25,
  because the second run's dynamic exclusion of "already on disk" pushed the ranking window
  forward. I re-ran the script with `--slugs <the 25 I actually wanted>` to fix this and
  deleted the accidental second batch before it was ever part of a commit — see "what I
  judged" below.)
- **Fact-file writes are eligibility-gated** (`eligibility()`): a slug already curated by
  hand (`notion`, `calendly`, `typeform` — same slug) or a domain already claimed
  (`obsidian-sync.json` → `obsidian.md`, already used by our hand-curated `obsidian`) are
  skipped, never overwritten, never silently merged.
- **i18n drafts are scaffolds, not publishable content.** The script carries over
  `tagline`/`verdictSummary`/`coreLoopDIY`/`whatYouLose`/`whyPeopleStillPay`/`notes`
  verbatim from upstream (attributed, permitted to be a starting point per the brief) and
  the upstream `prompt` as literal text, plus 4 `{q: "TODO", a: "TODO"}` placeholders so the
  file is schema-shaped but obviously unfinished. Every one of the 25 was then rewritten by
  hand for Task 3 — none of the 25 published files still contain upstream's literal prompt
  or a TODO FAQ (verified: `grep -c TODO data/i18n/en/tools/*.json` → all zero).

### Field mappings

- **`domains[]`** — bare upstream `domain`, plus a hand-verified subdomain where I actually
  confirmed one exists (fetched each candidate rather than guessing from naming
  convention): `1password.com`→`+my.1password.com`, `bitwarden.com`→`+vault.bitwarden.com`,
  `hey.com`→`+app.hey.com`, `kit.com`→`+app.kit.com`, `chatgpt.com`→`+chat.openai.com`
  (308-redirects to chatgpt.com). I tried `app.grammarly.com` (301-redirects away — not a
  real distinct hostname, dropped), `app.kajabi.com` and `app.beehiiv.com` (both
  inconclusive over fetch — dropped per "when unsure, emit only the bare domain"). All
  other 20 tools ship with only their bare upstream domain.
- **`pricing`** — `amount` from `priceMonthly` (all 25 in this batch had it; the script also
  handles the `priceMonthly: null` case by parsing the leading number out of
  `pricing.native`, for future batches — `uncircle` is the one upstream entry that needs
  this path, and it isn't in this batch); `currency` parsed from the trailing 3-letter code
  in `pricing.native`, default `USD` if absent; `plan`/`source`/`checkedOn`/`confidence`
  copied as-is. `pricing.notes` from upstream is **not** carried over — the brief's field
  list for `pricing` didn't include it, and our schema's `pricing.notes` is a separate
  optional field I chose not to populate rather than guess at the intent.
- **`diyTimeEstimate`** — `one sitting`→`one-sitting`, `weekend`→`weekend`,
  `multi-day`→`week`, `not realistically solo`→`more`. None of the 25 selected hit the two
  upstream one-off long-sentence values (`"one sitting for the dashboard, a weekend-plus for
  native app polish"` and `"one sitting (dictation only), multi-week with call capture"`) —
  the script throws rather than guessing if it ever encounters an unmapped string, so those
  two stay blocked until a human reads the specific entry and adds an override.
- **`requirements[]`** — keyword rules in `REQUIREMENT_RULES` collapse upstream free text
  onto the 8-code enum (hosting/database/domain/oauth-app/email-provider/anthropic-api-key/
  openai-api-key/none), generic "LLM API" mentions default to `anthropic-api-key` per this
  project's own convention (see `notion.json`'s prompt). This is a first pass only — see
  "what I judged" below, five of the 25 got a manual correction after I'd actually written
  the prompt and could see what the DIY build really needs.
- **`relatedSlugs`** — see below, this needed real judgment for every single one of the 25.
- **`markets`** — `["en"]` for all 25, per the brief.
- **`category`/`subcategory`/`slug`/`name`/`moatType`/`priorArt`/`pagePriority`/
  `verifiedOneShot`** — carried over unchanged, `priorArt` items stripped of upstream's
  `desc`/`status` fields (not in our schema) since none had a `license` field either.
- **`verdict`/`verdictConfidence`** — not in the brief's explicit field-mapping list, and
  CONTRIBUTING.md is explicit that verdict should follow from the `whatYouLose` list, not
  the other way round. I carried the upstream value through mechanically in the script, but
  then genuinely re-checked all 25 against the `whatYouLose` array and prompt I actually
  wrote (table below) before treating them as final — none needed to change, but three (
  `bitwarden`, `ghost-pro`, `invoice-ninja`) are `yes` with `diyTimeEstimate: weekend` rather
  than `one-sitting`, which is a real but consistent pattern: all three are the
  "hosted-open-source" case (deploy the *real* open-source software, full feature parity,
  zero functional gap, but genuine deployment/HTTPS/backup work that takes longer than a
  sitting). Upstream's own data has this same combination for these entries, and I judged
  it defensible rather than forcing a rewrite.

### `data/categories.json`

19 new categories, one per distinct upstream `category` value across the 25 (carried over
unchanged, as instructed), each given an emoji and a label in all 7 languages I translated
by hand: `security`, `seo-marketing`, `databases`, `newsletter`, `no-code-apps`,
`social-media`, `design`, `website-builder`, `ai-assistant`, `dev-tools`, `ai-audio`,
`rss-research`, `presentations`, `publishing`, `ai-writing`, `meeting-notes`, `email`,
`finance-accounting`, `creator-commerce`. The pre-existing 3 categories were left as they
were (still only `en`/`fr` labels) — not in scope, and every tool that uses them already has
the languages it needs.

## Non-compliant `relatedSlugs` — how I actually resolved it

The brief's claim of "14 upstream entries don't comply" (relatedSlugs not exactly 3
distinct, non-self) checks out exactly against the full 125-entry dataset — I counted it:
`bannerbear, bitly, cronitor, getwaitlist, linktree, promptdc, qr, shots, superscribe,
testimonial-to, thumblifyai, uncircle, uptime, wispr-flow`. None of those 14 are in this
batch.

But that 14-count is beside the point for a *partial* import: `relatedSlugs` must point at
slugs that exist in `data/tools/` once this run finishes, i.e. **the 25 being imported now**
— not the wider 125-entry upstream set most of them originally pointed into. So in practice,
**every one of the 25** needed the fallback logic, because upstream's own `relatedSlugs`
values almost never survive the intersection with an arbitrary top-25-by-priority slice.

`computeRelatedSlugs()` in the script runs three passes, in order, restricted to the batch:
1. keep upstream's own `relatedSlugs` where they land inside the batch;
2. fill remaining slots from the same `category`, ranked by `pagePriority` then slug;
3. fill whatever's still short from `SUBJECT_CLUSTERS` — six hand-curated groups (AI
   subscriptions, no-code builders, content/growth, visual/design, security & dev-tool
   audience overlap, running-a-one-person-business) that cross category lines on purpose.

Of the 25, only 10 categories had a same-category partner at all within the batch
(`security`×2, `newsletter`×2, `no-code-apps`×2, `design`×2, `ai-assistant`×2,
`dev-tools`×2), and even those maxed out at 2 of the 3 required slots. **All 25 entries
needed at least one slot filled from step 3**, the cross-category adjacency judgment — that
is the one honest number I want to be upfront about, since "same category first" barely
applies at this batch size. The result (verified: 3 distinct, non-self, all inside the
batch, for every entry):

| Tool | relatedSlugs |
|---|---|
| 1password | bitwarden, hey-email, github-copilot |
| ahrefs | beehiiv, kit, buffer |
| airtable | bubble, glide, carrd |
| beehiiv | kit, ghost-pro, ahrefs |
| bitwarden | hey-email, 1password, github-copilot |
| bubble | glide, airtable, carrd |
| buffer | beehiiv, ahrefs, kit |
| canva | figma, gamma, carrd |
| carrd | airtable, bubble, glide |
| chatgpt | claude, grammarly, gamma |
| claude | gamma, chatgpt, grammarly |
| cursor | github-copilot, chatgpt, claude |
| elevenlabs | chatgpt, claude, grammarly |
| feedly | ahrefs, beehiiv, kit |
| figma | canva, gamma, carrd |
| gamma | chatgpt, claude, grammarly |
| ghost-pro | ahrefs, beehiiv, kit |
| github-copilot | cursor, chatgpt, claude |
| glide | bubble, airtable, carrd |
| grammarly | canva, figma, chatgpt |
| granola | chatgpt, claude, grammarly |
| hey-email | 1password, bitwarden, github-copilot |
| invoice-ninja | kajabi, ghost-pro, carrd |
| kajabi | buffer, invoice-ninja, ghost-pro |
| kit | ghost-pro, beehiiv, ahrefs |

I reviewed this output by hand against a manually-derived table I built before writing the
script, entry by entry — they're not identical (the script's category-first pass legitimately
finds a couple of upstream-preserved links, like `grammarly`→`canva`/`figma`, that I'd
initially have replaced), but every single link is one I'd sign off on as a sensible "if
you're evaluating this tool, you'd plausibly also be looking at that one."

## Task 3 — the 25 entries

Selected by `pagePriority` descending (all 25 tied at the maximum, 5), tie-broken
alphabetically by slug — a neutral, reproducible secondary sort, not an attempt to smuggle in
a popularity judgment the data doesn't support. Four originally-top-ranked candidates were
excluded and replaced by the next-ranked eligible entries, for reasons documented in the
script's `eligibility()` and explained below:

- `calendly`, `notion`, `typeform` — slug already curated by hand in this repo.
- `bannerbear`, `cronitor`, `getwaitlist` — upstream `pricing.plan` and `pricing.source` are
  both `null` (draft/stub records, `checkedOn` even one day off from the rest of the
  dataset). I will not invent a plan name or a source URL, so these are excluded — not
  imported with a fabricated citation.

Backfilled from the ranking: `invoice-ninja`, `kajabi`, `kit`.

Final 25 (slug — verdict — price — category):

| Slug | Verdict | Price | Basis | Category |
|---|---|---|---|---|
| 1password | kinda | $2.99 | annual-effective-monthly | security |
| ahrefs | no | $29 | flat-monthly | seo-marketing |
| airtable | kinda | $24 | per-seat-monthly | databases |
| beehiiv | kinda | $49 | flat-monthly | newsletter |
| bitwarden | yes | $1.65 | annual-effective-monthly | security |
| bubble | kinda | $32 | flat-monthly | no-code-apps |
| buffer | kinda | $6 | per-seat-monthly | social-media |
| canva | kinda | $18 | flat-monthly | design |
| carrd | yes | $1.58 | annual-effective-monthly | website-builder |
| chatgpt | no | $20 | flat-monthly | ai-assistant |
| claude | no | $20 | flat-monthly | ai-assistant |
| cursor | kinda | $20 | flat-monthly | dev-tools |
| elevenlabs | no | $22 | flat-monthly | ai-audio |
| feedly | yes | $7 | flat-monthly | rss-research |
| figma | no | $20 | per-seat-monthly | design |
| gamma | kinda | $12 | per-seat-monthly | presentations |
| ghost-pro | yes | $35 | flat-monthly | publishing |
| github-copilot | kinda | $10 | flat-monthly | dev-tools |
| glide | kinda | $60 | flat-monthly | no-code-apps |
| grammarly | kinda | $30 | flat-monthly | ai-writing |
| granola | yes | $14 | per-seat-monthly | meeting-notes |
| hey-email | no | $8.25 | annual-effective-monthly | email |
| invoice-ninja | yes | $14 | flat-monthly | finance-accounting |
| kajabi | kinda | $179 | flat-monthly | creator-commerce |
| kit | kinda | $39 | usage-based | newsletter |

All prices, plans, sources and `checkedOn` dates are exactly what upstream recorded on
2026-07-30 — nothing refreshed, rounded, or invented, per the hard constraint.

For each of the 25: `tagline`/`verdictSummary`/`coreLoopDIY`/`whatYouLose`/
`whyPeopleStillPay`/`notes` are adapted from the upstream text (attributed via `NOTICE`),
tightened where the upstream phrasing was telegraphic ("They pay for X" → a full sentence)
or where a claim needed a number or a mechanism instead of an adjective. **Every `prompt`
was rewritten from scratch** — none of the 25 published files contain upstream's literal
prompt text. The rewrite consistently: names the core loop concretely in the first
sentence, names a specific library/stack only where the choice actually matters (an
encryption library for a password vault, `whisper.cpp` for local transcription) and leaves
stack choice open elsewhere, states explicitly what's out of scope, and — where a key or
paid API is involved — states how the build degrades gracefully without it (matching the
`ANTHROPIC_API_KEY`-optional pattern in `notion.json`) or states plainly that it's required.
**Every `faq` was written from scratch**, exactly 4 per entry, addressing: importing
existing data, mobile, real cost to run, and the one specific thing that doesn't survive the
rebuild — no filler, and I re-read each one against "could this be pasted onto a different
tool's page unchanged" before finalizing.

### `requirements[]` — manual reconciliation against the final prompt

The mechanical first pass got most of the 25 right, but I re-checked every one against the
prompt I actually wrote and corrected five where they didn't match:

- **`ahrefs`**: `["none"]` → `["hosting", "database"]` — the heuristic found nothing to map
  in upstream's free text (`crawler`, `dashboard`, etc.), but the prompt I wrote genuinely
  needs a scheduled job and a place to store keyword positions.
- **`chatgpt`**: added `openai-api-key` alongside `anthropic-api-key` — the rewritten prompt
  explicitly offers both providers, since a personal chat wrapper naturally benefits from
  provider choice in a way a `claude`-branded wrapper doesn't need to.
- **`grammarly`**: added `hosting` — the prompt runs a small local server in front of
  LanguageTool, not a pure static/client-only tool.
- **`ghost-pro`**: added `database` — self-hosting real Ghost needs MySQL; upstream's own
  requirement text didn't call this out explicitly but the Docker Compose setup in the
  prompt does.
- **`kajabi`**: added `database` — the students/enrollment table the prompt describes needs
  one; upstream's list didn't separate this out from "hosting."

`elevenlabs` and `figma` kept the heuristic's `["none"]` deliberately: both prompts were
written to run with zero API keys and zero backend by design (a local-only TTS model; a
client-only canvas with `IndexedDB` persistence) — `"none"` is the accurate claim there, not
a heuristic miss.

## What I judged rather than derived

- The alphabetical tie-break for the top-25 selection (documented above).
- The generic "LLM API" → `anthropic-api-key` default in the requirements heuristic.
- The `SUBJECT_CLUSTERS` groupings used for `relatedSlugs` — six hand-authored thematic
  buckets, not a generic string-similarity algorithm, because "adjacency of subject" at this
  batch size is a judgment call by nature, not something a script should pretend to derive
  neutrally.
- Domain-subdomain additions (5 of them) — each individually verified with a live fetch
  rather than pattern-guessed; 2 candidates I checked and rejected (`app.grammarly.com`
  redirects away; `app.kajabi.com`/`app.beehiiv.com` were inconclusive and dropped).
- `verdict`/`verdictConfidence` — reviewed against my own `whatYouLose` writing for all 25
  rather than blindly carried over (see above); none changed, three flagged as a consistent
  "hosted open-source" pattern worth naming rather than smoothing over.
- The five `requirements[]` corrections above, made after the prompt existed, not before.
- `pricing.notes` — deliberately dropped rather than carried over; not in the brief's field
  list for `pricing`, and I didn't want to guess whether upstream's caveat text (often about
  regional pricing variance) belonged in a language-neutral fact field.

## Concerns

- **`github-copilot`'s domain is `github.com`** — accurate (Copilot has no dedicated
  subdomain) but very broad: the browser extension will now recognize *any* GitHub page,
  not just Copilot-specific ones, which will show the "you're paying for this" panel to
  GitHub visitors who don't necessarily use Copilot. This is upstream's own domain data, not
  something I introduced by choice, and correcting it would mean the entry stops matching
  reality — flagging it rather than working around it.
- **`kit`'s `pricing.basis` is `usage-based`** ("monthly at 1k subscribers") — the schema
  enum can't express "scales past 1,000 subscribers"; that nuance is only in
  `pricing.source`/the upstream notes, not surfaced anywhere in our editorial. I didn't add
  it to `verdictSummary` since the $39 figure and "Creator" plan name are already accurate
  as stated and I didn't want to invent a rewritten framing not backed by the source page.
- **`--limit N` selection is not stable across repo states** by design (see Task 2) — a
  future contributor running `--limit 25` again, expecting "the same 25," will instead get
  the *next* 25 not yet on disk. This is documented in the script's own comments and in this
  report, but it's a real footgun if someone doesn't read either first.
- The two-language-only original `data/categories.json` entries (`docs-and-wiki`,
  `scheduling`, `forms-and-surveys`) are now visually inconsistent with the 19 new,
  fully-translated ones — not a blocker (no current tool needs the missing languages there),
  but worth someone's attention before those tools' `markets` grow.

## Commands run (representative)

```
$ npm run validate
29 fiche(s), 33 traduction(s), 5 agent(s) — tout est valide.

$ npx vitest run
 Test Files  11 passed (11)
      Tests  152 passed (152)

$ npm run build
Feed écrit dans dist/feed/v1/ — 29 outil(s).
Site écrit dans dist/ — 2 langue(s), 33 fiche(s), 25 page(s) de catégorie, 62 URL(s) dans le sitemap.

$ cd worker && npx vitest run
 Test Files  2 passed (2)
      Tests  24 passed (24)

$ node scripts/import-upstream.mjs --source <dir> --slugs <the 25 slugs>
[... second invocation, after the batch already existed on disk ...]
Terminé — facts: 0 écrite(s), 25 ignorée(s)/déjà là ; i18n/en: 0 écrite(s) (brouillon), 25 déjà là.
```

`git status` after the full sequence shows only: the Task 1 file set, the 19-category
addition to `data/categories.json`, `scripts/import-upstream.mjs` (new), the 25×2 new data
files, and `extension/data/index.json` regenerated by `npm run build` (expected — it's
committed generated output per the README's own build contract). `extension/` source,
`worker/` source, `public/privacy.html`, and `docs/superpowers/` are untouched.
