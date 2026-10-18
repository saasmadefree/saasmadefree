# Brief: research alternatives (B2 step 1)

## 1. Role and model
Sonnet 5.5. You find the open-source projects that can replace each SaaS in `{{SLUGS}}`, and you collect
the evidence. You **propose**; you do not decide. Whether a repo is a real alternative is settled afterwards
by the controller through Jev and OpenAI Decisions (`research/README.md`). Do not filter out a plausible
candidate because you doubt it: give it a low `fitGuess` and let the decision API judge.

## 2. Inputs
- `{{BATCH_ID}}`, `{{SLUGS}}` (tool slugs, 10 at most).
- For each slug: `data/tools/{slug}.json`, `data/i18n/en/tools/{slug}.json` (read `coreLoopDIY`: it defines the core use).
- Existing `data/projects/*.json`: reuse a slug when the project already exists. Every migrated project
  has `fit: "partial"` by default and no text; treat the tool's current `alternatives` as candidates to re-check.
- Sources to search, in this order: awesome-selfhosted, `https://openalternative.co/alternatives/{slug}`,
  GitHub topics, r/selfhosted threads, alternativeto.net (open-source filter).

## 3. Files you may write
- `research/alternatives/{slug}.json` for each slug in `{{SLUGS}}`.
- Your own section in `research/data-issues/{{BATCH_ID}}.md` (create it if missing, append only, headed `## {slug}`).
Nothing else. No file under `data/`, `scripts/`, `schema/`, `tests/`. Never run `git`.

## 4. Output shape
```json
[
  {
    "slug": "listmonk",                     // existing data/projects slug, or a new one: ^[a-z0-9][a-z0-9-]{0,63}$
    "existing": true,                        // true if data/projects/{slug}.json exists
    "name": "Listmonk",                      // the CURRENT product name (see renames below)
    "repo": "knadh/listmonk",                // owner/name on GitHub, or null for another forge
    "homepage": "https://listmonk.app",      // the product site, not the GitHub page when a site exists
    "why": "Self-hosted newsletter and mailing list manager: lists, campaigns, templates, SMTP sending.",
    "fitGuess": "full",                      // full = covers the core loop | partial = part of it | niche = one use case
    "coreLoopCovered": "Lists, segments, campaign sending, unsubscribe handling. No visual automations.",
    "selfHostable": { "value": true, "source": "https://listmonk.app/docs/installation/", "checkedOn": "2026-10-18" },
    "hosted": { "exists": false, "source": "https://listmonk.app/", "checkedOn": "2026-10-18" },
    "deploy": ["docker", "binary"],          // lowercase tokens: ^[a-z0-9-]+$, from the install docs
    "stack": ["go", "vue", "postgresql"],    // lowercase tokens: ^[a-z0-9.+-]+$, from the repo
    "categories": ["newsletter"],            // keys of data/categories.json only
    "evidenceUrls": ["https://github.com/awesome-selfhosted/awesome-selfhosted#…", "https://openalternative.co/…"]
  }
]
```
Comments above are for you; the file is plain JSON. 6 to 12 candidates per slug.
- `hosted` when an official paid cloud exists: `{ "exists": true, "priceFrom": 9, "currency": "USD", "source": "<pricing page>", "checkedOn": "<today>" }`.
  `priceFrom` is the cheapest paid plan as written on the pricing page, in the currency shown. Not found: omit `hosted`.
- `selfHostable` and `hosted` are kept **only when you opened the source URL today**. Unverified: omit the key.
  The site shows "—" without a date and a source; a guess with a date would be worse than "—".
- Never write stars, last commit, creation date, archived status or licence. `npm run refresh:projects` does that.

## 5. Sourcing
Every candidate has at least one `evidenceUrls` entry that names it as an alternative to this SaaS or shows the
feature that covers `coreLoopDIY`. Every price and every self-hosting claim has its own URL. No number from memory.

## 6. Data issues to report (in `research/data-issues/{{BATCH_ID}}.md`, not fixed by you)
- **Duplicates**: two project slugs for one product. Known: `formbricks` / `formbricks-2`, `cal-com` / `cal-diy`.
  If one of your tools cites them, open both homepages and repos and state whether they are the same product, with URLs.
- **Renames**: the repo was renamed and `name` is stale. Known: `perplexica` (repo now `ItzCrazyKns/Vane`),
  `mprocs` (repo now `pvolok/dekit`), `klaro-js`. Give the current name with the URL that shows it.
  In your output, `name` is the current name; the slug stays as it is.
- Archived or abandoned repos you noticed, wrong categories, dead homepages.

## 7. Writing rules
`why` and `coreLoopCovered`: one factual sentence each, in English, your words, no marketing copy. No phrase from
`data/style/banned-phrases.json`.

## 8. Self-check
- [ ] 6 to 12 candidates per slug, each with ≥ 1 evidence URL that you opened.
- [ ] Existing slugs reused; new slugs do not collide with another product.
- [ ] No `stats`, `license`, star count or date other than `checkedOn` = today.
- [ ] `selfHostable` / `hosted` present only with a source opened today.
- [ ] `categories` exist in `data/categories.json`.
- [ ] Valid JSON: `node -e "JSON.parse(require('fs').readFileSync('research/alternatives/<slug>.json','utf8'))"`.
`npm run validate` does not read `research/`; it is not needed for this step.

## 9. Return contract
```
files: [research/alternatives/a.json, …, research/data-issues/{{BATCH_ID}}.md]
done: [slugs]   failed: [{slug, reason}]
open questions: [short lines, e.g. "notion: no full-fit candidate found"]
```

## Worked example (filled after L0 review)
TODO (controller): paste the reviewed `research/alternatives/mailchimp.json` here.
