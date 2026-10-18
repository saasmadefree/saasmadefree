# Brief: write the alternatives part of a tool page in English (B4)

## 1. Role and model
Sonnet 5.5. You add three keys to existing English tool pages: `alternativesIntro`, `alternativeNotes`, and FAQ 5 and 6.
The page answers "how do I stop paying for X?" with three honest ways: self-host a project, build your own with our
prompt, or keep paying. Your intro names a winner among the projects and says why, then is honest about the other two ways.

## 2. Inputs
- `{{BATCH_ID}}`, `{{SLUGS}}` (tool slugs, 10 at most).
- `data/tools/{slug}.json` (`alternatives`, already decided; `verdict`, `pricing`).
- `data/i18n/en/tools/{slug}.json` (existing text: keep its facts consistent, read `whatYouLose` and `verdictSummary`).
- For each listed project: `data/projects/{p}.json`, `data/i18n/en/projects/{p}.json`, `research/alternatives/{slug}.json`.

## 3. Files you may write
- `data/i18n/en/tools/{slug}.json`: add `alternativesIntro`, `alternativeNotes`, and append FAQ entries 5 and 6.
  **No other key changes.** FAQ 1–4 stay byte-identical. The controller checks the diff with `git diff --word-diff`.
- `data/tools/{slug}.json`: the order of `alternatives` only, and only under §5 rule "winner first".
- `research/sources/tools/{slug}.json` (create or append).
Nothing else. Never `scripts/`, `schema/`, `tests/`. Never run `git`.

## 4. Output schema (the keys you add, from `schema/tool-i18n.schema.json`)
```json
{
  "alternativesIntro": "string; spec: 60–120 words",
  "alternativeNotes": { "<projectSlug>": "string, 1–2 sentences" },
  "faq": [ "…4 existing {q,a}…", { "q": "What's the best free {name} alternative?", "a": "…" }, { "q": "…", "a": "…" } ]
}
```
Validator rules: once `alternativesIntro` exists, `faq` must have **exactly 6** entries; every key of `alternativeNotes`
must be a project in the tool's `alternatives`; no placeholder; no banned phrase. Word limits (60–120, 1–2 sentences)
are not checked by the validator yet: you check them.

## 5. Content
- `alternativesIntro`: first sentence names the best alternative and the reason ("The best free alternative to Mailchimp
  is Listmonk: it covers lists, segments and campaign sending on your own server."). Then what it lacks compared with the SaaS,
  one other option for a different reader, and when building your own or keeping paying is the better call (use `verdict`).
- **Winner first**: the project you name as best must be `alternatives[0]`. If it is not, reorder `alternatives`
  (keep `full` > `partial` > `niche` unless you justify a break) and add a source entry with `"field": "alternatives order"`
  explaining why.
- `alternativeNotes`: one entry per project in `alternatives`. What it covers of the SaaS, then what is missing.
  "Covers campaigns and lists; no drag-and-drop editor and no e-commerce sync."
- FAQ 5: the question is fixed: `What's the best free {name} alternative?` (with the tool's `name`). The answer agrees with the intro,
  in different words, 2–4 sentences.
- FAQ 6: a real question people ask about leaving this tool, not covered by FAQ 1–4. Good: "Can I keep my Mailchimp signup
  forms after moving to Listmonk?" Bad: "Why choose open source?", "Is it secure?".

## 6. Sourcing
Each factual claim gets an entry in `research/sources/tools/{slug}.json`: `[{ "claim", "url", "retrievedOn", "field" }]`.
Prices come from `data/tools/{slug}.json` `pricing` or `data/projects/{p}.json` `hosted`, with their `source`. Stars and dates:
don't write them (the table shows live figures). No number from memory.

## 7. Writing rules (spec §7)
- Average sentence ≤ 25 words. Direct and verifiable. Take a side: no "both are great", no "it depends on your needs" without saying on what.
- No phrase from `data/style/banned-phrases.json` (`en`). No vendor copy.
- No em-dash chains, no systematic groups of three, no "not X but Y" filler, no rhetorical questions in the intro.

## 8. Self-check
- [ ] Intro 60–120 words; first sentence names `alternatives[0]`.
- [ ] `alternativeNotes` keys = the `alternatives` slugs exactly; 1–2 sentences each.
- [ ] `faq.length === 6`; FAQ 1–4 unchanged; FAQ 5 question exact.
- [ ] Every number has a source line.
- [ ] `npm run validate 2>&1 | grep -E "tools/(slug1|slug2|…)\.json"`: fix lines naming your slugs; ignore the rest.

## 9. Return contract
```
files: [paths written]
done: [slugs]   failed: [{slug, reason}]
reordered: [{slug, newFirst, reason}]
validate: [error lines touching your slugs, or "none"]
open questions: […]
```

## Worked example (filled after L0 review)
TODO (controller): paste the reviewed Mailchimp keys (`alternativesIntro`, `alternativeNotes`, FAQ 5–6).
