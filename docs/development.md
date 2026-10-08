# Development guide

This guide covers the day-to-day workflow for working on ProfilePack. For a first-time setup walkthrough aimed at newcomers, see the root [CONTRIBUTING guide](../CONTRIBUTING.md); for how the code is organized, see [Architecture](architecture.md).

## Prerequisites

- Node.js >= 20 and npm
- Chrome 116 or newer (the manifest declares this as `minimum_chrome_version`)
- A Chromium-based browser is assumed throughout; the extension is not tested in other browsers

## Setup

```bash
git clone https://github.com/<your-username>/profilepack.git
cd profilepack
npm install
npm run build
```

Then load the extension once:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `dist/` directory of your checkout.

## Dev workflow

```bash
npm run dev
```

This runs one initial full build (extension pages, background, content script) so `dist/` is always loadable, then keeps two Vite watch processes running: the main build and the content script build.

After changing code:

1. Wait for the watch build to finish writing `dist/`.
2. Reload the extension on `chrome://extensions` (click the reload icon on the ProfilePack card). This replaces extension pages and restarts the service worker.
3. Refresh any tab you are testing. Content scripts are not replaced by reloading the extension, so a tab that was open before install/reload either needs a refresh or ProfilePack's on-demand re-injection (the `scripting` permission enables this).

The popup, side panel, and options page can simply be closed and reopened after a build; only the service worker and content script need an explicit reload cycle.

## How `dist/` is structured

`dist/` is what Chrome loads. After a successful build (validated by `scripts/prepare-dist.mjs`):

```text
dist/
  manifest.json            Copied from public/, version-checked against package.json
  background.js            Background service worker (module worker)
  content.js               Content script, single self-contained IIFE
  icons/                   icon16.png, icon32.png, icon48.png, icon128.png
  src/
    popup/index.html       Popup entry (loads hashed assets from assets/)
    sidepanel/index.html   Side panel entry
    options/index.html     Options page entry
  assets/                  Hashed JS/CSS chunks for the extension pages
```

Never edit `dist/` by hand; it is regenerated. The validation step fails the build if the manifest references something `dist/` does not contain, or if versions in `package.json`, `public/manifest.json`, and `src/shared/version.ts` disagree.

## Running the test suite

```bash
npm run test          # vitest run (single pass)
npm run test:watch    # vitest in watch mode
```

The suite is Vitest 3 and covers two layers:

- **Unit tests** for the domain layer: persona derivation, generator presets, classifier scoring, mapping and template logic. These run in a plain node environment because `src/domain/` has no DOM or Chrome dependencies.
- **jsdom integration tests** that execute detection and classification logic against the HTML pages in `fixtures/`. A fixture is loaded into jsdom, the detector and classifier run over it, and the results are asserted against expected field classifications.

There is no browser e2e suite in v0.1; `npm run test` is the entire automated surface.

## Testing a fixture page manually

1. Build once (`npm run build` or keep `npm run dev` running) and make sure the extension is loaded.
2. Open a fixture directly in Chrome by serving the repository root over http (for example `npx serve .` from the repo root, then open the fixture URL such as `http://localhost:3000/fixtures/checkout.html`). Fixtures are not part of `dist/`, so they cannot be opened through the `chrome-extension://` scheme.
3. Open the ProfilePack popup or side panel on that tab and run a scan. The detected fields and confidence levels appear in the UI.
4. Activate a persona and fill. Verify the expected fields were filled, that password, payment, and consent fields were left untouched, and that nothing was submitted.
5. Reload the fixture to reset it between runs.

For framework-behavior fixtures (React-style controlled inputs), watch the page's own state display, if the fixture provides one, to confirm the fill events were picked up.

## Debugging tips

- **Service worker:** on `chrome://extensions`, the ProfilePack card shows **Inspect views** — click `service worker` to open a DevTools console for the background. Message routing errors and badge updates appear here. The console also survives until the worker is killed and respawned.
- **Content script:** open DevTools on the page itself. The content script runs in the page's isolated world; its console output and any `chrome.runtime` errors appear in the page console. Note that errors from the page's own JavaScript (the site under test) are separate.
- **Extension pages:** right-click the popup and choose **Inspect**, or open the side panel/options page and use the DevTools shortcut. UI state and storage calls are visible here.
- **Storage:** from any extension-page DevTools console, inspect `chrome.storage.local.get(null, console.log)` to see all `pp:*` keys.
- **Message tracing:** when a fill does nothing, check the service worker console first — most failures are a failed message result (`{ ok: false, error }`) rather than a silent fill bug.

## Preview mode

The popup, side panel, and options pages are plain HTML bundles. If you open them outside the extension context — for example by serving `dist/src/popup/index.html` from a local server — the Chrome APIs are unavailable. In that case the UI automatically runs against the browser `localStorage` preview implementation of `StorageService` and seeds clearly-labeled sample data. This makes UI-only work (layout, components) possible without loading the extension, but behavior that depends on tabs, messages, or real storage is not available in this mode.

## Adding fixtures

Fixtures live in `fixtures/` as standalone HTML pages. When adding one:

1. Reproduce a realistic form pattern: a checkout, a signup, a settings page, a custom widget. Keep each fixture focused on one pattern.
2. Do not use real personal data, real brand names where avoidable, or live third-party scripts.
3. Name the file after the pattern it demonstrates and keep it self-contained (inline CSS/JS, no build step).
4. If the fixture demonstrates framework-style inputs, include a small inline script that reflects the input state so manual testing can verify events were received.
5. Add jsdom integration tests that load the fixture and assert the classifier's expected results. A fixture without a test is usually incomplete.

## Release checklist

1. Bump the version in **all three** places together: `package.json`, `public/manifest.json`, and `src/shared/version.ts`. `npm run build` fails if they drift apart.
2. Update `CHANGELOG.md` — move the relevant `Unreleased` items into a new dated section.
3. Run the full gate locally: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
4. Load `dist/` in Chrome and do a manual smoke test: create/activate a persona, scan a fixture, fill, learn a form.
5. Merge to `main` and tag the commit with `v<version>` (for example `v0.2.0`). Pushing the tag triggers the Build workflow, which produces `profilepack-v<version>.zip` as a workflow artifact.
6. Attach or reference the artifact when publishing; GitHub Releases are not created automatically.
