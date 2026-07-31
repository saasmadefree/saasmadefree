# Contributing to SaaS Made Free

This repository also contains extension and worker code, but most contributions touch the data under `data/`: a new tool entry, a better prompt, a new agent in the registry, a translation. Everything there is validated by the JSON Schemas in `schema/` plus the extra rules in `scripts/lib/validate-rules.mjs`, run together with `npm run validate`. That command is what makes it possible to accept outside contributions without re-reading every line by hand — read it before you write anything, so you know what will reject your PR.

## The verdict

`verdict` takes exactly three values, and they are a judgment call, not a marketing lever — the whole project's credibility rests on this being applied the same way from tool to tool.

- **`yes`** — a competent coding agent produces a usable personal version in one sitting, self-hosted, with no hard third-party dependency.
- **`kinda`** — buildable in a weekend, but with substantial gaps: mobile apps, real-time sync, third-party integrations, OAuth.
- **`no`** — the value isn't the code. It's the network, the data, the infrastructure, or the compliance behind the tool.

Run `npm run stats` for the live split (see the README's [honest number](README.md#the-honest-number)). Read it as a sanity check on your own entry, never as a target: **do not shift a verdict to move the distribution.** A directory that softens its verdicts to look more useful destroys the only thing it sells.

Write the honest `whatYouLose` list first, in the tool's i18n file, and let the verdict follow from that list — not the other way round. If the list names a hard third-party dependency the DIY build can't do without — a sending reputation, an index you don't have, a payment licence — then it isn't a `yes`, however small the code is.

## Anatomy of a tool entry

Two kinds of file per tool: one language-neutral fact file, and one editorial file per language the tool is published in.

```
data/tools/<slug>.json                  # facts, language-neutral
data/i18n/<lang>/tools/<slug>.json      # editorial, one file per language in `markets`
```

### `data/tools/<slug>.json` — field by field

| Field | Value | What it's for |
|---|---|---|
| `slug` | `^[a-z0-9][a-z0-9-]{0,63}$`, must match the filename | primary key — used by the extension's lookup table, the feed, and every `relatedSlugs` reference |
| `name` | free text | display name |
| `domains[]` | hostnames, e.g. `["notion.so", "notion.com", "app.notion.so"]` | every hostname the extension should recognize for this tool — include app subdomains, not just the marketing site. Domains are compared case-insensitively with `www.` stripped, and must be globally unique: the same domain can't appear under two tools, or the extension wouldn't know which entry to show. |
| `category` | a key from `data/categories.json` | groups tools on the site; add a new category there (with an emoji) if none of the existing ones fits |
| `subcategory` | free text, optional | a finer descriptor shown alongside the category |
| `pricing` | object, see below | the real, dated price |
| `verdict` | `yes` \| `kinda` \| `no` | see [The verdict](#the-verdict) |
| `verdictConfidence` | `high` \| `medium` \| `low` | how sure the editorial is, independent of the verdict itself |
| `moatType` | free text, e.g. `"collaboration"`, `"compliance"` | one or two words naming what actually makes the tool hard to replace |
| `diyTimeEstimate` | `one-sitting` \| `weekend` \| `week` \| `more` | how long a competent build realistically takes |
| `requirements[]` | closed list: `anthropic-api-key`, `openai-api-key`, `hosting`, `domain`, `database`, `oauth-app`, `email-provider`, `none` | what the DIY version needs to run. Every code used here must already have a translated label in all seven `data/i18n/<lang>/ui.json`, under `requirements.<code>` — CI rejects a PR that introduces a code without it. |
| `priorArt[]` | optional list of `{ name, url, license }` | existing open-source projects worth pointing readers to |
| `relatedSlugs` | exactly 3 existing, distinct slugs | see [Exactly four, exactly three](#exactly-four-exactly-three) |
| `markets[]` | subset of `en, fr, es, de, it, pt, nl` | which languages this entry is published in — each one needs a matching `data/i18n/<lang>/tools/<slug>.json` |
| `pagePriority` | integer, 0–10 | weight used by the site build for internal linking and ordering |
| `verifiedOneShot` | boolean | whether someone actually ran the prompt end to end and it produced a working result on the first try |

`pricing` is itself an object: `amount` (number ≥ 0), `currency` (ISO 4217, e.g. `"USD"`), `plan` (the plan's name), `basis` (closed list, see below), `source` (a URL), `checkedOn` (`YYYY-MM-DD` — CI rejects anything older than 180 days, because a stale price undermines the credibility the whole site depends on), `confidence` (`high` \| `medium` \| `low`), and an optional `notes`.

`pricing.basis` is a closed list, for the same reason `requirements[]` is: it's language-neutral data, and free text in it would print in English on every non-English page. The five codes: `flat-monthly` (a flat monthly fee, no per-seat or usage component), `per-seat-monthly` (per user, seat, member, workspace, channel or similar recurring unit, billed monthly), `annual-effective-monthly` (billed yearly, shown here as the effective monthly cost), `usage-based` (pay-as-you-go, credits, or a capacity tier), `one-time` (a single payment, not recurring). Every code used here must already have a translated label in all seven `data/i18n/<lang>/ui.json`, under `pricingBasis.<code>` — CI rejects a PR that introduces a code without it. Anything a code can't express — "at 1,000 subscribers," "3 active programs and 25k sends" — belongs in the editorial (`verdictSummary` or the FAQ), not in this field.

### `data/i18n/<lang>/tools/<slug>.json` — field by field

| Field | What it's for |
|---|---|
| `tagline` | one line, shown near the top of the entry |
| `verdictSummary` | the actual reasoning behind the verdict — this is what a skeptical reader checks first |
| `coreLoopDIY` | what the personal, self-hosted version actually does |
| `whatYouLose[]` | concrete, specific losses — not "some features," but "real-time collaborative editing" |
| `whyPeopleStillPay` | the honest answer, not a dismissal |
| `notes` | optional |
| `prompt` | the ready-to-use prompt for a coding agent, in this language. `en` is the reference version; other languages should track it. |
| `faq[]` | exactly four `{ q, a }` pairs — see below |

## Exactly four, exactly three

Both counts are enforced by the schemas (`schema/tool-i18n.schema.json` for `faq`, `schema/tool.schema.json` for `relatedSlugs`), and `npm run validate` fails a PR that violates either.

**`faq` — exactly four entries.** This project uses one rich entry per tool instead of several thin template pages ("replace X," "free alternative to X," "X open source," …). What keeps a single entry from reading as thin content is that it earns its length: four questions and answers that are actually specific to that tool, not generic filler. If a FAQ entry could be copy-pasted onto a different tool's page unchanged, it's the wrong entry.

**`relatedSlugs` — exactly three entries.** This is the internal linking that carries authority across what will eventually be several hundred pages. Making it optional is how it silently stops happening — every tool needs three concrete, sensible neighbors, not filler picked to satisfy the schema.

## Adding an agent to the registry

`data/agents.json` is the list of coding agents the extension can hand a prompt to. Each entry follows `schema/agent.schema.json`:

| Field | Value |
|---|---|
| `id` | kebab-case, ≤ 32 chars, unique |
| `name` | display name |
| `kind` | `url` \| `deeplink` \| `clipboard` |
| `template` | a URL template, required unless `kind` is `clipboard`. Only `{prompt}`, `{prompt_url}`, `{lang}`, `{slug}` are allowed — any other variable fails CI. No `eval`, no serialized functions, ever: the Chrome Web Store forbids remote code, and a whitelist of template variables is what keeps the registry configuration instead of code. |
| `homepage` | URL |
| `maxLength` | integer or `null` — character budget before the extension falls back to clipboard |
| `status` | `verified` \| `untested` \| `not-yet` |
| `verifiedOn` | date (`YYYY-MM-DD`), required once `status` is `verified` |
| `runHint` | kebab-case code, e.g. `cursor-deeplink` — the short instruction shown to the user ("paste it into Cursor," "run `claude` and paste it") |
| `docs` | URL or `null` |

A new `runHint` needs translation in two places, and only one of them is caught by CI:

1. **`data/i18n/<lang>/ui.json`, in all seven languages**, needs a `runHints.<runHint>` entry. `npm run validate` fails the PR if any of the seven is missing it.
2. **`extension/_locales/<lang>/messages.json`, in all seven languages**, needs a `runHint_<runHint_with_underscores>` entry — hyphens become underscores (the popup does this conversion itself: `agent.runHint.replace(/-/g, '_')`). **This one is not checked by `npm run validate`.** Chrome only accepts message names matching `[A-Za-z0-9_@]`; a single hyphen in a message key doesn't just fail to load that one key, it fails the *entire* message bundle for that language, silently, the moment the extension tries to load it. Grep for the exact key you added across every `messages.json` before opening the PR, and load the extension unpacked to confirm the popup still renders in each language.

## Proposing a better prompt

Prompts live in `data/i18n/<lang>/tools/<slug>.json`, under `prompt` — one per language, with `en` as the reference version. To improve one: edit the field, run `npm run validate`, and explain in the PR description what was wrong with the old prompt and what changed — scope that was missing, a stack choice that didn't build cleanly, an instruction an agent misread. If you actually ran the new prompt through an agent and it produced a working result, say so and set `verifiedOneShot: true` on the tool's fact file.

## Before opening a pull request

```
npm run validate
```

must pass. It's the exact check CI runs on every PR (`.github/workflows/ci.yml`), and it's the reason this project can accept outside contributions without re-reading every line by hand: the rules above — domain uniqueness, related-slug existence, FAQ count, translation completeness, price freshness — are enforced mechanically, not by trust.
