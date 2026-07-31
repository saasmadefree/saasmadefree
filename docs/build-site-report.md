# Building the public site — report

Date: 2026-07-31. Repository: `saasmadefree` (branch `main`).

## What was built

A new generator, `scripts/build-site.mjs`, wired into `npm run build` right after
`scripts/build-feed.mjs`, produces a complete static directory site into `dist/` from
the same `loadData()` output the feed already uses. No new dependency, no framework —
plain Node ESM writing plain HTML/CSS/JS, matching the project's stated constraint.

New files:

- `scripts/build-site.mjs` — orchestrator: loads data, fetches live vote counts once,
  computes per-language datasets, writes every page, the shared CSS/JS assets and the
  sitemap.
- `scripts/lib/site-data.mjs` — pure data helpers: which languages actually have pages
  (`siteLanguages`), per-language tool/category subsets, the vote-count-first /
  pagePriority-fallback sort, and the live vote-count fetch (`fetchVoteCounts`, 6 s
  timeout, returns `null` — never a fabricated value — on any failure).
- `scripts/lib/site-format.mjs` — `Intl`-based money/date formatting and an
  English/French plural chooser (French: singular for 0 and 1, English: singular only
  at 1).
- `scripts/lib/site-html.mjs` — HTML escaping, JSON-LD script serialization (escapes
  `<` so a stray `</script>` inside data can never break out of the block), the shared
  page shell (`renderLayout`) with hreflang/canonical wiring and the language switcher,
  and the breadcrumb renderer.
- `scripts/lib/site-seo.mjs` — `Organization`, `WebSite`+`SearchAction`, `ItemList`,
  `FAQPage`, `BreadcrumbList` JSON-LD builders, and the sitemap XML writer.
- `scripts/lib/site-styles.mjs` — the one CSS file (`dist/assets/site.css`), extending
  `public/index.html`'s palette/typography/spacing rather than inventing a new look.
- `scripts/lib/site-table.mjs` — the tool-listing `<table>` partial shared by the home
  page and category pages.
- `scripts/lib/site-page-{home,tool,category,root}.mjs` — the four page templates.
- `scripts/assets/site.js` — the one client script (copied verbatim to
  `dist/assets/site.js`): instant search/filter over the already-rendered table,
  `?q=` pre-fill for the `SearchAction`, prompt copy-to-clipboard, and the vote button
  wired to the live API with a live re-fetch/re-sort of vote counts.
- `tests/site-data.test.mjs`, `tests/site-format.test.mjs`, `tests/site-html.test.mjs`,
  `tests/site-seo.test.mjs` — unit tests for the pure-logic modules above, following the
  project's existing pattern (`tests/feed.test.mjs` tests `scripts/lib/feed.mjs`
  directly rather than the whole build script).

Data/content changes:

- `data/categories.json` — added an editorial `label: {en, fr}` per category (there was
  no human-readable category name before, only an emoji + the raw slug).
- `data/i18n/en/ui.json`, `data/i18n/fr/ui.json` — added a `site` block with every
  string the site chrome needs (hero, verdict labels, table headers, FAQ/prompt/vote
  section labels, meta title/description templates). Written in the project's existing
  register: plain, no exclamation, informal "tu" in French, matching
  `data/i18n/fr/tools/*.json` and `data/i18n/fr/ui.json`.
- `public/robots.txt` — added `Sitemap: https://saasmadefree.com/sitemap.xml`.
- `public/index.html` **removed**. It was the pre-launch holding page at `/`. Once
  `build-site.mjs` runs (always, as part of `npm run build`), it unconditionally
  overwrites `dist/index.html` with the new root redirect page — so the old file in
  `public/` was copied to `dist/` by `build-feed.mjs`'s `cp('public', OUT)` and then
  immediately overwritten a few lines later. Keeping it would have left dead, misleading
  source in the repo (edits to it would silently have no effect). Its typography,
  palette, and copy voice were carried into `scripts/lib/site-styles.mjs` and the home
  page templates, per the brief ("keep that voice"). **This is a judgment call, not
  something explicitly requested — flagging it in case you'd rather keep the file
  around even though it's unused.**
- `package.json` — `build` script is now
  `node scripts/build-feed.mjs && node scripts/build-site.mjs`.

## Page inventory (current data: 4 tools, `en`+`fr` markets only)

| Page type | Count | Example |
|---|---|---|
| Root redirect | 1 | `/` (meta-refresh to `/en/`, visible links to both languages) |
| Home | 2 | `/en/`, `/fr/` |
| Tool entry | 8 | `/en/tools/notion`, `/fr/tools/notion`, … (4 tools × 2 languages) |
| Category | 6 | `/en/categories/docs-and-wiki`, … (3 categories × 2 languages) |
| Existing static (untouched) | 1 | `/privacy` |
| **Total HTML pages** | **18** | |

Plus `dist/sitemap.xml` (18 URLs — every page above except the root's own hreflang
variants are implied by the per-page `<link rel="alternate">`, not duplicated in the
sitemap) and `dist/assets/{site.css,site.js}`.

No number above is invented: 4 is `data.tools.size`; 2 languages is the actual union of
every tool's `markets`; 3 categories is the actual set of distinct `category` values in
use. If a fifth tool or a third market language is added to `data/`, these counts change
automatically — nothing is hardcoded in the generator.

## Honesty-rule decisions (vote counts)

- At build time, `fetchVoteCounts()` calls the live
  `https://votes.saasmadefree.com/feed/v1/votes.json` once (6 s timeout). On this run it
  answered: `{"calendly":1,"notion":1,"typeform":1}` (Obsidian absent = a genuine zero,
  not missing data).
- Sort: vote count descending when counts are known, tie-broken by `pagePriority`;
  entirely by `pagePriority` if the API didn't answer at all. Verified with a dedicated
  unit test (`sortTools` in `tests/site-data.test.mjs`) covering both cases plus the
  "absent slug = real zero" distinction.
- Display: a real number (including `0 votes`) is shown whenever the API answered for
  that tool. When it did **not** answer, the vote-count element is rendered empty/hidden
  (an em dash with a screen-reader-only "unavailable" label in the table, a `hidden`
  paragraph on the entry page) — never a fabricated `0`.
- At runtime, `scripts/assets/site.js` re-fetches the same endpoint on page load and
  updates/re-sorts the visible counts, and the vote button POSTs to
  `https://votes.saasmadefree.com/api/v1/vote` and reflects the real
  `{count, counted}` response. This is the one first-party exception to "no external
  requests" — it's the project's own documented vote backend (same one the extension
  already calls), not a third party, and the feature was explicitly requested
  ("a vote button wired to the live API", "live vote count"). Without JavaScript the
  page still shows a complete, already-sorted list with real embedded numbers (or
  nothing, honestly, if the build-time fetch failed) — no vote functionality is required
  to read the directory.
- The `WebSite`/`SearchAction` JSON-LD on the home pages targets `/{lang}/?q={...}`, and
  `site.js` actually reads `?q=` on load and pre-fills/filters the search box — so the
  schema claim is true, not aspirational markup.

## Commands run and their real output

```
$ npm run validate
4 fiche(s), 8 traduction(s), 5 agent(s) — tout est valide.

$ npx vitest run
 Test Files  11 passed (11)
      Tests  151 passed (151)

$ npm run build            # first run
Feed écrit dans dist/feed/v1/ — 4 outil(s).
Compteurs de votes récupérés en direct pour 3 slug(s).
Site écrit dans dist/ — 2 langue(s), 8 fiche(s), 6 page(s) de catégorie, 18 URL(s) dans le sitemap (https://saasmadefree.com).

$ npm run build            # second run, immediately after
Feed écrit dans dist/feed/v1/ — 4 outil(s).
Compteurs de votes récupérés en direct pour 3 slug(s).
Site écrit dans dist/ — 2 langue(s), 8 fiche(s), 6 page(s) de catégorie, 18 URL(s) dans le sitemap (https://saasmadefree.com).

$ git status --porcelain   # after both builds — identical both times
 M data/categories.json
 M data/i18n/en/ui.json
 M data/i18n/fr/ui.json
 M package.json
D  public/index.html
 M public/robots.txt
?? scripts/assets/
?? scripts/build-site.mjs
?? scripts/lib/site-*.mjs
?? tests/site-*.test.mjs
```

`dist/` never appears in `git status` — it's gitignored, as is
`worker/src/slugs.generated.mjs`; `extension/data/index.json` (which **is** tracked) did
not change between runs, since the underlying tool data didn't change. This is exactly
what CI's `git diff --exit-code` check (run after `npm run build`) requires, once the
source changes above are committed: nothing the build writes is a tracked file the build
itself needs to modify.

## Link and structure check (no browser — parsed the generated HTML directly)

Wrote a throwaway Node script (not committed) that, for every generated `.html` file:

- Extracted every `href="/…"` and confirmed it resolves to a real file under `dist/`
  (accounting for the `dir/index.html` convention used for `/en/`-style paths and the
  extensionless `dir/index.html` convention used for `/en/tools/notion`-style paths).
  **Result: 0 broken internal links across 18 pages.**
- Counted `<h1>` occurrences per page. **Result: exactly 1 on every page.**
- Parsed every `<script type="application/ld+json">` block with `JSON.parse`.
  **Result: 0 invalid blocks.**
- Checked hreflang reciprocity: for every `<link rel="alternate" hreflang="X" href="Y">`
  on page P, page Y must itself declare an alternate whose href is P's own canonical
  URL. **Result: 0 non-reciprocal links** (28 were flagged on the first pass — that was
  a bug in the *checker's* own path-normalization, not the site; fixed the checker to
  key on the page's own declared `<link rel="canonical">` instead of a
  filename-derived path, re-ran, 0 issues).
- Checked every `sitemap.xml` `<loc>` resolves to a real file. **Result: 0 broken.**
- A second pass checked: every `<html>` has a two-letter `lang`; no duplicate `id`
  within a page; every `<input>`/`<select>` with an `id` has a matching
  `<label for>`; every `<button>` and `<a>` has non-empty visible text.
  **Result: 0 issues.**
- Additionally, with a synthetic dataset (a tool published in `en` only, a category
  existing only in `fr`), re-ran `siteLanguages` / `toolsForLang` / `langsForCategory`
  directly and confirmed the asymmetric case behaves correctly (the English-only tool's
  page has no French alternate; the French-only category's language switcher would have
  a single entry and hide itself) — the current 4-tool, 2-language dataset can't
  exercise this path on its own, so this was checked with the real functions and a hand-built
  input instead of the live data.
- `node --check scripts/assets/site.js` — valid syntax. Brace-balance check on the
  emitted `dist/assets/site.css` — balanced (85/85).
- Grepped the emitted CSS for the patterns `.impeccable.md` explicitly forbids
  (`gradient`, `backdrop-filter`, `blur(`, `box-shadow`, card-grid
  `repeat(auto-fill…)`) and for `text-align:center` — none present.
- `diff` of `dist/privacy.html` against the committed `public/privacy.html` —
  byte-identical; `/privacy` still works exactly as before.

## What I could not verify without a browser

- Actual rendering: layout, responsive behavior at real viewport widths, whether the
  serif stack falls back sensibly on a machine without Iowan Old Style/Palatino, and
  whether `color-mix()` (used for the `<pre>` background tint) degrades acceptably on
  browsers that don't support it (it does fall back to no background, not to broken
  CSS — the declaration is simply dropped — but I have not seen it rendered).
- Actual keyboard navigation and screen-reader announcement behavior (focus order,
  whether `aria-live="polite"` status updates are announced as intended by real
  assistive technology). I verified the structural prerequisites (labels, landmarks,
  live regions, focus-visible outline in CSS, no positive tabindex, native interactive
  elements throughout) but not the experience itself.
- The live vote button and live re-fetch/re-sort behavior in an actual browser —
  verified by reading the JS logic and running the build-time fetch equivalent
  (`fetchVoteCounts`) successfully against the real endpoint, and unit-testing
  `fetchVoteCounts`'s error handling with mocked `fetch`, but not by clicking a real
  button in a real page.
- Whether Cloudflare Pages' clean-URL resolution actually serves
  `dist/en/tools/notion/index.html` at `/en/tools/notion` in production the way the
  canonical URLs assume — this matches the `dir/index.html` convention most static hosts
  (including Cloudflare Pages) resolve automatically, and it's the same convention the
  feed already uses for its URLs (`buildToolRecord`'s `url` field), but I have not
  deployed this.
- `npm run build:extension` reproducibility and the worker's own test suite were not
  re-run — out of scope for this task and untouched by these changes (only
  `data/categories.json` and `data/i18n/{en,fr}/ui.json` changed within `data/`, and
  neither feeds `extension/data/index.json`'s content, which was confirmed unchanged by
  `git status` after the build).

## Known limitation worth flagging

`tool.pricing.basis` (e.g. `"monthly per user"`) is core, non-localized data (it lives
in `data/tools/*.json`, not the per-language `data/i18n/*/tools/*.json`). The entry
page's price section prints it verbatim, so a French page's price line currently reads
e.g. *"4 $US/mois — Sync, monthly per user"* — the periodicity suffix (`/mois`) is
correctly localized, but the trailing `basis` phrase itself stays in English. I chose
not to invent a translation for free-text data the schema doesn't provide a translated
form for, rather than guess. If this is worth fixing, the real fix is adding a
translated `basis` (or a small enum) to the i18n schema, which is a data-model change
beyond this task's scope.

## Concerns / things worth a second look

- I added a `site` block to `data/i18n/{en,fr}/ui.json` and `label` to
  `data/categories.json`. Neither file has a JSON Schema in `schema/`, so these
  additions aren't validated by `npm run validate` beyond the existing
  presence-of-specific-keys checks in `scripts/lib/validate-rules.mjs` — I relied on
  manual review and the generator's own defensive check (it throws a clear error at
  build time, naming the missing file, if a language declared in some tool's `markets`
  lacks a `ui.site` block) rather than schema validation.
- The root page always redirects to `/en/` (per the brief: "serve the English home"),
  with a plain visible link to `/fr/` alongside it, rather than doing any
  `Accept-Language` negotiation — there's no server logic available on this static
  host to do better, and the brief was explicit about English.
- I deleted `public/index.html` (see above) — this is the one change that goes beyond
  literally "add a new script"; happy to restore it if you'd rather.
