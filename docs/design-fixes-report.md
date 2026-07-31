# Three design fixes on the rendered pages — report

Date: 2026-07-31. Repository: `saasmadefree` (branch `main`). Scope respected:
`scripts/lib/site-*.mjs`, `scripts/assets/`, and `data/i18n/{en,fr}/ui.json` only. No file
under `data/tools`, `data/categories.json` or `data/agents.json` was touched — that data is
owned by the concurrent import agent (visible in the working tree as commit `e5a92db
refactor(data): merge duplicate/near-duplicate categories…`, already landed under me before
this work started, which is why the category count below is 33, not 44).

**`data/i18n/{en,fr}/ui.json` was not modified.** All three fixes reuse strings that already
existed (`themeToDark`/`themeToLight`, `nav.*`, `allChip`/`allCategoriesChip`,
`priceSourceLabel`/`priceCheckedLabel`, `priorArtHeading`/`licenseLabel`). No new
user-visible copy was needed, so there was nothing to read-modify-write.

**Pre-existing uncommitted change carried along.** `scripts/lib/site-table.mjs` and a
small, self-contained hunk of `scripts/lib/site-styles.mjs` (`.row-favicon`, the
`tbody th a{display:inline-flex…}` rule) were already modified and uncommitted in the
working tree before this task started — an inline favicon added to each table row, unrelated
to the three problems here. It doesn't conflict with anything below (different CSS region
entirely) and reverting it wasn't asked for, so it rides along in the same commit rather
than being discarded. `scripts/import-upstream.mjs` started showing as modified partway
through this session — that's the concurrent import agent working live in the same
checkout; it was left untouched and excluded from every commit below.

## Problem 1 — the header

**Files:** `scripts/lib/site-html.mjs`, `scripts/lib/site-styles.mjs`, `scripts/assets/site.js`.

- **Grouping.** The header markup now has three masses instead of one flat row: `.brand`
  on the left; `.header-groups` on the right containing `.nav-links` (Directory, Submit a
  tool, Source) and, separated by a `.header-controls` cluster with its own left border
  (`border-left:1px solid var(--rule)`, dropped below 34rem where it would sit alone), the
  language switcher, the theme toggle and the GitHub button. The border and the `gap`
  between clusters (1.75–2.25rem) do the grouping the brief asked for; nothing new was
  added to the DOM beyond one wrapping `<div class="header-controls">`.
- **Brand weight.** `.brand` moved from `font-weight:700;font-size:1rem` (identical
  register to a nav link) to `font-family:var(--sans);font-weight:800;font-size:1.2rem` —
  now visibly heavier than `.nav-links`.
- **Language switcher — quiet active state.** `.lang-switch [aria-current]` no longer sets
  `background:var(--ink);color:var(--paper)` (the filled block that read as a selection
  artefact). It's now a rounded pill container (`border:1px solid var(--rule);
  border-radius:999px`) holding compact items; the active one gets
  `background:color-mix(in srgb,var(--ink) 9%,transparent);font-weight:700` — a tint and a
  weight change, not a hard fill.
- **Theme toggle — icon only.** The `<span class="theme-text">` that held the visible
  label ("Light mode"/"Dark mode") was removed from the markup and from
  `scripts/assets/site.js`'s `render()` function. The button is now a fixed 2.1rem circle
  (`width/height:2.1rem;border-radius:999px`) holding only `.theme-icon` (the existing
  ◐/◑ glyph swap, untouched). The accessible name still comes from `aria-label`, which
  `site.js` sets on every toggle exactly as before; I additionally render a server-side
  default `aria-label` (from `ui.site.themeToDark`) so the button never has an empty
  accessible name even in the instant before JS runs — moot in practice since the button
  stays `hidden` until `enhanceThemeToggle()` reveals it (unchanged progressive-enhancement
  pattern), but a defensive improvement over the previous code, which only set `aria-label`
  from JS.
- **Narrow screens.** Both `.site-header` and `.header-groups`/`.header-controls` keep
  `flex-wrap:wrap`, so clusters drop to their own line rather than overflowing; nothing
  in the header has a fixed width, so no control can become unreachable. Not verified in
  an actual narrow viewport — see "What remains unverified."

No `prefers-color-scheme` / no-flash inline script / theme-toggle logic was touched beyond
removing the label span; the dark-mode variable overrides in `:root[data-theme]` and the
`@media (prefers-color-scheme:dark)` block are untouched.

## Problem 2 — too many category chips on the home page

**Files:** `scripts/lib/site-data.mjs`, `scripts/build-site.mjs`, `scripts/lib/site-page-home.mjs`.

- Added `topCategoriesByCount(tools, lang, limit = 12)` to `site-data.mjs`: counts tools
  per category for the language at hand, sorts by count descending with slug as a
  deterministic tiebreak, and returns the top `limit` slugs. Computed fresh from `tools`
  on every call — no cached or hardcoded list, so it stays correct as the concurrent
  import changes category shape and tool count.
- `scripts/build-site.mjs` now computes `topCategorySlugs = topCategoriesByCount(tools,
  lang, HOME_TOP_CATEGORIES)` (constant `HOME_TOP_CATEGORIES = 12`) alongside the existing
  `categorySlugs = categoriesForLang(tools, lang)` (unchanged, still every category for
  this language) and passes the new value to `renderHomePage`. `categorySlugs` keeps
  driving `/{lang}/categories/` and the per-category page loop, unaffected.
- `renderHomePage` in `site-page-home.mjs` now builds the chip row from `topCategorySlugs`
  instead of `categorySlugs`. The trailing "All categories →" chip is untouched and still
  links to `/{lang}/categories/`, which still lists all categories (33 today, will grow
  back as the import adds tools).
- Verified against the current (mid-import) catalogue: EN has 33 categories total; the
  chip row renders exactly 14 `<li>` — "All" + 12 top categories + "All categories →" —
  ordered `dev-tools:7, analytics:6, seo-marketing:6, social-media:6, ai-writing:5,
  design:5, finance-accounting:5, meeting-notes:5, newsletter:5, tasks:5,
  website-builder:5, ai-assistant:4`, i.e. strictly by descending tool count.

## Problem 3 — the tool page

**Files:** `scripts/lib/site-page-tool.mjs`, `scripts/lib/site-styles.mjs`.

- **Title row balance.** `.tool-title-row` no longer stretches to the full width of
  `.page` (which is what pinned the badge to the far edge while a wrapped, `max-width:20ch`
  h1 sat in a narrow column on the left). It's now `width:fit-content;max-width:100%`, so
  the row hugs its actual content (favicon + h1 + badge) and wraps as a unit on narrow
  viewports instead of spreading across the container. `h1`'s flex value changed from
  `flex:1 1 auto` (grow) to `flex:0 1 auto` (no grow) since there's no longer free space
  in the row for it to expand into.
- **Price source moved.** `renderMetaRow()` in `site-page-tool.mjs` now builds the
  "Source: … · Checked on …" caption as a `<span class="price-source">` nested inside the
  *same* `<dd>` as the price value, and the standalone `<p class="status
  price-source">…</p>` that used to sit between the meta row and the verdict-summary
  paragraph was deleted. CSS: `.meta-item .price-source{display:block;margin-top:.35rem;
  font-size:.72rem;font-weight:400;color:var(--muted)}` — a small caption under the price,
  not a paragraph that reads as a citation for the summary underneath it.
- **Prior-art cards, denser.** Confirmed the upstream data has no room for a description —
  `schema/tool.schema.json`'s `priorArt` items only ever declare `name`, `url`, `license`
  (checked the schema directly; `data/tools/1password.json` and `data/tools/calendly.json`
  confirm no fourth field exists in practice either). So the fix is presentation, not data:
  `.priorart-card` went from a bordered, rounded, padded box (`border-radius:.5em;
  padding:.8em 1em`) stacked with `gap:.75rem` to a dense ruled row
  (`padding:.5em 0;border-bottom:1px solid var(--rule)`, name and licence on one line via
  `display:flex;justify-content:space-between`), the same "a rule, not a card" idiom
  already used for `.breadcrumb` and `<details>` elsewhere on the page. Markup only changed
  in that the licence `<span>` is no longer forced `display:block` (it's now a flex
  sibling next to the name).
- **Vertical rhythm.** Three concrete changes:
  1. Wrapped the title row, tagline, meta row and verdict-summary section in a new
     `<div class="tool-intro">` — the "one unit" the brief asked for — with a single
     `margin-bottom:clamp(2.5rem,6vh,3.75rem)` closing it off, and tightened the internal
     gaps that used to pad it out (`.tagline` margin-bottom went from
     `clamp(1.75rem,4vh,2.5rem)` to `clamp(1rem,2.5vh,1.5rem)`; the old inter-block
     `price-source` paragraph margin is gone entirely since it's folded into the meta row).
  2. Added `class="tool-block-prompt"` to the prompt `<section>` with
     `margin:clamp(2.75rem,6vh,4rem) 0` on both edges — a clearly larger gap than the
     within-group spacing, isolating the prompt both from the intro unit above and from
     "why people still pay" below (CSS margin collapsing between adjacent siblings takes
     the max of the two touching margins, so this one declaration is enough without also
     touching the neighbouring sections).
  3. Lowered the sitewide `h2` default top margin from `2.4rem` to `2rem` — this is the
     "connective" rhythm now shared by the sections the brief didn't name explicitly (why
     people still pay, the what-you-lose/prior-art pair, FAQ, related tools), so it reads
     as deliberately smaller than the two large boundaries above. Checked this rule is
     scoped correctly: the only bare (unclassed) `<h2>` elements in the whole generator are
     the six on the tool page (`why-heading`, `lose-heading`, `priorart-heading`,
     `faq-heading`, `related-heading`, `vote-heading`); home/category/root pages all use
     their own classed headings, so this change has no effect outside the tool page.
  The what-you-lose/prior-art pairing itself was already expressed structurally (the
  existing `.two-col{display:grid;grid-template-columns:1fr 1fr}` places them side by
  side); no change was needed there beyond the denser card CSS above.

## Commands run, with output

```
$ npx vitest run
 Test Files  12 passed (12)
      Tests  172 passed (172)

$ npm run validate
116 fiche(s), 232 traduction(s), 5 agent(s) — tout est valide.

$ npm run build
Feed écrit dans dist/feed/v1/ — 116 outil(s).
Compteurs de votes récupérés en direct pour 3 slug(s).
Icônes : 0 récupérée(s), 116 depuis le cache, 0 en repli sur 116 outil(s).
Site écrit dans dist/ — 2 langue(s), 232 fiche(s), 66 page(s) de catégorie, 304 URL(s) dans le sitemap (https://saasmadefree.com).
```

(Category-page count dropped from 88 to 66 versus the last build report — that's the
concurrent import agent's category merge landing in `data/categories.json`/`data/tools/*`,
not a side effect of this work; `npm run build` still runs clean against whatever shape
`data/` is in.)

`node --check` on every changed `.mjs`/`.js` file: clean. CSS brace balance on the
generated stylesheet: 203 open / 203 close.

### Structural verification (no browser)

Ad-hoc script written to the scratchpad (`verify-dist.mjs`, not part of the repo) walking
the freshly built `dist/`, one pass per check:

```
Fichiers HTML trouvés : 326

=== h1 ===
OK : une seule <h1> par page.

=== liens internes cassés ===
OK : tous les href/src internes résolvent.
Total: 0

=== favicons référencés mais absents ===
OK.

=== réciprocité hreflang ===
OK : chaque hreflang est réciproque.
Total pages avec alternates: 324
```

324 of 326, not 326: `dist/index.html` (the root language-redirect page) and
`dist/privacy.html` (a single, non-localized static page) intentionally carry no hreflang
alternates — both pre-existing, unrelated to this change; confirmed by listing which two
files lack the `hreflang` link tag.

Spot-checked rendered HTML directly for the three fixes:
- Header: `.brand` / `.header-groups` (`.nav-links` + `.header-controls` with lang
  switch / icon-only theme button / GitHub link) all present with the expected classes on
  `dist/en/index.html`.
- Home chips: exactly 14 `<li>` in `.chips` on `dist/en/index.html` — "All" + 12 categories
  (ordered by count, verified with a one-off script cross-checking against real per-category
  counts) + "All categories →".
- Tool page (`dist/en/tools/granola/index.html`): one `<h1>`; `.tool-intro` wraps title
  row + tagline + meta row + verdict section; the price `<dd>` contains both the price and
  the nested `.price-source` caption; `.tool-block-prompt` follows immediately after.
  `dist/en/tools/calendly/index.html` confirms the dense `.priorart-card` markup
  (`<li class="priorart-card"><a href="…">Cal.diy</a><span class="priorart-license">License:
  MIT</span></li>`, one line, no padding-heavy box).

## What remains unverified (no browser available)

- **Actual visual rendering** of all three fixes — cluster spacing/alignment in the
  header, whether the fit-content title row wraps the way intended at real viewport
  widths, whether the new vertical rhythm on the tool page reads as "grouped" rather than
  just "less spacing," dark-mode contrast on the new quiet lang-switch background and the
  icon-only theme button. Everything above was reasoned through and checked structurally,
  never rendered in a browser.
- **Narrow-screen collapse of the header** — `flex-wrap` on both the outer row and the two
  inner clusters should prevent overflow and keep every control reachable, per the CSS,
  but was not exercised at a real narrow viewport.
- **`width:fit-content` browser support** — used deliberately (the codebase already relies
  on `color-mix()`, a materially newer CSS feature, so this is not a new risk tier), but
  not tested against an actual old-Safari-class browser.
- **Screen-reader behaviour of the icon-only theme toggle** — the accessible-name logic
  (`aria-label` set both server-side as a default and by `site.js` on every toggle) was
  reasoned through against the existing pattern, not exercised with a real screen reader.
- **The category-chip ranking will keep shifting** as the concurrent import lands more
  tools — expected and by design (computed at build time, never hardcoded), but the exact
  set of 12 shown above is only a snapshot of the catalogue at build time, not a fixed
  result.
