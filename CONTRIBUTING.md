# Contributing to ProfilePack

Thanks for your interest in contributing. ProfilePack is a local-first Chrome Extension (Manifest V3) that builds synthetic test personas and reuses them consistently across web forms. This guide walks you through everything needed for a first pull request.

## Ways to contribute

- **Code** — fix bugs, improve the fill engine, extend the classifier, or add UI features.
- **Documentation** — improve the guides in `docs/`, clarify setup steps, or fix inaccuracies.
- **Test fixtures** — add HTML pages to `fixtures/` that reproduce real-world form patterns (framework widgets, shadow DOM, unusual field types).
- **Translations** — extend the classifier's label dictionary and autocomplete map so more label languages are recognized.
- **Triage** — reproduce reported bugs, confirm duplicates, and add reproduction details to issues.

## Project setup

Prerequisites: Node.js >= 20 with npm, and Chrome 116 or newer.

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/<your-username>/profilepack.git
cd profilepack
npm install
```

Build and load the extension:

```bash
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `dist/` directory of your checkout.
4. Pin the ProfilePack icon to the toolbar.

For development, run the watch build:

```bash
npm run dev
```

This runs one initial full build (so `dist/` is always loadable), then keeps both Vite watch processes (extension pages/background and content script) running.

After code changes:

1. The watch build regenerates `dist/` automatically.
2. Open `chrome://extensions` and click the **reload** icon on the ProfilePack card (extension pages and the service worker are replaced; the content script is not).
3. Refresh the tab you are testing so it picks up the new content script. If a page was opened before the extension was installed or reloaded, ProfilePack can also re-inject its content script on demand (the `scripting` permission covers this).

## Running tests, lint, typecheck, and build

```bash
npm run test          # run the vitest suite once
npm run test:watch    # run vitest in watch mode
npm run lint          # ESLint (flat config)
npm run typecheck     # tsc, strict mode
npm run build         # typecheck + both vite builds + dist validation
npm run format        # Prettier (write)
npm run format:check  # Prettier (check only)
```

`npm run build` also validates that `dist/` contains everything the manifest references and that versions in `package.json`, `public/manifest.json`, and `src/shared/version.ts` are in sync. CI runs lint, typecheck, tests, and build on every pull request; all of them must pass.

## Project layout

```
src/
  background/   Background service worker: message router, badge updates, onInstalled seeding
  content/      Content script (bundled as IIFE): detection, classification, and fill in the page
  popup/        Toolbar popup UI (React)
  sidepanel/    Side panel UI (React)
  options/      Options page UI (React)
  domain/       Framework-free domain logic: persona model, generator, presets, classifier, templates
  storage/      StorageService abstraction and implementations over chrome.storage.local
  services/     Application services orchestrating domain + storage + messaging
  shared/       Shared types, constants, and the message protocol
  ui/           Shared UI components and styling
tests/          Vitest unit and jsdom integration tests
fixtures/       Standalone HTML pages used by tests and for manual testing
```

The guiding rule: `src/domain/` contains pure logic with no Chrome API, framework, or DOM assumptions beyond what is passed in. This keeps it testable and reusable.

## Adding a new preset persona

Persona presets define how a synthetic persona is generated for a locale. To add one (for example, a French customer):

1. Look at the existing presets in the domain layer (`src/domain/`) — currently German, US, UK, and Japanese customers — and follow the same shape: a preset defines the locale, name pools, address format, phone format, and other locale-specific data.
2. All derived fields must stay internally consistent and deterministic: given the same persona, the same email, username, and address are produced every time. Use reserved or fictional values only (for example `@example.test` / `@example.com` emails, the reserved 555-01XX range for US phones).
3. Register the preset with the persona generator and the preset list surfaced in the UI.
4. Add unit tests covering the deterministic derivations of the new preset (name to email/username consistency, locale-specific formats).
5. Run `npm run test` and `npm run typecheck`.

## Adding a new label language to the classifier

The classifier recognizes form fields from multiple signals (autocomplete attribute, `name`, `id`, `type`, label text, `aria-label`, placeholder, nearby text, form context, and select options). Label recognition is driven by a per-locale dictionary plus an autocomplete map. To add a language:

1. Find the classifier dictionary and autocomplete map in the domain layer (`src/domain/`). The dictionary maps field concepts (for example "first name", "postal code") to locale keyword lists; the autocomplete map links HTML `autocomplete` tokens to persona fields.
2. Add the keyword entries for the new language, matching the structure of the existing English and German entries. Prefer terms users actually see on real forms.
3. Extend the autocomplete map only where the new language changes token handling; standard `autocomplete` tokens are language-independent.
4. Add tests that cover the new mappings: fixture-style label strings from the new language must classify to the correct persona field with expected confidence behavior. Tests must cover new mappings for a language contribution to be merged.
5. Update `docs/architecture.md` if you change how classification works (not needed for pure dictionary additions).

## Coding conventions

- **TypeScript strict mode.** No `any`, no `as any`, no `@ts-ignore`. Use the type system; unknown data gets narrowed.
- **Domain logic stays framework-free and UI-free.** Nothing in `src/domain/` may import React, Chrome APIs, or DOM globals. UI and platform code adapt to the domain, not the other way around.
- **Named exports.** Avoid `export default`.
- **Formatting.** Prettier is the single source of formatting truth — run `npm run format` before committing and keep `npm run format:check` green.
- **Lint.** ESLint 9 flat config with typescript-eslint; keep `npm run lint` clean.
- **Messages.** Cross-context communication uses the typed message protocol in `src/shared/`. All responses are `{ ok: true; data } | { ok: false; error }`.
- **Privacy invariants.** Never add network requests, analytics, or telemetry. Never fill password, payment, or consent fields. Never submit forms. Never touch data outside `chrome.storage.local`.

## Commit conventions

ProfilePack uses [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new user-facing capability
- `fix:` bug fix
- `docs:` documentation only
- `test:` tests only
- `refactor:` code change that neither fixes a bug nor adds a feature
- `chore:` tooling, CI, dependencies, housekeeping

Examples: `feat: add postal code dictionary terms for Japanese`, `fix: keep select mapping when option labels change`, `docs: clarify dist reload steps`.

## Branch naming

Create feature branches off `main`:

- `feat/<short-topic>` — features and enhancements
- `fix/<short-topic>` — bug fixes
- `docs/<short-topic>` — documentation changes

## Pull request process

1. Keep PRs small and focused. One logical change per PR is much easier to review.
2. Use the pull request template and fill in every section, including how you tested the change.
3. Make sure CI passes (lint, typecheck, tests, build). CI failures block review.
4. Maintainers review the change. Address feedback with new commits; squash-merge is applied at merge time.
5. For UI changes, include screenshots before requesting review.

If a change touches permissions, the manifest, or anything that sends data anywhere (it should not — see the privacy invariants above), call this out explicitly in the PR description.

## Questions

For setup questions, design discussions, or "would this fit ProfilePack" ideas, open a thread in [GitHub Discussions](https://github.com/SamRonin/profilepack/discussions) rather than an issue. Issues are for concrete bugs and accepted enhancements.
