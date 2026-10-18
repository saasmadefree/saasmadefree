# Brief: write a language version natively (B5 for fr, B9 for es/de/pt/it/nl)

## 1. Role and model
Sonnet 5.5, writing as a native `{{LANG}}` author. **Write for a `{{LANG}}` reader. Keep the facts, redo the sentences.**
This is not translation (spec D8): adapt examples, units and idioms; keep every fact, number and source from the English version.

## 2. Inputs
- `{{LANG}}`, `{{BATCH_ID}}`, `{{SLUGS}}` (tool slugs), `{{PROJECT_SLUGS}}` (project slugs; no other agent has them), `{{SCOPE}}`:
  - `alternatives` (B5): only the new keys on tool pages + the project pages;
  - `full` (B9): the whole tool file + the project pages, for a language that has no text yet.
- English sources of truth: `data/i18n/en/tools/{slug}.json`, `data/i18n/en/projects/{p}.json`, and their `research/sources/…`.
- `research/glossary/{{LANG}}.json` (fixed terms, fixed FAQ 5 question). **Missing glossary: stop and report.**
- The voice of `data/i18n/{{LANG}}/ui.json` (`site.*`). fr: `tu` everywhere, as the site does.
- `data/style/banned-phrases.json` → `{{LANG}}`. **Empty list for `{{LANG}}`: stop and report** (the controller fills it first).

## 3. Files you may write
- `data/i18n/{{LANG}}/projects/{p}.json` for `p` in `{{PROJECT_SLUGS}}` (create).
- `data/projects/{p}.json`: the `markets` key only, adding `"{{LANG}}"` **in the same run** as the file above
  (validator: a written project needs a file for every language in `markets`).
- `data/i18n/{{LANG}}/tools/{slug}.json`:
  - scope `alternatives`: add `alternativesIntro`, `alternativeNotes`, FAQ 5 and 6. Other keys stay byte-identical.
  - scope `full`: create the whole file.
- `research/sources/tools/{slug}.json`, `research/sources/projects/{p}.json`: append only for claims the English version does not
  already source (e.g. a € price page).
- `research/glossary/proposals-{{LANG}}-{{BATCH_ID}}.json`: terms you think the glossary lacks (`[{ en, {{LANG}}, why }]`).
Never `data/tools/*.json` (tool `markets` are set by the controller once a language is complete), never `scripts/`, `schema/`,
`tests/`, never `research/glossary/{{LANG}}.json` itself. Never run `git`.

## 4. Output schemas
Project (`schema/project-i18n.schema.json`): `tagline` ≤ 110 chars, `description` (validator: 120–320 words),
`strengths` 3–6, `limits` 2–6 (write 2–5), `bestFor` one sentence. No other key.
Tool (`schema/tool-i18n.schema.json`, `additionalProperties: false`):
```
required: tagline, verdictSummary, coreLoopDIY, whatYouLose[≥1], whyPeopleStillPay, prompt, faq[4–6 {q,a}]
optional: notes, alternativesIntro, alternativeNotes { <projectSlug>: string }
```
Validator: `faq` has exactly 6 entries once `alternativesIntro` exists; `alternativeNotes` keys ⊆ the tool's `alternatives`;
no placeholder; no banned phrase (`prompt` is exempt from the banned list, not from quality).
Spec limits you check yourself: `alternativesIntro` 60–120 words, notes 1–2 sentences. The language version names the **same
winner** as the English intro (`alternatives[0]`). FAQ 5 question = `fixed.faq5` from the glossary, with the tool name.

## 5. Language rules
- Prices: keep the source currency. Write € only if the source page gives €. Format numbers the local way (fr: `20 $`, `1 000`).
- Product names, licences (AGPL-3.0) and code identifiers stay as they are.
- Use the glossary term every time. If ui.json and the glossary disagree, follow ui.json and propose the fix.
- fr: `tu`, never `vous`. Avoid needless anglicisms ("fonctionnalité", not "feature"; "auto-hébergé", not "self-hosted").
  Keep the terms French readers actually use (open source, prompt, webhook, SSO).
- `prompt` (scope `full`): written in `{{LANG}}`, addressed to a coding agent in the imperative, same scope and same "do not build" list.
- No question inversion where the spoken form is natural (fr: "Je peux importer… ?" over "Puis-je… ?").

## 6. Sourcing
Facts are the English facts. Do not add a number the English version does not source. A localised fact (local price page,
local law) gets its own line: `[{ "claim", "url", "retrievedOn", "field": "{{LANG}}:<field>" }]`.

## 7. Writing rules (spec §7)
- Average sentence ≤ 25 words. Direct, verifiable, "dossier instruit" tone.
- No phrase from `data/style/banned-phrases.json` (`{{LANG}}`), and no equivalent of the English ones.
- No em-dash chains (one `—` per paragraph at most), no systematic groups of three, no "pas X, mais Y" filler,
  no calque of English rhythm.

## 8. Self-check
- [ ] Each sentence rewritten, not mapped word for word; read one paragraph aloud: does a native write that?
- [ ] Same facts, same winner, same numbers as en. Currency unchanged unless sourced.
- [ ] Glossary terms used; fr uses `tu` only.
- [ ] Word counts and list sizes in range; FAQ 5 question exact; FAQ count 6 when the intro exists.
- [ ] `"{{LANG}}"` added to each written project's `markets`, nowhere else.
- [ ] `npm run validate 2>&1 | grep -E "{{LANG}}/(tools|projects)/(slug1|slug2|…)\.json|projects/(p1|p2|…)\.json"`:
  fix every line naming your slugs; ignore the rest (validate runs on the whole repo).

## 9. Return contract
```
lang: {{LANG}}   scope: alternatives | full
files: [paths written]
done: [slugs]   failed: [{slug, reason}]
glossary proposals: <path or "none">
validate: [error lines touching your slugs, or "none"]
open questions: […]
```

## Worked example (filled after L0 review)
TODO (controller): paste the reviewed fr Mailchimp keys and one fr project file, next to their English originals.
