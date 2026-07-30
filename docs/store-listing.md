# Chrome Web Store listing — SaaS Made Free

Text ready to paste into the Chrome Web Store developer dashboard. Fields marked `TODO(owner)` are not decided yet — do not invent a value for them, and do not submit until they're filled in.

## Single purpose

Paste into the "Single purpose" field:

> Show, on the website of a SaaS subscription, a verdict on whether a personal version can be built with a coding agent, and hand the corresponding prompt to the agent chosen by the user.

## Permission justifications

### `host_permissions: <all_urls>`

The extension needs to recognize which SaaS product a visited page belongs to before it can show anything. The set of tracked products is a public catalogue (served from `saasmadefree.com/feed/v1/index.json`) that grows every week as contributors add entries by pull request. A fixed domain list baked into the manifest would require a new store submission — and a new review — for every single addition, which does not scale for a community-maintained, open-source directory.

The content script that runs on every page is one file, `extension/content.js`, and it does exactly one thing: read `location.hostname`, look it up against a locally cached catalogue, and return immediately if there is no match — true for the overwhelming majority of page loads. It never reads the page's text, DOM, forms, cookies, or storage, and it makes no network request of its own. On a match, it writes exactly one element to the page: its own panel, isolated inside a closed Shadow DOM that the host page's own scripts cannot read or reach into.

Because this permission is the one that decides the review, four things make the claim above checkable rather than a promise to take on faith:

- **Reproducible build.** `npm run build:extension` produces a byte-identical ZIP from identical source (file modes and timestamps are normalized before packaging). CI builds the archive twice on every push and fails if the two differ. The resulting SHA-256 is published alongside every release, so anyone can rebuild from source and compare.
- **A Git tag per store version.** The version submitted to the store carries a matching `vX.Y.Z` tag in the repository, so the exact commit behind any published build can be identified and checked out.
- **No minification, no bundling.** The code shipped in the store package is the same plain, readable JavaScript as the public repository — not a compiled or obfuscated artifact.
- **One short, named file at the point of contact.** The claims above concern a single file, `extension/content.js`, not the extension as a whole — verifying them is a ten-second read, not a full codebase audit.

### `storage`

Used only for settings kept on the user's device: the language used for entries shown, a personal agent template if the user adds one, which tool panels the user has dismissed, and a small local queue of votes recorded while offline (sent on the next successful connection). Nothing under this permission is transmitted anywhere by itself.

### `alarms`

Used to schedule a once-a-day refresh of the public tool catalogue via `chrome.alarms`. Manifest V3 service workers are terminated after a short idle period, so a `setInterval` would not survive between refreshes; `alarms` is the supported mechanism for a periodic task that must keep firing after the service worker has been unloaded and restarted.

### `clipboardWrite`

Used only when the user clicks to send a prompt to an agent that has no URL- or deeplink-based handoff, or when the prompt is longer than that agent's URL length budget. The prompt is copied to the clipboard so the user can paste it themselves; nothing is written to the clipboard without a direct user action.

## Data handling declaration

- No personally identifiable information is collected.
- The only data this extension sends about the user's activity is a vote: a single tool identifier (e.g. `notion`), sent only when the user explicitly clicks "I'll do it myself." No name, email, account identifier, or page content is attached.
- The vote endpoint hashes the request's IP address together with a value that rotates daily, before anything is written to storage; the raw IP address is never stored in clear form.
- The daily catalogue refresh is a plain, unauthenticated read of a public JSON file. It identifies nothing about the user and does not include the hostname of any page the user has visited.
- No cookies, no analytics, no third-party trackers of any kind inside the extension.
- No data is sold, rented, or shared with third parties, and no data is used for any purpose unrelated to the single purpose stated above.

(This summarizes the full policy at [`public/privacy.html`](../public/privacy.html) — read that page for the complete text, and confirm the equivalent certifications in the dashboard's own data-usage checkboxes at submission time, since their exact wording is set by Google and can change.)

## Links

- **Privacy policy:** https://saasmadefree.com/privacy.html
- **Repository:** https://github.com/saasmadefree/saasmadefree
- **Support contact:** `TODO(owner)` — no contact address has been decided yet. The same placeholder exists in `public/privacy.html`. Do not submit to the Chrome Web Store until both are filled in with a real, monitored address.
