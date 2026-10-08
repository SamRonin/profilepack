# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

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

[Unreleased]: https://github.com/SamRonin/profilepack/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/SamRonin/profilepack/releases/tag/v0.1.0
