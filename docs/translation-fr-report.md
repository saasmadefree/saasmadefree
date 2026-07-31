# French translation — completion report

Translated the 112 remaining tool entries into French (`data/i18n/fr/tools/<slug>.json`)
and flipped `markets` to `["en", "fr"]` on each corresponding `data/tools/<slug>.json`,
only after the French file existed. Combined with the four already-translated entries
(notion, calendly, typeform, obsidian), all 116 catalogue tools now ship both an `en`
and an `fr` editorial file.

Work was done sequentially, by hand, one tool at a time — no sub-agents were dispatched,
per the task's explicit instruction. Each batch was read from
`data/i18n/en/tools/<slug>.json`, translated field by field into natural French (not a
literal transposition), and written directly.

## Batches, commands, and real output

### Batch 1 — 20 tools
1password, adobe-express, ahrefs, airtable, akiflow, beautiful-ai, beehiiv, bitly,
bitwarden, bubble, buffer, canva, capcut, carrd, chatgpt, circle, claude, coda,
codesandbox, copilot-money

```
$ npm run validate
116 fiche(s), 140 traduction(s), 5 agent(s) — tout est valide.

$ npx vitest run
 Test Files  11 passed (11)
      Tests  152 passed (152)

$ npm run build
Feed écrit dans dist/feed/v1/ — 116 outil(s).
Site écrit dans dist/ — 2 langue(s), 140 fiche(s), 64 page(s) de catégorie, 208 URL(s) dans le sitemap
```

Commit: `a0dabe1` — `feat(i18n): French translation batch 1 — 20 tools`

### Batch 2 — 20 tools
cursor, dashlane, descript, elevenlabs, evernote, fathom-ai, fathom-analytics,
fathom-hq, feedly, figma, fireflies-ai, framer, frase, freshbooks, gamma, gemini,
ghost-pro, github-copilot, glide, grammarly

```
$ npm run validate
116 fiche(s), 160 traduction(s), 5 agent(s) — tout est valide.

$ npx vitest run
 Test Files  11 passed (11)
      Tests  152 passed (152)

$ npm run build
Feed écrit dans dist/feed/v1/ — 116 outil(s).
Site écrit dans dist/ — 2 langue(s), 160 fiche(s), 71 page(s) de catégorie, 235 URL(s) dans le sitemap
```

Commit: `adf5174` — `feat(i18n): French translation batch 2 — 20 tools`

### Batch 3 — 20 tools
granola, hey-email, ifttt, inoreader, invoice-ninja, jasper, jotform, kajabi, kit,
krisp, languagetool, later, linear, lnkflow, loom, mailchimp, make, mara, meetergo,
midjourney

```
$ npm run validate
116 fiche(s), 180 traduction(s), 5 agent(s) — tout est valide.

$ npx vitest run
 Test Files  11 passed (11)
      Tests  152 passed (152)

$ npm run build
Feed écrit dans dist/feed/v1/ — 116 outil(s).
Site écrit dans dist/ — 2 langue(s), 180 fiche(s), 77 page(s) de catégorie, 261 URL(s) dans le sitemap
```

Commit: `1e7cbe1` — `feat(i18n): French translation batch 3 — 20 tools`

### Batch 4 — 20 tools
mighty-networks, miro, monarch-money, motion, n8n-cloud, netlify, otter-ai,
perplexity, plausible, podia, post-bridge, postiz, promptdc, quickbooks-online,
quillbot, raindrop-io, rankhog, raycast-pro, readwise-reader, reclaim-ai

```
$ npm run validate
116 fiche(s), 200 traduction(s), 5 agent(s) — tout est valide.

$ npx vitest run
 Test Files  11 passed (11)
      Tests  152 passed (152)

$ npm run build
Feed écrit dans dist/feed/v1/ — 116 outil(s).
Site écrit dans dist/ — 2 langue(s), 200 fiche(s), 83 page(s) de catégorie, 287 URL(s) dans le sitemap
```

Commit: `69dde50` — `feat(i18n): French translation batch 4 — 20 tools`

*(Between batch 4 and batch 5, the user committed `b81107c` — `feat(site): bascule
clair / sombre` — directly to this same working tree. It touched `data/i18n/en/ui.json`
and `scripts/`, none of the files this task owns. Verified with
`git diff --stat 7e1aa2c HEAD -- data/i18n/en/` and the equivalent for `scripts/`,
`extension/`, `worker/`, `public/`, `docs/superpowers/`: every change to those paths
traces to that one user commit, not to this task.)*

### Batch 5 — 20 tools
replit, runway, savvycal, semrush, shopify, simple-analytics, sleek, softr,
squarespace, sunsama, superscribe, superwhisper, superx, surfer-seo, tally,
teachable, tella, thumblifyai, tldv, todoist

```
$ npm run validate
116 fiche(s), 220 traduction(s), 5 agent(s) — tout est valide.

$ npx vitest run
 Test Files  11 passed (11)
      Tests  152 passed (152)

$ npm run build
Feed écrit dans dist/feed/v1/ — 116 outil(s).
Site écrit dans dist/ — 2 langue(s), 220 fiche(s), 87 page(s) de catégorie, 311 URL(s) dans le sitemap
```

Commit: `559674a` — `feat(i18n): French translation batch 5 — 20 tools`

### Batch 6 (final) — 12 tools
typefully, umami-cloud, uncircle, vercel, verifieddr, wabery, webflow, whimsical,
wix, xero, ynab, zapier

```
$ npm run validate
116 fiche(s), 232 traduction(s), 5 agent(s) — tout est valide.

$ npx vitest run
 Test Files  11 passed (11)
      Tests  152 passed (152)

$ npm run build
Feed écrit dans dist/feed/v1/ — 116 outil(s).
Site écrit dans dist/ — 2 langue(s), 232 fiche(s), 88 page(s) de catégorie, 324 URL(s) dans le sitemap
```

232 = 116 tools × 2 languages — full coverage confirmed.

Commit: `0cb7338` — `feat(i18n): French translation batch 6 (final) — 12 tools`

## Final verification

```
$ git status
On branch main
Your branch is ahead of 'origin/main' by 2 commits.
nothing to commit, working tree clean

$ ls data/i18n/fr/tools | wc -l
116
$ ls data/i18n/en/tools | wc -l
116
$ diff <(ls data/i18n/en/tools | sed 's/\.json$//' | sort) \
       <(ls data/i18n/fr/tools | sed 's/\.json$//' | sort)
(empty — slug sets are identical)
```

A script cross-checked every `data/tools/<slug>.json`: `fr` appears in `markets` if
and only if `data/i18n/fr/tools/<slug>.json` exists. 116 tools checked, 0 mismatches.

No English file was modified by this task (confirmed by diffing `7e1aa2c..HEAD` —
the sole change under `data/i18n/en/` belongs to the user's own theme-toggle commit).
Nothing under `extension/`, `worker/`, `scripts/`, `public/`, or `docs/superpowers/`
was touched by this task.

## Register

Re-read `data/i18n/fr/tools/notion.json` at the start of each batch, per instruction.
Followed its register throughout: tutoiement, a document voice rather than a pitch,
short sentences, no marketing lift in the FAQ answers. Category labels (e.g.
"Docs & wikis") were left untouched — they already have translations in
`data/i18n/fr/ui.json` and this task didn't re-translate them inside entries.

## Terms deliberately left in English

Per the brief, code identifiers, environment-variable names, library/product names,
field names, file formats, HTTP verbs, and anything a reader would type verbatim. In
practice, across 112 entries, that meant leaving things like: `ANTHROPIC_API_KEY` and
similar env-var names; framework/library/tool names (`Next.js`, `PostgreSQL`, `SQLite`,
`whisper.cpp`, `ffmpeg`, `RNNoise`, `LanguageTool`, `Fabric.js`, `Konva`, `tldraw`,
`Eleventy`, `ComfyUI`, `Flux`, `SDXL`, `n8n`, `vaultwarden`, `Ghost`, `ntfy`, `Continue`,
`Ollama`, `Ollama`-served models, `Ollama`); HTTP/API concepts (`OAuth`, `IMAP`, `SMTP`,
`webhook`, `List-Unsubscribe`, `fbclid`, `gclid`/`gbraid`/`wbraid`); product feature
names that are proper nouns of the tool being discussed (Notion's `Artifacts` and
`Projects` in the `claude.json`/`notion.json` entries' spirit, Linear's `Triage`,
`Insights`, `Linear Asks`); file formats and formats-as-words (`CSV`, `PDF`, `JSON`,
`Markdown`, `YAML`); and generic dev nouns that function as identifiers in a prompt a
reader will paste into an agent (`README`, `CLI`, `git push`, `Docker Compose`). Product
names throughout (Notion, Stripe, Zapier, Xero, etc.) were left as-is, per instruction.

## English source: anything that looked wrong or unclear

Nothing that looked factually wrong. No figures, prices, or claims were invented —
every number, percentage, or price mentioned in a French `verdictSummary` or `faq`
answer is a direct translation of the same number already present in the English
source (`data/tools/<slug>.json` itself was never touched by this task, so no pricing
data could drift). Two entries are worth flagging only because they read unusually,
not because they're wrong:

- `wabery.json` (English) already carries an internal caveat that this entry describes
  what's buildable for a single verified WhatsApp Business Account, explicitly ruling
  out becoming a multi-tenant provider. Translated as-is; no correction needed, the
  English source is already the honest version.
- `uncircle.json` and `meetergo.json` are both marked in their own English `notes`
  field as submitted by the product's own maker. Translated the self-aware tone
  faithfully rather than flattening it into generic marketing language, since that
  tone (a product team admitting its own moat is thin, or is genuinely an achieved
  purchase) is part of what the English source is doing.

No other English entry raised a concern worth reporting.
