# SaaS Made Free

**[saasmadefree.com](https://saasmadefree.com)** · [github.com/saasmadefree/saasmadefree](https://github.com/saasmadefree/saasmadefree)

SaaS Made Free is an open-source, multilingual directory of paid SaaS subscriptions that can be replaced by a self-hosted version built from a single prompt handed to a coding agent. Each entry carries a verdict, a real and dated price, the ready-to-use prompt, what you would actually lose by going it alone, and why some people keep paying anyway. The project ships as versioned JSON data validated in CI, a static public feed, a Cloudflare Worker vote backend, and a Manifest V3 Chrome extension in seven languages.

Contributions — new tools, better prompts, new agents, translations — go through the data files under `data/`, validated in CI. See [CONTRIBUTING.md](CONTRIBUTING.md).

Skeptical about a browser extension that asks for access to every site you visit? Jump straight to [What the extension sees on your pages](#what-the-extension-sees-on-your-pages).

## The honest verdict

> **SaaS made free — when it can be.**
> The name promises free. Most entries qualify the promise, and some contradict it outright.

Every tool gets one of three verdicts. The third one is why this is a directory and not an
affiliate site:

| Verdict | Meaning |
|---|---|
| `yes` | A competent coding agent produces a usable personal version in one sitting, self-hosted, with no hard third-party dependency. |
| `kinda` | Buildable in a weekend, but with substantial gaps — mobile apps, real-time sync, third-party integrations, OAuth. The entry says which. |
| `no` | Keep paying. The value is the network, the data, the infrastructure, or the compliance — not the code, and no prompt replaces it. |

<a id="the-honest-number"></a>

### The honest number

Run `npm run stats` to print the live distribution, read straight from `data/tools/`. No
aggregate figure is written into this file: a hand-copied percentage drifts the moment the
next batch lands, and this project's whole argument is that its numbers are true.

At the time of writing, fewer than two entries in ten are a plain `yes`, and more than one in
four say *keep paying*. Leading with that instead of a blanket promise is what keeps this from
reading like an affiliate site — and it's the part developers will check against the data
before they trust anything else here.

## Running it

```
npm ci
npm run validate
npx vitest run
npm run build
```

- **`npm ci`** — installs the dependencies from `package-lock.json` (Node ≥ 22, no other runtime requirement). No network access is needed beyond npm itself; there are no secrets to configure to run any of the commands below.
- **`npm run validate`** — runs `scripts/validate.mjs`. It loads every file under `data/`, checks it against the JSON Schemas in `schema/`, and enforces the rules a schema alone can't express: domains unique across tools, `relatedSlugs` pointing at real, distinct tools, exactly four FAQ entries, every declared market having its translation file, prices no older than 180 days, and every `requirements[]` code and agent `runHint` translated in all seven `data/i18n/<lang>/ui.json` files. This is the same check CI runs on every pull request.
- **`npx vitest run`** — runs the root test suite (domain matching, template rendering, the feed builder, the validation rules themselves). Always `run`, not the bare `vitest`, so it exits instead of watching.
- **`npm run build`** — runs `scripts/build-feed.mjs`. It validates the data again, then writes the versioned public feed to `dist/feed/v1/`, the extension's offline snapshot to `extension/data/index.json`, the worker's slug allow-list to `worker/src/slugs.generated.mjs`, and copies `public/` (including the privacy policy) into `dist/`.

The Cloudflare Worker that backs the vote counter lives in its own package. `worker/src/index.mjs` imports `worker/src/slugs.generated.mjs`, written by the root `npm run build` above and gitignored — on a fresh clone that file doesn't exist yet, and skipping this step doesn't fail loudly: the worker's test suite silently loads only the tests that don't touch that import. Run the root build first, then the worker's own tests:

```
npm ci
npm run build
cd worker && npm ci && npx vitest run
```

### Deploying the worker

The worker refuses to start (returns `500` on every request) if `VOTE_SALT` isn't set — see `worker/src/index.mjs`. From `worker/`:

```
npx wrangler d1 create saasmadefree            # copy the printed database_id into wrangler.toml
npx wrangler d1 migrations apply saasmadefree --remote
npx wrangler secret put VOTE_SALT              # a random 32-byte value; never commit it
npx wrangler deploy
```

`VOTE_SALT` is the server-held secret that keeps a stored `ip_hash` from being reversed back to an IP address — see [How a vote is protected](public/privacy.html). It must never be committed; the repository is public.

## What the extension sees on your pages

One file, [`extension/content.js`](extension/content.js), is the only part of this extension that runs on the pages you visit — on every site, because of the `host_permissions: <all_urls>` permission (justified in full in [`docs/store-listing.md`](docs/store-listing.md)).

It **reads** exactly one thing from the page: `location.hostname`. Never the page's text, its forms, its cookies, or its storage — and it never transmits anything about the page you're on. If the hostname isn't a tracked tool, it returns immediately ([content.js line 9](extension/content.js#L9)) — that's true for the overwhelming majority of page loads.

If the hostname does match a tracked tool, it **writes** exactly one thing: its own `<div>`, attached in a **closed Shadow DOM** ([content.js lines 14–17](extension/content.js#L14-L17)). That element does not read or modify anything already on the page, and the host page's own scripts cannot see or reach into it.

We will not claim "no DOM access" here — that would be false, since writing the panel is itself a DOM write, and the code is public. The precise claim, and the only one made anywhere in this project, is: **reads only the hostname, writes only its own isolated element.**

The full policy this section summarizes is at [`public/privacy.html`](public/privacy.html) (published at `saasmadefree.com/privacy`).

## Verifying the reproducible build

`npm run build:extension` (`scripts/pack-extension.mjs`) packages `extension/` into `build/extension.zip` with every file's mode normalized to `0644` and its timestamp fixed, then writes the archive's SHA-256 digest to `build/extension.zip.sha256`. Two runs from identical source produce a byte-identical archive. [CI proves this on every push](.github/workflows/ci.yml) by building twice and diffing the two ZIPs.

To check it yourself:

```
npm run build                              # regenerates extension/data/index.json from data/
npm run build:extension
cp build/extension.zip /tmp/first.zip
rm build/extension.zip
npm run build:extension
cmp /tmp/first.zip build/extension.zip      # no output = identical
shasum -a 256 -c build/extension.zip.sha256 # "OK" = matches the published hash
```

The first line matters: `extension/data/index.json` (the extension's offline snapshot) is generated output, committed so the extension has something to read before its first network refresh. If it ever drifts from what `data/` actually contains, the SHA-256 you compute here won't match the one CI published — not because of tampering, but because you packed a stale snapshot. CI guards against the snapshot itself going stale by running `git diff --exit-code` right after `npm run build`; running the same command yourself before packing keeps your local check honest too.

Every version published to the Chrome Web Store is tagged in this repository (`vX.Y.Z`), so the exact commit behind any installed build can be checked out and compared against the ZIP you'd get from your own machine. The extension ships as plain, unminified, unbundled JavaScript — nothing here is built to be hard to read.


## Attribution

The catalogue of tools and the factual research behind it come from
[canivibecodeit](https://github.com/canivibecodeit/canivibecodeit) (MIT License,
© Rob Hallam). The prompts, the FAQ entries, the seven-language editorial, the data model
and every line of code in this repository are our own work. The original copyright notice
is reproduced in [`NOTICE`](NOTICE), as the licence requires.

## License

MIT — see [`LICENSE`](LICENSE). The prompts are as free to reuse as everything else in this repository; nothing here is enclosed.
