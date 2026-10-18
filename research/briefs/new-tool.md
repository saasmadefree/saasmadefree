# Brief: create a new tool page (B8 step 3)

## 1. Role and model
Sonnet 5.5. You create a complete tool page for a paid SaaS that the decision API already placed in scope (B8 step 1).
You do not re-decide scope: if your research shows the SaaS is free, one-time purchase or enterprise-only, stop on that slug
and report it. Your `verdict`, `verdictConfidence` and `diyTimeEstimate` are proposals: an Opus agent reviews each one (B8 step 4).

## 2. Inputs
- `{{BATCH_ID}}`, `{{SLUGS}}` (new tool slugs, 10 at most), each with its name and homepage from `research/oa-candidates.txt`.
- The vendor's site and pricing page (fetch today). `README.md` § "The honest verdict" (definitions of `yes` / `kinda` / `no`).
- Existing pages for tone and level of detail: `data/tools/mailchimp.json`, `data/i18n/en/tools/mailchimp.json`, `data/i18n/fr/tools/mailchimp.json`.
- `data/categories.json` (category keys), `data/tools/*.json` (for `relatedSlugs`, `domains` collisions, `moatType` wording).
- fr: `research/glossary/fr.json`, voice of `data/i18n/fr/ui.json` (`tu`).

## 3. Files you may write
- `data/tools/{slug}.json`, `data/i18n/en/tools/{slug}.json`, `data/i18n/fr/tools/{slug}.json` (create).
- `research/sources/tools/{slug}.json`. Your section in `research/data-issues/{{BATCH_ID}}.md`.
Nothing else: no project files, no `alternatives` (they come later through B2 → B5), no `scripts/`, `schema/`, `tests/`. Never run `git`.

## 4. Output schemas
`data/tools/{slug}.json` (`schema/tool.schema.json`, `additionalProperties: false`):
```
slug             ^[a-z0-9][a-z0-9-]{0,63}$, equals the file name
name, domains[]  domains unique across ALL tools (validator), ^[a-z0-9.-]+\.[a-z]{2,}$, no "www."
category         key of data/categories.json; subcategory: optional free string, lowercase ("email marketing")
pricing          { amount ≥ 0, currency ^[A-Z]{3}$, plan, basis, source (pricing page URL), checkedOn (today), confidence, notes? }
                 basis ∈ flat-monthly | per-seat-monthly | annual-effective-monthly | usage-based | one-time
                 confidence ∈ high | medium | low   (validator: checkedOn ≤ 180 days old)
verdict          yes | kinda | no        verdictConfidence: high | medium | low
moatType         short English phrase, same style as existing ones ("deliverability, growth network, and integrations")
diyTimeEstimate  one-sitting | weekend | week | more
requirements[]   ⊆ anthropic-api-key, openai-api-key, hosting, domain, database, oauth-app, email-provider, none
relatedSlugs     exactly 3 EXISTING tool slugs, not itself
markets          ["en", "fr"]   (validator: both i18n files must exist)
pagePriority     integer 0–10: use {{PRIORITY}} if given, else 4      verifiedOneShot: false
```
`data/i18n/{en,fr}/tools/{slug}.json` (`schema/tool-i18n.schema.json`): `tagline`, `verdictSummary`, `coreLoopDIY`,
`whatYouLose[]`, `whyPeopleStillPay`, `notes?`, `prompt`, `faq` with **4** entries. Do not write `alternativesIntro`,
`alternativeNotes` or FAQ 5–6: B4 adds them with the alternatives (validator: a 5-entry FAQ fails; 6 is reserved for B4).

## 5. Content
- `pricing`: the cheapest paid plan a solo user or small team would buy, as shown on the pricing page today. Annual-only price
  shown per month → `annual-effective-monthly`. Pricing hidden behind "contact sales" → report, do not guess.
- `verdict`: apply the README definitions literally. `yes` = a usable personal version in one sitting, no hard third-party
  dependency. `kinda` = a weekend, with named gaps. `no` = the value is network, data, infrastructure or compliance.
- `verdictSummary`: 2–3 sentences: what a rebuild gets you, and the one thing it cannot.
- `coreLoopDIY`: one sentence, the core loop a personal rebuild must cover. The decision API uses it later to judge alternatives.
- `whatYouLose`: 3–6 short noun phrases, specific to this product.
- `whyPeopleStillPay`: 1–2 sentences, the real reason, no flattery.
- `prompt`: imperative brief for a coding agent: scope, data model, the parts to build, an explicit "do not build" list, and
  what to say honestly in the README. Same depth as Mailchimp's.
- FAQ ×4: migration/import, mobile use, running cost, the one thing that does not survive the rebuild (adapt to the product).
- fr: written natively from the same facts (see `write-lang.md` §5): `tu`, glossary terms, prices in the source currency.

## 6. Sourcing
`research/sources/tools/{slug}.json`: `[{ "claim", "url", "retrievedOn", "field" }]`. Required lines: the price (pricing page),
every feature named in `whatYouLose`, and one line `"field": "verdict"` that justifies `verdict` + `diyTimeEstimate` in one
or two sentences with the URL that supports it. No number from memory.

## 7. Writing rules (spec §7)
- Average sentence ≤ 25 words. Direct, verifiable, "dossier instruit" tone. No vendor copy.
- No phrase from `data/style/banned-phrases.json` (`en`, `fr`; `prompt` is exempt from the check but not from good writing).
- No em-dash chains (one `—` per paragraph at most), no systematic groups of three, no "not X but Y" filler.

## 8. Self-check
- [ ] `domains` collide with no other tool: `grep -l '"<domain>"' data/tools/*.json` returns only yours.
- [ ] `relatedSlugs` are 3 existing slugs; `category` exists; `pricing.checkedOn` = today; `source` is the pricing page.
- [ ] en and fr files both present, 4 FAQ each, fr in `tu`.
- [ ] A `verdict` source line exists.
- [ ] `npm run validate 2>&1 | grep -E "tools/(slug1|slug2|…)\.json"`: fix lines naming your slugs; ignore the rest.

## 9. Return contract
```
files: [paths written]
done: [slugs]   failed: [{slug, reason}]       # e.g. "out of scope: free plan only"
verdicts: [{slug, verdict, verdictConfidence, diyTimeEstimate}]   # for the Opus review
validate: [error lines touching your slugs, or "none"]
open questions: […]
```

## Worked example (filled after L0 review)
TODO (controller): paste one reviewed L3 tool (three files plus its sources file).
