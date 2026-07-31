# Rebuilding the site layout to match the reference directory — report

Date: 2026-07-31. Repository: `saasmadefree` (branch `main`).

## What was built, section by section

### Shared chrome (`scripts/lib/site-html.mjs`, `scripts/lib/site-styles.mjs`)

`renderLayout` now emits a full-width nav row above everything: the wordmark on the
left; on the right a `<ul class="nav-links">` (Directory, Submit a tool → the GitHub
`CONTRIBUTING.md`, Source → the repo), the existing language switcher, the existing
theme toggle, then a bordered `GitHub ↗` button (`.github-btn`). `GITHUB_REPO_URL` and
`CONTRIBUTING_URL` are exported constants, reused by the footer too (previously a
hardcoded string duplicated the same URL). Added `verdictBadge()` — one badge renderer
shared by the home table, the tool-page title row (`badge-lg` modifier) and the related
cards, replacing three separate inline `<span class="badge …">` constructions.

### Home page (`scripts/lib/site-page-home.mjs`)

1. **Hero, centred** — `.hero-h1`/`.hero-sub` override the base left-aligned `h1`/`.lede`
   with `text-align:center;margin:0 auto`. Copy unchanged (still the `{blank}`-driven
   question + one-line subtitle).
2. **Search, centred, wide, rounded, typeahead** — `.search-combo` (max-width 38rem,
   centred). The `<input>` is `role="combobox"` with `aria-expanded`, `aria-controls`,
   `aria-autocomplete="list"`; a `×` clear button appears once there's text. A
   `role="listbox"` panel (`#search-panel`) is absolutely positioned under the box
   (`position:absolute;top:calc(100% + .5rem)`, `z-index:30`) so it overlays the chips
   and ticker without pushing them down — no layout shift. Panel rows are built in
   `scripts/assets/site.js` **from the existing `<tr>` elements** (favicon via
   `data-favicon`, name/link, cloned `.badge`, category+price text) — no second copy of
   the catalogue is emitted. Matching is the same case-insensitive substring already
   used by `data-search` (confirmed: "gr" matches both Granola/Grammarly and
   Ideogram/LogRocket). Six results shown, then a `↓ All {count} matches in the
   directory` row linking to `?q=…#tool-table`. Arrow keys move `aria-activedescendant`
   through the options, Enter opens the highlighted one (or the "view all" row), Escape
   closes the panel (focus never leaves the input — options aren't real focus targets,
   per the standard combobox/listbox pattern). Without JavaScript the input is a plain,
   labelled search field and the full table below is already complete; the panel is a
   pure enhancement (`enhanceSearchCombo` in `site.js`).

   One behavioural change from the previous build: **typing no longer filters the table
   below** (per the coordinator's mid-task correction) — only the panel responds to
   keystrokes now. The table is still filtered once, on page load, from `?q=` in the
   URL, so the `WebSite`/`SearchAction` JSON-LD promise stays honest for a shared link
   or a search-engine sitelinks box, without JS having to re-filter on every keystroke.
3. **Category chips, centred, wrapped** — `.chips{justify-content:center;flex-wrap:wrap}`.
   First chip "All" (`aria-current="page"`, links to the home page itself). Last chip
   "All categories →" links to a **new page**, `/{lang}/categories/` — every category
   this language has, each linking to its category page. All chips are real `<a>` links,
   unchanged by JS.
4. **Ticker band** — full-bleed (`width:100vw;margin-left:calc(50% - 50vw)`, its own
   background tint and top/bottom rule). A `aria-hidden="true"` marquee of `TOOL
   -$XX/mo` spans, one per tool whose `pricing.basis` is genuinely monthly (excludes the
   one `one-time`-basis tool and would exclude non-USD ones from the *total*, see
   below — the per-item ticker text uses each tool's own currency/locale formatting, so
   a EUR tool reads "LANGUAGETOOL −€19.90/mo"). The list is duplicated and the CSS
   animation moves it by `-50%`, looping seamlessly; the `animation` rule only exists
   inside `@media (prefers-reduced-motion:no-preference)`, so reduced-motion readers get
   a static (non-animated) band, never a moving one. Below it, the headline "MRR
   destroyed" figure as digit boxes (see **Honesty** below).
5. **Figures band** — same full-bleed treatment, five real numbers, each with a small
   caption (see **Honesty** below).
6. **The list** — `.list-head` is a large, now-visible `<h2>` (`.list-heading`, no
   longer visually-hidden) plus a right-aligned note explaining the ranking
   (`rankNote`). Under it, verdict filter chips: `All` (default, `aria-pressed="true"`)
   then `Yes`/`Partly`/`No`, each `<button aria-pressed>` — natively keyboard-operable,
   inert without JS (a `<button>` with no listener does nothing, which is correct: these
   are enhancements, per the brief). Each verdict chip's `aria-label` embeds the
   verdict's description (`"Partly: Rebuildable in a weekend, but…"`) — this replaces
   the previous build's separate "three verdicts" legend block, which the new layout
   doesn't have room for as a distinct section; the meaning is preserved for
   screen-reader users without adding a section the brief doesn't ask for. Then the
   unchanged `<table>`.

### Tool page (`scripts/lib/site-page-tool.mjs`)

1. Nav bar (shared).
2. Breadcrumb (unchanged).
3. **Title row** — favicon (`<img class="tool-favicon">`) + `h1` = "Can a prompt replace
   {Tool}?" (new `tool.h1Template`, distinct from the `<title>` tag copy) + a large
   verdict badge (`verdictBadge(..., 'badge-lg')`) pushed to the right via flex.
4. **Meta row** — a `<dl class="meta-row">` of label/value pairs on one line: Price,
   Per year (`amount × 12`, only rendered when `pricing.basis` is actually monthly — a
   one-time-payment tool has no year-cost claim made about it at all; the value carries
   `title="Current monthly price × 12 — not a guaranteed saving."`), Build time
   (`diyTimeEstimate`, newly translated — see below), Category, Votes. The
   source/checked-on line moved to a small caption below the meta row rather than being
   dropped.
5. Verdict summary paragraph (a visually-hidden `<h2>` keeps it in the a11y outline).
6. **Prompt block** — a header bar: label on the left, "Copy prompt" + one "Open in
   `<agent>`" link per **verified** agent on the right. Windsurf (`not-yet`) and ChatGPT
   (`untested`) are excluded; `claude-code-web`, `cursor`, `claude-code-cli` (all
   `verified`) appear. Each button's `href`/mode is computed at build time by importing
   `resolveAction` directly from `extension/lib/template.mjs` — **not reimplemented** —
   with the same `{prompt, prompt_url, lang, slug}` context the extension popup builds.
   That means the three modes really exercise the real logic: `claude-code-web` → a
   `url` link to `claude.ai/code?prompt_url=…`; `cursor` → a same-tab `deeplink`
   (`cursor://…`, none of the 116 prompts exceed the 8000-char `maxLength`, so none fall
   back to clipboard); `claude-code-cli` → a `clipboard`-mode link to its homepage. All
   three render as real `<a href>` elements, so they work with JavaScript off. `site.js`
   only layers on: copy-the-prompt-to-clipboard before navigating (for `url`/`clipboard`
   it's fire-and-forget alongside the `target="_blank"` navigation the browser already
   started; for `deeplink`, which must stay same-tab to trigger the OS handler, the
   click is intercepted, the clipboard write awaited, then navigation proceeds). A
   one-line caption below explains "Opening prefills the prompt — press enter to run
   it."
7. **Why people still pay** — heading now names the moat: "Why people still pay:
   `{tool.moatType}`". `moatType` is explicitly free text in the schema
   (`schema/tool.schema.json`, CONTRIBUTING.md: "one or two words", ~100 distinct values
   across the catalogue, e.g. `"proprietary data/crawler scale"`), not a closed,
   translated code like `pricing.basis`. It is rendered as-is on every language page,
   the same honest-fallback pattern the codebase already uses for `categoryLabel`'s
   humanized-slug fallback. **Known limitation**: on French pages this occasionally
   mixes an English phrase into a French heading (e.g. "Pourquoi certains continuent de
   payer : proprietary data/crawler scale"). Translating ~100 free-text values into six
   languages is a data-authoring task, not a generator change, and `moatType` is owned
   by `data/tools/*.json`, which this task was explicitly told not to touch.
8. **Two columns** — left: "What you lose", each item prefixed with a `−` mark
   (`.lose-mark`); right: "Prior art", each entry a bordered card (`.priorart-card`)
   with its licence. If a tool has no prior art, the column is omitted and the left
   column spans full width (`:only-child{grid-column:1/-1}`) rather than leaving a
   visible empty box.
9. **Related tools**, three cards (`.related-cards`, 3-column grid, 1 column under
   44rem): favicon, name, verdict badge, then price · category.
10. **Vote button**, filled and prominent (inherits the sitewide primary `<button>`
    style, bumped in size via `.vote-btn`), the count rendered *inside* the button as a
    parenthetical badge (`Record my vote (1 vote)`) rather than a separate paragraph, to
    match "showing the count" on the button itself. Beside it, "Share on X" — a real
    `<a target="_blank">` to a prefilled `twitter.com/intent/tweet` URL (page URL + "Can
    a prompt replace {name}? The verdict: {verdict}."), so it works without JS too.
11. FAQ — unchanged `<details>` pattern.

### New page: `/{lang}/categories/` (`scripts/lib/site-page-categories-index.mjs`)

Breadcrumb + `h1` "All categories" + a card grid, one per category actually published
in that language, each showing its emoji, label and a real tool count
(`{count} tool(s)`, pluralized) — never a category with zero tools linked in.

## Favicon strategy and failure rate

`scripts/lib/site-favicons.mjs`, wired into `build-site.mjs` before the per-language
loop. For each tool, the "canonical" domain is `domains[0]`. At build time it fetches
`https://www.google.com/s2/favicons?sz=64&domain=<domain>` (always returns a PNG),
caches the bytes under `.cache/favicons/<domain>.png` (new git-ignored directory, added
to `.gitignore`), and copies them into `dist/assets/favicons/<slug>.png`. A rebuild
reuses the cache and makes zero network requests. Any failure — offline, timeout,
non-2xx, non-image content-type — falls back to a single shared, hand-generated
placeholder SVG (`dist/assets/favicons/_placeholder.svg`, written unconditionally on
every build) rather than breaking the build or leaving a missing image.

Actual run against the current catalogue: **116/116 tools fetched successfully, 0
placeholders (0% failure rate)**. Cache verified working on a second `npm run build`
(0 fetched, 116 from cache). Total cache size: 472 KB. Unit tests in
`tests/site-favicons.test.mjs` cover the cache-reuse path, the fetch-throws path, the
non-ok-response path (and confirm a failed fetch is never itself cached), domain
normalization (`www.`/case), and the "no fetch implementation available" path.

The site itself makes no runtime request for favicons — every `<img>` on every page
points at a local `/assets/favicons/*` path written during the build; the only network
call `dist/assets/site.js` ever makes is to `votes.saasmadefree.com`, unchanged from
before.

## The real numbers behind the ticker and the figures band

Both are computed once in `build-site.mjs` (`catalogueFigures`/`mrrDestroyed` in
`scripts/lib/site-data.mjs`), from the same `voteCounts` the build already fetches for
sorting — no separate/duplicated logic, no invented number.

**Ticker "MRR destroyed"** — for each tool, `pricing.amount × recorded votes`, summed
over tools whose currency is USD and whose `pricing.basis` is genuinely monthly
(non-USD and one-time-basis tools are excluded from the sum so it never silently mixes
currencies or counts a one-off payment as recurring spend). At the time of this build,
the live vote feed (`votes.saasmadefree.com/feed/v1/votes.json`) returned
`{"calendly":1,"notion":1,"typeform":1}` — one vote each, on tools priced $12, $10 and
$25/mo — giving **$47/mo**. Rendered as individual digit boxes (`$`, `4`, `7`), with
"/mo" appended as plain text outside the boxes, and a full-precision, non-decorative
sentence for screen readers ("$47 a month represented by votes recorded so far"). If
`fetchVoteCounts()` returns `null` (vote service unreachable at build), `mrrDestroyed`
also returns `null` and the band renders `home.mrrUnavailable` text instead of a
figure — never a `0` standing in for missing data.

**Figures band**, computed from the full catalogue (not filtered per language, since
these describe the repository, not one language's subset):

| Figure | Value | Source |
|---|---|---|
| Tools published | 116 | `tools.size` |
| Categories | 44 | distinct `tool.category` values actually in use — all 44 categories defined in `data/categories.json` have at least one tool |
| Languages | 2 | `siteLanguages(tools)` — every tool currently declares `markets: ["en","fr"]` |
| Total monthly price of the catalogue (USD) | $3,065.39 | sum of `pricing.amount` over USD tools with a monthly basis (112 of 116; excludes 3 EUR-priced tools — `languagetool`, `lnkflow`, `meetergo` — and the 1 one-time-basis tool, `uncircle`, to avoid summing incompatible currencies/periods) |
| Prompts written | 232 | `i18n.size` — one prompt file per tool per published language (116 × 2) |

## Commands run, with output

```
$ npm run validate
116 fiche(s), 232 traduction(s), 5 agent(s) — tout est valide.

$ npx vitest run
 Test Files  12 passed (12)
      Tests  172 passed (172)

$ npm run build
Feed écrit dans dist/feed/v1/ — 116 outil(s).
Compteurs de votes récupérés en direct pour 3 slug(s).
Icônes : 116 récupérée(s), 0 depuis le cache, 0 en repli sur 116 outil(s).
Site écrit dans dist/ — 2 langue(s), 232 fiche(s), 88 page(s) de catégorie, 326 URL(s) dans le sitemap (https://saasmadefree.com).

$ npm run build            # second run, cache reuse check
Icônes : 0 récupérée(s), 116 depuis le cache, 0 en repli sur 116 outil(s).
Site écrit dans dist/ — 2 langue(s), 232 fiche(s), 88 page(s) de catégorie, 326 URL(s) dans le sitemap (https://saasmadefree.com).
```

Structural verification (no browser — a standalone script walking `dist/`, one call per
check: every `href`/`src` attribute across all 326 generated HTML files resolved
against the filesystem, `<h1>` count per page, hreflang reciprocity, favicon
references):

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
Total pages avec alternates: 325
```

(325, not 326: the root `/` redirect page intentionally carries no hreflang
alternates — it isn't a language variant of a page, it's the aiguillage itself, per the
existing comment in `scripts/lib/site-page-root.mjs`.)

Duplicate-`id` check on a sample home page and tool page: none found. No JS syntax
errors (`node --check` on every new/changed `.mjs`/`.js` file). CSS brace-balance sanity
check on the generated stylesheet: 193 open / 193 close.

## What remains unverified (no browser available)

- **Visual rendering** — actual centring, spacing, the marquee's motion, digit-box
  legibility, dark-mode contrast, and whether the search panel visually overlays the
  chips/ticker as intended. All of this is implemented per the CSS described above but
  was never rendered in a browser.
- **Combobox keyboard behaviour end-to-end** (arrow-key highlight, Enter navigation,
  Escape closing, `aria-activedescendant` wiring) — reasoned through and matches the
  standard ARIA combobox/listbox pattern, but not exercised in a real screen reader or
  browser.
- **Responsive breakpoints** — `44rem`/`36rem` breakpoints for the two-column section,
  related cards, figures grid and rank-note alignment were chosen by inspection of the
  content, not tested at real viewport sizes.
- **Cross-browser clipboard/deeplink behaviour** for the "Open in Cursor" button (the
  `blur`-detection dance the extension's popup does to report "agent not installed" was
  deliberately *not* reimplemented here — the button works as a plain link with or
  without JS, but there is no "Cursor isn't installed" feedback on this page the way
  there is in the extension popup).
- **Google's favicon endpoint's long-term reliability/rate limits** — it worked
  100% for this run; the cache means a broken/rate-limited endpoint on a future CI run
  degrades to placeholders (handled) rather than failing the build, but that path
  wasn't exercised against the real service (only mocked in tests).
- The moat-naming English-in-French mixing noted above is a known, accepted limitation,
  not a bug — flagged for whoever next edits `data/tools/*.json` moat text.
