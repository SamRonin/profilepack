# Architecture

ProfilePack is a local-first Chrome Extension (Manifest V3) for developers and QA engineers. It creates synthetic test personas once and fills web forms and multi-step flows with the same consistent persona everywhere. This document explains how the extension is structured and why.

## Goals

- **Local-first.** All data lives in `chrome.storage.local` on the user's device. There are no network requests, no analytics, no telemetry, no accounts.
- **Minimal dependencies.** The runtime surface is React 18, Tailwind CSS 4, and the Chrome Extension APIs. Everything else in the build chain (Vite, TypeScript, ESLint, Prettier, Vitest) is development-time tooling.
- **Testable domain layer.** Persona generation, classification, and mapping logic are pure TypeScript with no framework, DOM, or Chrome API dependencies, so they run unchanged in Vitest (node and jsdom environments).

## Pipeline

The extension is organized as a pipeline from UI contexts down to the page and back to storage:

```text
Popup / Side Panel / Options (React UI)
      ↓ typed messages (chrome.runtime)
Background service worker (message router, badge, onInstalled seeding)
      ↓ chrome.tabs messaging
Content Script (dist/content.js, IIFE, ISOLATED world)
      ↓
Detector (DOM traversal incl. open Shadow DOM)
      ↓
Classifier (multi-signal field classification, confidence scores)
      ↓
Mapping engine (auto suggestion + saved template overrides + manual overrides)
      ↓
Fill Engine (React/Vue/Angular-safe native setter + dispatched events; never submits)
      ↓
Storage (chrome.storage.local via StorageService abstraction)
```

A scan request travels down: a UI context asks the background worker, the worker relays to the content script of the active tab, the content script detects and classifies fields, and the result is returned to the UI. A fill request travels the same path with a mapping attached. Storage is not a terminal stage in a strict sense: UI, background, and services all read and write through the same `StorageService` abstraction; the fill engine itself only touches the page, never storage.

The content script runs in the ISOLATED world at `document_idle`, in the top frame only (`all_frames: false`). It owns the Detector, Classifier, Mapping engine, and Fill Engine because only page-context code can traverse the DOM and drive field values.

## Module walkthrough

```text
src/
  domain/      Pure logic: persona model, generator, presets, classifier, templates, mapping
  storage/     StorageService abstraction + implementations (chrome, preview, in-memory)
  services/    Application services that orchestrate domain + storage + messaging
  content/     Content script entry: detector, classifier runner, fill runner in the page
  background/  Service worker: message router, badge, onInstalled seeding, side panel opening
  popup/       Toolbar popup UI (React)
  sidepanel/   Side panel UI (React)
  options/     Options page UI (React)
  ui/          Shared UI components and styling
  shared/      Shared types, constants, message protocol, version
```

- **`src/domain/`** is the core. It contains the persona model (a persona is a set of deterministic, internally consistent attributes), the synthetic data generator with locale presets, the classifier inputs and scoring, the mapping and template model, and the fill plan logic. Nothing in this folder imports React, Chrome APIs, or DOM globals; everything is driven by plain arguments.
- **`src/storage/`** defines the `StorageService` interface and three implementations: a Chrome implementation backed by `chrome.storage.local`, a browser `localStorage` preview implementation used when UI pages are opened outside the extension, and an in-memory implementation for tests. All three store and return the same serialized shapes, so domain and service code never know which backend is active.
- **`src/services/`** composes domain logic with storage. For example, filling a page combines the active persona (storage), a mapping (auto suggestion + template + manual overrides), and the fill plan (domain) into a single operation the UI can invoke with one message.
- **`src/content/`** is the only code that touches the live DOM. It detects form fields (including fields inside open shadow roots), feeds them to the classifier, applies mappings, and performs fills.
- **`src/background/`** is the hub. It routes typed messages between UI contexts and tabs, updates the toolbar badge from scan results, seeds initial state on install, and opens the side panel on request.
- **`src/popup/`, `src/sidepanel/`, `src/options/`** are React 18 + Tailwind 4 UIs. They hold no business logic; they send messages and render results.
- **`src/shared/`** holds the types shared across contexts, most importantly the message protocol, and the app version constant.

## Message protocol

All cross-context communication uses a typed, discriminated-union message set defined in `src/shared/`. Every message handler returns a result of the shape:

```ts
type MessageResult<T> = { ok: true; data: T } | { ok: false; error: string };
```

The messages:

| Message               | Direction                        | Purpose                                                |
| --------------------- | -------------------------------- | ------------------------------------------------------ |
| `PING`                | UI → background                  | Liveness check                                         |
| `SCAN_PAGE`           | UI → background → content script | Ask the active tab to detect and classify form fields  |
| `PAGE_SCAN_RESULT`    | content script → background      | Scan summary used to update the toolbar badge          |
| `GET_DETECTED_FIELDS` | UI → background → content script | Fetch the currently detected fields for the active tab |
| `FILL_FIELDS`         | UI → background → content script | Fill the page using a resolved mapping                 |
| `LEARN_FORM`          | UI → background → content script | Capture the current mapping as a form template         |
| `GET_ACTIVE_PERSONA`  | UI → background                  | Fetch the currently active persona                     |
| `OPEN_SIDE_PANEL`     | UI → background                  | Open the side panel for the current window             |

The background service worker is the only receiver; UI contexts never message tabs directly, and the content script never calls into UI contexts. This keeps message flow auditable and lets the worker maintain state that spans contexts (badge, side panel).

## Classification pipeline

The content script's Detector traverses the DOM, including open shadow roots, and collects candidate fields with their surrounding context. The Classifier then decides, for each candidate, which persona field (if any) it represents.

**Signals.** Each candidate is scored from multiple signals:

- the `autocomplete` attribute
- the `name` attribute
- the `id` attribute
- the input `type`
- the associated `<label>` text
- `aria-label`
- `placeholder`
- nearby text (annotations around the field)
- form context (fieldset legends, surrounding headings, the form's purpose)
- `select` options (for select elements, the option labels and values)

**Dictionary.** Label-based signals are matched against a per-locale dictionary. Version 0.1 ships with English and German entries. The dictionary maps field concepts (for example "first name" or "postal code") to locale keyword lists, and an autocomplete map links standard HTML `autocomplete` tokens to persona fields.

**Confidence scoring.** Scoring is conceptual, not a bag of magic numbers:

- Each signal contributes weight according to how reliable it is; an explicit `autocomplete` token counts for more than a distant nearby-text match.
- Signals that agree on the same persona field earn an agreement bonus.
- Signals that disagree (for example, label says "email" but `name` says "phone") do not simply cancel out: the field is flagged `needsReview` and surfaces in the UI for a manual decision instead of being filled blindly.
- Candidates whose confidence clears the auto-suggestion threshold (0.75) are proposed automatically; anything below needs explicit user mapping.

The output is a list of detected fields, each with a proposed persona field, a confidence score, and review flags.

## Template and learning model

A `FormTemplate` is deliberately site-agnostic. It records:

- the hostname the mapping was learned on
- an optional path pattern to narrow when it applies
- the field mappings (detected field identity → persona field)

Templates intentionally do not bind to DOM selectors unique to one page. This lets a learned mapping be reused across environments of the same site (staging and production share a hostname or structure) and across similar sites. When filling, the mapping engine resolves in this order: saved template overrides, then manual overrides made in this session, then automatic suggestions from the classifier. "Learn This Form" persists the currently applied mapping as a template.

## Storage keys

All persistence goes through `StorageService` into `chrome.storage.local` under these keys:

| Key                | Contents                                                           |
| ------------------ | ------------------------------------------------------------------ |
| `pp:personas`      | Saved personas (all fields, per persona)                           |
| `pp:templates`     | Learned form templates (hostname, optional path pattern, mappings) |
| `pp:settings`      | Extension settings (active persona reference, UI preferences)      |
| `pp:scenarios`     | Scenario definitions for multi-step flows                          |
| `pp:recentActions` | Bounded log of recent fill/scan actions for the UI                 |

The key names are internal to the extension. Because every read and write goes through `StorageService`, the backend can be swapped without touching domain or UI code.

## Extension points

- **New persona preset.** Add a locale preset (data pools, formats) to the generator in `src/domain/` and cover its deterministic derivations with tests.
- **New label language.** Add dictionary entries and, where needed, autocomplete map tokens to the classifier; tests must cover the new mappings.
- **Alternative storage backend.** Implement the `StorageService` interface; the chrome, preview, and in-memory implementations show the contract.
- **Optional sync.** The storage abstraction is the seam where an optional sync layer could later live (see the roadmap). Nothing syncs today: the current implementations are strictly local.

## Build pipeline

`npm run build` runs, in order:

1. `tsc` — strict typecheck of the whole project.
2. `vite build` — the main build. It bundles the background service worker (`background.js`) and the three extension pages (popup, side panel, options) as HTML entries with hashed JS/CSS assets under `dist/assets/`.
3. `vite build --config vite.content.config.ts` — the content script build, without clearing `dist/`. It produces a single self-contained `dist/content.js`.
4. `scripts/prepare-dist.mjs` — validation. It fails the build if any file the manifest references is missing from `dist/` or if versions in `package.json`, `public/manifest.json`, and `src/shared/version.ts` drift apart.

The content script is built separately as an IIFE because MV3 content scripts are declared as plain scripts in the manifest and cannot rely on ES module imports being resolvable in the page's isolated world. The whole content pipeline (detector, classifier, fill runner) must therefore be bundled into one file with no runtime imports.

## Limitations

Stated honestly, version 0.1 does not support:

- Cross-origin iframes (`all_frames` is `false`; only the top frame is handled).
- Closed shadow roots (the Detector reads open shadow DOM only).
- Browser-restricted pages such as `chrome://` pages, the Chrome Web Store, and the PDF viewer.
- Canvas-based inputs.
- Heavy custom widget libraries out of the box; these often need manual mapping.
- Label languages other than English and German (only partial recognition elsewhere).
- Sites with anti-automation heuristics may flag or reject programmatic fills.
