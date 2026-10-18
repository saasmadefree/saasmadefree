# Brief: write a comparison page (B7)

## 1. Role and model
Sonnet 5.5. You write `/{lang}/compare/{a}-vs-{b}` pages for pairs the controller already put in `data/compare.json`
(measured demand ≥ 30/month). The page **takes a side**: "pick A if…", never "both are great".

## 2. Inputs
- `{{BATCH_ID}}`, `{{LANG}}` (`en` first; `fr` is written natively after en is reviewed), `{{SLUGS}}` = pair keys `a-vs-b`.
- `data/compare.json` (the pair, `kindA`/`kindB`: `tool` or `project`).
- Each side: `data/tools/{x}.json` + `data/i18n/{{LANG}}/tools/{x}.json`, or `data/projects/{x}.json` + `data/i18n/{{LANG}}/projects/{x}.json`.
- Their `research/sources/…` files; official docs and pricing pages (fetch today).
- fr: `research/glossary/fr.json` and the voice of `data/i18n/fr/ui.json` (`tu`). For fr, the en file of the same pair is the
  source of facts; rewrite natively (see `write-lang.md` §5).

## 3. Files you may write
- `data/i18n/{{LANG}}/compare/{a}-vs-{b}.json` (create). The file name uses the orientation declared in `data/compare.json`.
- `research/sources/compare/{a}-vs-{b}.json`.
Never `data/compare.json` (the controller owns it), never another data file, never `scripts/`, `schema/`, `tests/`. Never run `git`.

## 4. Output schema (`schema/compare-i18n.schema.json`, `additionalProperties: false`)
```json
{
  "summary": "string; spec: 80–150 words, with an opinion",
  "pickAIf": ["2 to 4 strings"],
  "pickBIf": ["2 to 4 strings"],
  "faq": [ { "q": "…", "a": "…" }, { "q": "…", "a": "…" }, { "q": "…", "a": "…" } ]
}
```
Validator: exactly 3 FAQ entries; the pair `a-vs-b` must exist in `data/compare.json`; no placeholder; no banned phrase.
The word range of `summary` is not checked by the validator: you check it.

## 5. Content
- `summary`: who should pick which, and the deciding factor, in the first two sentences. Then the cost picture
  (SaaS price with its plan vs. hosting cost or hosted plan, from our data) and the main trade-off.
  For a tool vs. project pair, say plainly what you lose by leaving the SaaS (use its `whatYouLose`).
- `pickAIf` / `pickBIf`: concrete situations. "You send to under 10,000 contacts and have a VPS", not "you want flexibility".
  A side's list never repeats the other's in reverse.
- `faq`: 3 questions people type about this pair (migration, price at a given size, a missing feature). No generic
  "Which is better?" unless the answer names one.
- The table on the page already shows licence, stars, last commit and price: do not restate stars or dates.

## 6. Sourcing
Every claim gets `[{ "claim", "url", "retrievedOn", "field" }]` in `research/sources/compare/{a}-vs-{b}.json`.
Prices come from `pricing.source` / `hosted.source` or a pricing page you opened today. No number from memory.

## 7. Writing rules (spec §7)
- Average sentence ≤ 25 words. Direct, verifiable. One clear recommendation per reader type.
- No phrase from `data/style/banned-phrases.json` (`{{LANG}}`). No vendor copy.
- No em-dash chains, no systematic groups of three, no "not X but Y" filler. fr: `tu`.

## 8. Self-check
- [ ] `summary` 80–150 words and names a pick in its first two sentences.
- [ ] 2–4 items per pick list, concrete; 3 FAQ entries.
- [ ] Every number has a source line; prices match our data or a newer sourced page (then report the gap).
- [ ] `npm run validate 2>&1 | grep -E "compare/(pair1|pair2|…)\.json|compare\.json"`: fix lines naming your pairs; ignore the rest.

## 9. Return contract
```
lang: {{LANG}}
files: [paths written]
done: [pairs]   failed: [{pair, reason}]
price gaps: [{pair, side, ourPrice, foundPrice, url}]
validate: [error lines touching your pairs, or "none"]
open questions: […]
```

## Worked example (filled after L0 review)
TODO (controller): paste the reviewed `data/i18n/en/compare/mailchimp-vs-listmonk.json` once that pair exists.
