# ProfilePack

> **Build one synthetic test persona. Reuse it across the web.**

یک Persona مصنوعی بسازید و همان را در سراسر وب برای تست فرم‌ها استفاده کنید.

[فارسی](README.md) | **English**

ProfilePack is a local-first Chrome extension (Manifest V3) for developers and QA engineers who test signups, checkouts, billing, onboarding and multi-step flows. Instead of random form-filler noise, you get **one consistent synthetic persona** — the same name, email, address and locale on every page of the journey.

```text
Persona: Anna Müller
First name:   Anna
Last name:    Müller
Email:        anna.mueller@example.test
Username:     anna-mueller
Phone:        +49 89 7362541
Country:      Germany
City:         München
Postal code:  80331
Street:       Examplestraße 12
Company:      Müller Design GmbH
```

[![CI](https://github.com/SamRonin/profilepack/actions/workflows/ci.yml/badge.svg)](https://github.com/SamRonin/profilepack/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-0.3.0-blue)

---

> **Note:** the primary README of this project is the [Persian one](README.md) — ProfilePack is built first and foremost for Iranian and Persian-speaking users, and English is the complementary language. This file mirrors it in English.

## Problem

Traditional form fillers generate an independent random value per field:

```text
First Name  = John
Last Name   = Müller
Country     = Germany
Postal Code = 90210
Phone       = +1 555 0107
```

Inconsistent data breaks validation, breaks international forms, breaks multi-step flows, and makes bug reports unreproducible.

## Solution

ProfilePack keeps **one synthetic persona active** and fills every recognized field from it:

- Fields are classified from multiple signals (`name`, `id`, `type`, `autocomplete`, `label`, `aria-label`, `placeholder`, nearby text, form context, `<select>` options) with a **confidence score** and a human-readable reason.
- Ambiguous fields are flagged as _needs review_ — you decide once, the mapping is remembered in a reusable form template.
- Date fields are formatted per locale (`14.06.1994` / `06/14/1994` / `1994/06/14`), country selects match `Germany` / `Deutschland` / `DE` / `DEU`.
- Fill events use native setters + dispatched `input`/`change` events, so React, Vue and Angular forms pick the values up.

## Features (v0.3)

- **Persona manager** — create, edit, duplicate, activate, delete; four presets (German / US / UK / Japanese customer) with optional **seed** for fully reproducible personas
- **Deterministic derivation** — email, username and full name are derived from first/last name, never independently random
- **Multi-signal field detection** — English + German label dictionary, extensible
- **Confidence scoring** — every mapping has a score, evidence and review flag
- **Manual mapping + Learn This Form** — fill a form by hand, map its fields, save a site-agnostic template
- **Fill engine** — text/email/tel/url/number, `textarea`, `select` (value/label/ISO code/localized text), radio groups, checkboxes, `input[type=date]`, locale-formatted text dates, contenteditable; **never submits**, never touches passwords, payment or consent fields
- **SPA support** — debounced `MutationObserver` rescan, open **Shadow DOM** piercing
- **Popup + Side Panel + Options** pages, `Alt+P` shortcut, field-count badge
- **Persian-first UI (فارسی primary, English complementary)** — every popup, side panel and options string exists in both languages, with a full **right-to-left** layout in Persian. In Auto mode, any non-English browser (including unknown languages) gets the Persian UI. Manifest name/description are localized via `_locales` and fall back to Persian.
- **Local-only storage** (`chrome.storage.local`), JSON import/export

## Demo

> No demo GIF is bundled yet. Once captured, it will be embedded here (`docs/images/demo.gif`) — screenshots of the popup on the bundled `fixtures/*.html` pages are a good starting point.

## Installation (Load unpacked)

```bash
git clone https://github.com/SamRonin/profilepack.git
cd profilepack
npm install
npm run build
```

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the generated **`dist/`** folder
5. Pin ProfilePack and press `Alt+P` on any form

Requires Chrome 116+ (Side Panel API).

## Development

```bash
npm install        # install dependencies
npm run dev        # watch builds (pages + background + content script)
npm run build      # typecheck + build + validate dist/
npm run test       # vitest suite (108 unit + integration tests)
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run format     # prettier
```

After `npm run dev`, reload the extension in `chrome://extensions` to pick up rebuilds. See [docs/development.md](docs/development.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Architecture

```text
Popup / Side Panel / Options (React)
        ↓ typed messages
Background service worker (router, badge, first-run seeding)
        ↓ chrome.tabs messaging
Content script (IIFE, isolated world)
        ↓
Detector → Classifier → Mapping engine → Fill engine → Storage
                                              ↘ chrome.storage.local
```

Domain logic is framework-free and UI-free; storage sits behind a `StorageService` abstraction. Details: [docs/architecture.md](docs/architecture.md) (technical docs are in English).

## Privacy

- **Local-first:** personas, templates and settings live in `chrome.storage.local` on your device. Nothing is uploaded — the extension makes **no network requests at all**.
- **No analytics, no telemetry, no tracking, no accounts.**
- Generated data is synthetic by construction: emails use reserved `example.test` domains, US phone numbers use the reserved `555-01XX` range, UK numbers the reserved `01632 960XXX` range, streets are named Examplestraße / Example Street.
- Persona values are never written to the console, logs, URLs or error messages.

## Permissions

| Permission                                     | Why it is needed                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                      | Save personas, templates and settings locally (`chrome.storage.local`).                                                                                                                                                                                                                |
| `scripting`                                    | Re-inject the content script on demand into tabs that were open before install/reload.                                                                                                                                                                                                 |
| `sidePanel`                                    | Provide the Side Panel UI.                                                                                                                                                                                                                                                             |
| Host permissions (`http://*/*`, `https://*/*`) | The core purpose of the extension is detecting and filling forms on the sites you are testing. Host access is used exclusively for the content script (declared at `document_idle`, top frame only). No `tabs`, `history`, `cookies`, `webRequest` or `downloads` access is requested. |

## Languages

**Persian is the primary language of the project; English is complementary.** The extension UI ships in both:

| Where                                                        | Behavior                                                                                                                                                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Manifest (name, description, shortcut label)                 | Chrome picks the locale from the browser language (`_locales/fa` + `_locales/en`, `default_locale: fa`) — any language other than English falls back to Persian.                                                                     |
| Popup, Side Panel, Options                                   | Follows the **UI language** setting — Auto, فارسی or English — changeable in the popup footer and in Options. In Auto, only English browsers get English; everything else gets Persian. Persian renders right-to-left (`dir="rtl"`). |
| Scan results (field limits, review hints, buttons, statuses) | Fully translated; scan limitations are stored as structured data and localized at render time.                                                                                                                                       |

Note the distinction: this is about the **UI language**. The **form-detection dictionary** (matching website labels like "Vorname" / "PLZ") currently covers English and German — see the roadmap.

The primary documentation is in Persian: **[README.md](README.md)** — this file (`README.en.md`) is the complementary English translation.

## Testing

`npm run test` runs 108 Vitest tests covering field classification (EN/DE), confidence scoring, manual overrides, persona generation + determinism, storage persistence, template matching, select matching, date formatting, i18n (FA/EN dictionary parity, Persian-first language resolution, interpolation), the fill engine (jsdom) and end-to-end scan → map → fill flows against the HTML fixtures in [`fixtures/`](fixtures/).

## Contributing

Contributions welcome — bug reports, fixtures, dictionary terms, new presets, docs. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the good-first-issue areas in [docs/contributing.md](docs/contributing.md). Please read [SECURITY.md](SECURITY.md) before reporting anything security-related (use GitHub's private vulnerability reporting, not public issues).

## Roadmap

**v0.4** — more form-detection label languages (Persian and others), richer mappings, scenario improvements
**Future** — optional sync architecture (the storage abstraction already leaves room for it), team workflows, Playwright/Cypress export, AI-assisted mapping

Implemented features are tracked in [CHANGELOG.md](CHANGELOG.md).

## Known Limitations

- **Cross-origin iframes** are not scanned (top frame only, by design).
- **Closed Shadow DOM** cannot be read by any extension; the popup reports when closed roots are detected.
- **Browser-restricted pages** (`chrome://`, Chrome Web Store, PDF viewer) cannot run content scripts.
- Kanji/CJK/localized labels beyond English and German fall back to `autocomplete`/`type` signals or end up in _needs review_.
- The **UI** is Persian/English, but classifier evidence reasons and content-script diagnostic details remain English — they are developer-facing debug output.
- The Persian UI uses Latin digits and keeps technical tokens (JSON, locales like `de-DE`) untranslated, by design.
- Canvas-based inputs and heavily customized widget libraries need manual mapping.
- Sites with anti-automation heuristics may treat programmatic fills like any other autofill.
- ProfilePack never submits forms and never fills credentials — by design, not by accident.

## License

[MIT](LICENSE) © ProfilePack Contributors
