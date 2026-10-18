# Brief: format and shape checks (Haiku)

## 1. Role and model
Haiku 5.5. You transcribe and you check. You never judge content: you do not decide whether a project is an
alternative, whether a SaaS is in scope, or which `fit` it gets. Those come from the decision log
(`research/decisions/`) and from the rules below. If an input is missing or ambiguous, stop on that slug and report it.

You run in one of two modes, given by the controller: `{{MODE}}` = `write-data` (B2 step 4) or `shape-check` (B3–B5, B7).

## 2. Inputs
- `{{BATCH_ID}}`, `{{SLUGS}}` (tool slugs), `{{PROJECT_SLUGS}}` (projects assigned to you; no other agent has them), `{{LANG}}` (shape-check only).
- `write-data`: `research/alternatives/{slug}.json`, `research/decisions/{slug}.json`, `data/tools/{slug}.json`, `data/projects/*.json`.
- `shape-check`: the files the writers listed in their return contract.

## 3. Files you may write
- `write-data`: `data/projects/{p}.json` for `p` in `{{PROJECT_SLUGS}}`, and the `alternatives` key of
  `data/tools/{slug}.json` for `slug` in `{{SLUGS}}`. No other key, no other file.
- `shape-check`: nothing. You return a report.
Never `scripts/`, `schema/`, `tests/`, `research/briefs/`. Never run `git`.

## 4. Mode `write-data`
**Which projects**: only candidates whose decision log says `kept` (Decisions probability ≥ 0.5). Ignore the rest.

**Final `fit`**: `fitGuess` from the research file if the Decisions probability is ≥ 0.8; otherwise `"partial"`.

**`data/tools/{slug}.json` → `alternatives`**: 3 to 8 entries `{ "project": "<slug>", "fit": "full|partial|niche" }`,
no duplicates, sorted `full` > `partial` > `niche`, then by `stats.stars` descending. Projects without `stats`
go last in their group (the controller re-sorts after `npm run refresh:projects`). Fewer than 3 kept: write what
exists and report it. Keep every other key of the tool file byte-identical (2-space indent, same key order).

**New `data/projects/{p}.json`** (schema `schema/project.schema.json`, `additionalProperties: false`):
```
required: slug, name, homepage (http(s) uri), repo ("owner/name" | null), selfHostable (bool),
          hosted, deploy[], stack[], categories[≥1], markets[≥1]
optional: license (only if already present: refresh fills it), selfHostableCheckedOn (YYYY-MM-DD),
          selfHostableSource (uri; required when selfHostableCheckedOn is set), stats (NEVER written by you)
hosted:   { "exists": false } | { "exists": false, "source", "checkedOn" }
          | { "exists": true, "priceFrom": number ≥ 0, "currency": "USD", "source", "checkedOn" }
deploy:   ^[a-z0-9-]+$ unique   stack: ^[a-z0-9.+-]+$ unique   categories: ^[a-z0-9-]+$, keys of data/categories.json
markets:  ["en"] for a new project (languages are added by the writers once the text exists)
```
Mapping from the research entry: `selfHostable.value` → `selfHostable`; `selfHostable.checkedOn` / `.source` →
`selfHostableCheckedOn` / `selfHostableSource` (both or neither). `hosted` is copied as is; missing → `{ "exists": false }`
with no date (the site shows "—"). Never invent a date or a source.

**Existing project**: add the new `categories` (union, no duplicates). Add `selfHostable*` and `hosted` dates/sources
only if the research entry carries them and the file has none. If the research `name` differs from the file
(renamed repo), update `name` only; never the slug. Do not touch `stats`, `license`, `markets`.
Duplicates (`formbricks-2`, `cal-diy`, …) are merged by the controller, not by you: report them.

## 5. Mode `shape-check`
For each file, list every failure as `path : field : problem`. Check:
- Project i18n: `tagline` ≤ 110 chars; `description` 120–320 words (split on whitespace); `strengths` 3–6; `limits` 2–5
  (schema allows 6, the spec says 5); `bestFor` one sentence.
- Tool i18n: `alternativesIntro` 60–120 words; `alternativeNotes` keys ⊆ the tool's `alternatives`, each 1–2 sentences;
  `faq` exactly 6 when `alternativesIntro` exists; FAQ 5 question is the fixed one (en: "What's the best free {name} alternative?",
  other languages: `research/glossary/{lang}.json` → `fixed.faq5`). The project named first in `alternativesIntro` is `alternatives[0]`.
- Compare i18n: `summary` 80–150 words; `pickAIf` and `pickBIf` 2–4; `faq` exactly 3.
- All prose: no stem from `data/style/banned-phrases.json` for that language (case-insensitive, `’` read as `'`; `prompt` exempt);
  no `TODO`, `TBD`, `FIXME`, `XXX`, `PLACEHOLDER`, `lorem ipsum`; average sentence ≤ 25 words; no more than one `—` per paragraph.
- fr: `tu`, never `vous` (outside quoted product UI).
- Every digit in prose has a matching claim in `research/sources/…` (report the number, do not judge the source).

## 6. Writing rules
You write no prose. Transcribe strings exactly.

## 7. Self-check, then validate
- [ ] Only allowed files and keys changed. JSON parses. Indent 2 spaces, trailing newline.
- [ ] `npm run validate 2>&1 | grep -E "(tools|projects)/(slug1|slug2|…)\.json"`: report only lines touching your slugs.
  Validate runs on the whole repo and may fail elsewhere; that is not yours to fix.

## 8. Return contract
```
mode: write-data | shape-check
files: [written paths]            # empty in shape-check
done: [slugs]   failed: [{slug, reason}]
report: ["path : field : problem", …]      # shape-check
validate: [error lines touching your slugs]
open questions: […]
```

## Worked example (filled after L0 review)
TODO (controller): one `write-data` diff for Mailchimp and one `shape-check` report.
