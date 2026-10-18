# research/

Working material for the Part B content pipeline (plan: `.superpowers/sdd/2026-10-17-seo-alternatives/partB.md`).
It is versioned so every published claim can be traced back to its source, but **the site build never
reads it**: `scripts/` loads `data/` only, and nothing under `research/` ships to `dist/` or to the feed.
What reaches the site goes through `data/`, `schema/` and `npm run validate`.

## Layout

| Path | Written by | Content |
|---|---|---|
| `briefs/*.md` | controller (Opus) | Instructions for each agent role. The controller fills `{{SLUGS}}`, `{{LANG}}`, `{{BATCH_ID}}`. |
| `glossary/{lang}.json` | controller, enriched by `write-lang` agents (proposals only) | Fixed term choices per language, aligned on `data/i18n/{lang}/ui.json`. |
| `keywords/{lang}.json` | controller (Semrush) | `{ "<slug>": { "alt", "alts", "free", "oss", "checkedOn" } }` |
| `priority.json` | controller | Batch order: `slug → score`. |
| `alternatives/{toolSlug}.json` | research agent (B2.1) | Candidate open-source projects for one SaaS, with evidence. |
| `decisions/{toolSlug}.json` | controller (B2.2) | Jev and OpenAI Decisions log: input, probability, threshold, outcome. |
| `sources/tools/{slug}.json` | tool writers | `[{ claim, url, retrievedOn, field? }]` for one tool page. |
| `sources/projects/{slug}.json` | project writers | Same, for one project. Separate folder because a slug can be both (`languagetool`). |
| `sources/compare/{a}-vs-{b}.json` | compare writers | Same, for one comparison. |
| `data-issues/{BATCH_ID}.md` | any agent (append its own section) | Duplicates, renamed repos, wrong categories: facts the controller must fix by hand. |
| `reviews/{BATCH_ID}.md` | Opus reviewer | Quality-gate verdict for a batch (`briefs/review-gate.md`). |
| `oa-candidates.txt`, `oa-triage-review.md` | controller (B8) | openalternative.co candidates and the `undetermined` list for the human. |

## Rules that hold everywhere

- Content agents write only the files their brief lists, for the slugs they were given. Two agents never share a slug.
- Content agents never touch `scripts/`, `schema/`, `tests/`, and never run `git`. The controller commits.
- `stats` (stars, dates, archived) and missing `license` values come only from `npm run refresh:projects`
  (GitHub API). No agent writes them from memory or from a web page.
- `hosted` and `selfHostable` show "—" on the site until they carry a date and a source
  (`hosted.checkedOn` + `hosted.source`, `selfHostableCheckedOn` + `selfHostableSource`).
- Every number in published text has a line in `sources/`. A batch with a missing source is rejected.

## Closed questions go to a decision API, never to a generative model

"Is this repo really an alternative to X?" and "Is this SaaS in scope?" are run by the controller, not by
Sonnet or Haiku (user rule of 15/10/2026):

1. Pre-sort with Jev (`mcp__jev__jev_classify`), batches of 100 or fewer, always with a `none` class
   (`undetermined`). Keep the item when the positive-class probability is ≥ 0.3, not when `classId` matches.
2. Positives and every `review` item go to OpenAI Decisions:
   `POST https://api.openai.com/v1/decisions`, body `{ model: "gpt-6-luna", input, questions: [{ type: "predicate" | "choice", name, instructions }] }`.
   Keep when `probability ≥ 0.5`. The key is read at run time from `~/Coding/ecommerce-data/.env.local`
   (`OPENAI…` line) and is never written to a file, a log or a brief.
3. Log every call in `decisions/{toolSlug}.json`. Below 0.5: rejected. Undetermined: human review.
