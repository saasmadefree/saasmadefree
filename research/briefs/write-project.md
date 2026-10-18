# Brief: write a project page in English (B3)

## 1. Role and model
Sonnet 5.5. You write the English text of open-source project pages (`/en/oss/{slug}`). The reader pays for a SaaS
and wants to know if this project can replace it, and what it will not do. Facts first, your own words, no marketing.

## 2. Inputs
- `{{BATCH_ID}}`, `{{SLUGS}}` (project slugs, 10 at most).
- `data/projects/{slug}.json` (facts: repo, licence, stats, hosted, deploy, stack).
- The repo README and the official docs: fetch them yourself, today.
- `research/alternatives/*.json` entries that cite the project (context: `why`, `coreLoopCovered`).
- The tools that list it: `grep -l '"project": "{slug}"' data/tools/*.json`, and their `data/i18n/en/tools/*.json`.

## 3. Files you may write
- `data/i18n/en/projects/{slug}.json` (create).
- `data/projects/{slug}.json`: the `markets` key only, to add `"en"` if missing.
- `research/sources/projects/{slug}.json`.
- Your section in `research/data-issues/{{BATCH_ID}}.md` (append, headed `## {slug}`).
Nothing else. Never `scripts/`, `schema/`, `tests/`. Never run `git`. Never edit `stats`, `license`, `hosted`, `selfHostable*`.

## 4. Output schema (`schema/project-i18n.schema.json`, `additionalProperties: false`)
```json
{
  "tagline":     "string, 1–110 chars",
  "description": "string; validator: 120–320 words",
  "strengths":   ["3 to 6 strings"],
  "limits":      ["2 to 6 strings; write 2 to 5 (spec §5)"],
  "bestFor":     "string, one sentence"
}
```
Extra rules from `scripts/lib/validate-rules.mjs`: no placeholder (`TODO`, `TBD`, `FIXME`, `XXX`, `lorem ipsum`);
no banned phrase; once one language file exists, every language in the project's `markets` needs its file.
So add `"en"` to `markets`, never `"fr"` (that is `write-lang`'s job).

## 5. Content
- `tagline`: what it is, for whom. "Self-hosted newsletter and mailing list manager in a single Go binary."
- `description`: what it does, how you run it (deploy options from the docs), what it needs (database, SMTP, RAM if documented),
  which SaaS it replaces and how closely. Licence and hosting facts come from `data/projects/{slug}.json` and may be named in prose (Ruling 47); never write stars,
  creation dates or last-commit dates in prose (the page shows them live); do not restate stars
  or dates (the page shows live figures next to your text).
- `strengths`: concrete and checkable. "Imports subscribers from CSV with custom attributes", not "easy to use".
- `limits`: real and specific, taken from the docs, open issues or missing features. "No visual automation builder:
  sequences are written as campaign rules", not "may require technical knowledge". At least 2. This is what sets us apart.
- `bestFor`: one sentence that names a reader. "A solo creator with a VPS who sends a weekly newsletter to under 50,000 people."

## 6. Sourcing
Each factual claim gets an entry in `research/sources/projects/{slug}.json`:
`[{ "claim": "Runs as a single binary with PostgreSQL", "url": "https://listmonk.app/docs/installation/", "retrievedOn": "2026-10-18", "field": "description" }]`.
Every number (limits, sizes, prices, versions) has its own entry. No number from memory. If you cannot source a claim, drop it.
If the README contradicts our data (name, homepage, hosted offer, archived), do not fix it: report it in `data-issues`.

## 7. Writing rules (spec §7)
- Average sentence ≤ 25 words. Direct, verifiable, "dossier instruit" tone.
- No phrase from `data/style/banned-phrases.json` (the `en` list, matched as stems: "robust" also catches "robustness").
- Do not copy the vendor's sentences. Rewrite every line you read in the README.
- No em-dash chains (one `—` per paragraph at most), no systematic groups of three, no "not X but Y" filler,
  no "whether you're…", no closing summary sentence.

## 8. Self-check
- [ ] Word count of `description` between 120 and 320: `node -e "const d=require('./data/i18n/en/projects/<slug>.json');console.log(d.description.trim().split(/\s+/).length)"`.
- [ ] `tagline` ≤ 110 chars. 3–6 strengths, 2–5 limits, specific.
- [ ] Every number and every hard claim has a source line; the URL says it.
- [ ] Five random sentences: none appears verbatim on the project's site or README.
- [ ] `"en"` in `markets`; nothing else changed in `data/projects/{slug}.json`.
- [ ] `npm run validate 2>&1 | grep -E "projects/(slug1|slug2|…)\.json"`: fix every line that names your slugs; ignore the rest
  (validate runs on the whole repo).

## 9. Return contract
```
files: [paths written]
done: [slugs]   failed: [{slug, reason}]
validate: [error lines touching your slugs, or "none"]
open questions: […]
```

## Worked example (filled after L0 review)
TODO (controller): paste the reviewed `data/i18n/en/projects/listmonk.json` (or the first L0 project) and its sources file.
