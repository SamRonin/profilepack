# Chrome Web Store listing draft

**Status: NOT YET PUBLISHED.** This document is preparation material for a future Chrome Web Store submission. ProfilePack is not currently listed on the Chrome Web Store, and nothing in this repository should be read as claiming otherwise.

## Extension name

ProfilePack

## Short description

Maximum 132 characters. Current draft:

```text
Build one synthetic test persona. Reuse it across the web. Local-first form filling for developers and QA.
```

## Detailed description

Plain text for the store listing. Honest scope, no marketing claims:

```text
ProfilePack is a local-first Chrome extension for developers and QA engineers
who test web forms. Instead of typing the same test data into the same forms
again and again, or using a random form filler that produces inconsistent
values, you build one synthetic test persona and reuse it everywhere.

A persona is a complete, internally consistent fictional person. Fields are
derived deterministically from the persona: a German persona named Anna
Mueller gets the email anna.mueller@example.test, the username anna-mueller,
a German locale, and a German address format. The same persona produces the
same values in every form, which keeps multi-step flows and cross-site tests
consistent.

How it works:
- Create a persona from a preset (German, US, UK, or Japanese customer) or
  edit every field by hand.
- Open the page you are testing and run a scan. ProfilePack detects form
  fields, including fields inside open shadow DOM, and classifies them using
  multiple signals (autocomplete, name, id, type, label, aria-label,
  placeholder, nearby text, form context, select options) with confidence
  scores. English and German labels are recognized.
- Review the suggested mapping, adjust anything manually, and fill. The fill
  engine sets values through native setters and dispatched input and change
  events, so it works with React, Vue, and Angular apps. Select fields can be
  matched by label, value, or ISO code; date fields are handled too.
- Save the mapping with "Learn This Form" as a form template. Templates are
  site-agnostic (hostname plus optional path pattern), so a mapping learned on
  staging can be reused on similar forms elsewhere.

What ProfilePack deliberately does not do:
- It never fills password fields, payment or credit card fields, or consent
  checkboxes such as newsletter or terms opt-ins.
- It never submits forms. It fills fields and stops.
- It never sends data anywhere. There are no network requests, no analytics,
  no telemetry, and no accounts. Everything is stored locally in your browser.

Known limitations in this version: cross-origin iframes are not supported,
closed shadow DOM cannot be read, browser-restricted pages (chrome:// pages,
the Chrome Web Store, the PDF viewer) are not supported, canvas-based inputs
are not supported, and heavy custom widget libraries may need manual mapping.
Only English and German form labels are recognized so far.

ProfilePack is an open-source developer tool under the MIT license.
```

## Privacy explanation

For the listing's privacy section and the data-use disclosures:

- ProfilePack stores personas, templates, settings, and action history in `chrome.storage.local` on the user's device. There is no server, no sync, no account.
- The extension makes no network requests, collects no analytics or telemetry, and tracks nothing.
- All generated data is synthetic and uses reserved or fictional values: emails use `@example.test` / `@example.com`, US phone numbers use the reserved 555-01XX range, UK phone numbers use the reserved 01632 960XXX range. The extension never asks users to enter real personal data, and it does not read data from the page beyond form fields needed for mapping.

## Permission justifications

Wording intended to survive a store review:

- **`storage`** — "ProfilePack saves personas, form templates, settings, and recent actions locally with `chrome.storage.local`. This is the extension's only data store; no data is transmitted anywhere."
- **`scripting`** — "Used to re-inject ProfilePack's own bundled content script into the active tab when the page was opened before the extension was installed or reloaded, so scanning works without forcing the user to manually refresh every tab. Only the extension's own content script is injected; no remote or arbitrary code is ever executed."
- **`sidePanel`** — "Enables the optional side panel UI, which provides more room than the toolbar popup for managing personas and reviewing detected fields side by side with the page under test."
- **`host_permissions` (`http://*/*`, `https://*/*`)** — "ProfilePack is a form-testing tool: it must detect and fill forms on whatever site the user is developing or testing, which can be any website. Broad host access is required for the content script to run on the page under test. Host access is used only for DOM detection and form filling. The extension does not read browsing history, cookies, or network traffic, and does not send any data to any server. No other host-related APIs (`tabs`, `history`, `cookies`, `webRequest`, `downloads`) are requested."

A single-purpose statement for the review form: "Fill web forms with synthetic test personas for development and QA testing."

## Icon and screenshot placeholders

No store assets exist yet. When producing them, capture the real UI; do not use mock-ups that misrepresent the product.

- **Icon** — the 128x128 extension icon (the same asset referenced as `icons/icon128.png` in the manifest) exported as the store icon. It should remain legible at 16x16.
- **Screenshot 1 — popup:** the popup open on a form page, showing the active persona and the scan results with confidence scores. Use a fixture form or a demo site, never a real user's data.
- **Screenshot 2 — side panel:** the side panel next to a form showing detected fields and the mapping before filling, so reviewers and users can see the review step.
- **Screenshot 3 — options/persona editor:** the persona editor displaying a generated persona with clearly synthetic values (`@example.test` email, 555-01XX phone).
- **Screenshot 4 — after fill:** the form from screenshot 1 after filling, with password and payment fields visibly untouched.

Screenshots must be 1280x800 (640x400 is also accepted by the store). Check the current Publisher Dashboard requirements at submission time.

## Category

Developer Tools.

## Publishing checklist

1. Finalize the icon and screenshots described above.
2. Bump the version in `package.json`, `public/manifest.json`, and `src/shared/version.ts`, update `CHANGELOG.md`, and produce a release zip (the Build workflow artifact for a `v*` tag).
3. Register a Chrome Web Store developer account and pay the one-time registration fee.
4. In the Publisher Dashboard, create a new item and upload the `dist/` zip.
5. Fill in the store listing from this document: name, short description, detailed description, category, icon, and screenshots.
6. Complete the privacy tab: single purpose statement, per-permission justifications (above), and data-use disclosures (no data collected, no data transmitted, compliance with the user data policies).
7. Expect an in-depth review because of the broad host permissions; respond to reviewer questions citing the justifications above.
8. After approval, keep the listing in sync with releases: update the description and version on every published change.
