# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Persian form-label dictionary** — the classifier now recognizes common Persian labels (نام، نام خانوادگی، شماره موبایل/همراه، کد پستی، نشانی/آدرس، استان، شهر، ایمیل، کدملی and more). The tokenizer preserves Arabic-script text, folds ZWNJ (نیم‌فاصله), Arabic Yeh/Kaf variants and Persian digits, and splits Latin/Arabic-script boundaries. Persian national ID (کد ملی) is classified `neverFill` — the SSN equivalent is never automated.
- **Custom ARIA combobox support** — `[role="combobox"]` widgets (Radix UI, React-Select, Headless UI) are detected (options read from the associated listbox via `aria-controls`/`aria-owns`, root-aware) and filled by simulating focus, ArrowDown (open), option activation (pointer/mouse/click) and Enter; input-based comboboxes without reachable options fall back to value-change simulation.
- **Playwright E2E suite** — `@playwright/test` devDependency, `playwright.config.ts` (Chromium + `--disable-extensions-except=./dist` / `--load-extension=./dist`), a zero-dependency fixtures server (`scripts/e2e-server.mjs`) and `tests/e2e/fill.spec.ts` driving the real scan → map → fill pipeline in the built extension. Run with `npm run test:e2e` (build first).
- **Quick-fill keyboard shortcut** — new `quick_fill` command (`Alt+Shift+F`) fills the active page with the active persona without opening the popup; the background worker scans the tab, auto-maps recognizable fields (never `unknown`/`neverFill`) and dispatches the fill.

### Changed

- **`README.md` is now English** (the GitHub landing page for the global community); the Persian version moved to `README.fa.md` and `README.en.md` was removed. Both files carry language-switch links at the top. `docs/contributing.md` is now a redirect stub pointing to the root `CONTRIBUTING.md` (single source of truth).
- **package.json metadata** — `author` field added (`SamRonin (https://github.com/SamRonin)`); `homepage` and `bugs` verified to point at the GitHub repository.
- **UI typography** — locally bundled `Inter` (Latin) and `Vazirmatn` (Persian/RTL) fonts via `@fontsource` packages; no remote font requests, CSP-friendly. RTL pages lead with Vazirmatn, LTR with Inter; explicit `.pp-ltr` / `.pp-rtl` direction/alignment helper classes and font inheritance for form fields.
- **`all_frames: true`** — the content script now runs in subframes too. Message listeners stay per-frame, the per-frame load guard prevents duplicate listeners, and only the top frame reports the badge, so multi-frame pages cause no message interference or badge spam.
- **Shadow DOM traversal hardened** — recursive open-shadow-root collection now documented and extended: `aria-labelledby` resolves within the element's own tree (document or shadow root) and the owning `<form>` is found across shadow boundaries via the host chain.
- **Framework-safe event dispatch** — after a native-prototype value change, `input` and `change` are dispatched synchronously and a `blur` (+ bubbling `focusout`) is dispatched deferred via `queueMicrotask`, so React, Vue and Formik validation cycles settle without state races.

### Fixed

- Persian (and other Arabic-script) labels were silently dropped by the tokenizer (`[^a-z0-9]` split) and never matched — they now classify correctly.

## [0.3.0] - 2026-10-08

### Changed

- **Persian (فارسی) is now the project's primary language; English is complementary.**
  - Manifest metadata falls back to Persian (`default_locale: fa`): browsers running neither English nor Persian now see the Persian name/description/tooltip.
  - The "Auto" UI language now resolves to Persian for every browser language other than English (previously: English). Explicit English/فارسی choices are unaffected.
  - `src/shared/i18n/fa.ts` is the source-of-truth dictionary: `MessageKey` derives from it and `en.ts` is type-checked against it.
  - Static extension pages (`popup`, `sidepanel`, `options`) now ship with `lang="fa" dir="rtl"` as their initial state, and the language switchers list فارسی before English.
  - The README is now Persian-first: the main `README.md` is in Persian and the English version moved to [README.en.md](README.en.md) (the former `README.fa.md` was merged into `README.md`).
- Version bumped to 0.3.0 (package.json, manifest.json, `APP_VERSION`).

## [0.2.0] - 2026-10-08

### Added

- Bilingual UI: full English and Persian (فارسی) translations across the popup, side panel, and options page.
- Right-to-left (RTL) layout support when the UI language is Persian (`dir="rtl"` on the document root).
- UI language setting (Auto / English / فارسی) in the popup footer and Options; `auto` follows the browser language and is stored in settings.
- Localized manifest metadata via Chrome `_locales` (`en` + `fa`, `default_locale: en`) for name, description, toolbar tooltip, and keyboard shortcut description.
- Persian README ([README.fa.md](README.fa.md)) linked from the English README.
- i18n unit tests: EN/FA dictionary key parity, interpolation-token parity, language resolution, and translation output.

### Fixed

- The "Learn This Form" toggle no longer disappears after entering learn mode; "Cancel learning" is now reachable (the button was previously rendered inside the block that hides the fill button while learning).

### Changed

- Scan limitations are now structured data (`{ kind, count }`) produced by the scanner and localized in the UI at render time, instead of pre-rendered English strings.
- Version bumped to 0.2.0 (package.json, manifest.json, `APP_VERSION`).

## [0.1.0] - 2026-10-08

### Added

- Persona manager: create, edit, duplicate, activate, and delete synthetic personas.
- Synthetic persona generator with four presets: German customer, US customer, UK customer, Japanese customer.
- Deterministic field derivation: given a persona, derived fields (email, username, and other dependent values) are generated consistently from the persona's core attributes.
- Multi-signal form detection and field classification (English and German label dictionaries) with confidence scores.
- Manual mapping, "Learn This Form", and site-agnostic form templates for reusing a mapping across sites.
- Fill engine with React, Vue, and Angular compatibility: native setters plus dispatched input/change events, without submitting forms.
- Select handling (by label, value, or ISO code) and date field handling.
- Popup, side panel, and options page UI.
- Keyboard shortcut `Alt+P` to open ProfilePack.
- Local-only storage: all data stays in `chrome.storage.local` on the user's device.

[Unreleased]: https://github.com/SamRonin/profilepack/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/SamRonin/profilepack/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/SamRonin/profilepack/releases/tag/v0.1.0
