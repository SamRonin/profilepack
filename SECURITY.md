# Security Policy

## Supported versions

ProfilePack is a young project. Security fixes are applied to the latest release line only.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

Older or forked builds are not supported. Always run the latest build from `main` when testing.

## Reporting a vulnerability

**Do not open a public issue for a security report.**

Please report vulnerabilities privately using GitHub's built-in **"Report a vulnerability"** feature (Security Advisories) on the repository at https://github.com/SamRonin/profilepack/security/advisories/new.

There is no separate security email address at this time. GitHub advisories are the only supported private reporting channel.

When reporting, please include:

- The extension version and Chrome version used.
- A description of the issue and its impact.
- Step-by-step reproduction instructions, including a minimal HTML page or website where the issue can be observed.
- Any relevant console output or screenshots (with sensitive data removed).

## Scope

ProfilePack is a local-first developer and QA tool. It makes the following guarantees, and violations of these invariants are treated as security issues:

- **Persona data never leaves the device.** All data lives in `chrome.storage.local`. The extension must not make network requests, collect analytics, or transmit any user or persona data.
- **Sensitive fields are never filled.** Password fields, payment/credit card fields, and consent checkboxes (newsletter, terms of service) must never be filled by the fill engine.
- **Forms are never auto-submitted.** The extension fills fields but must never submit a form or trigger a submit event.

Also in scope: privilege escalation via the message protocol, injection of content into unintended contexts, storage corruption that could leak data between sites, and any behavior that would expose persona data to a third party.

Out of scope:

- Vulnerabilities in websites being tested that are merely made visible by form filling (for example, a site that echoes input back unescaped).
- Data the user deliberately exports or shares themselves.
- Issues requiring physical access to an unlocked machine.

## Response expectations

These are goals for a volunteer-maintained project, not guarantees:

- Acknowledgment of a private report within approximately 7 days.
- A fix, a mitigation, or a status update within approximately 30 days.

If a fix requires a release, it will be published through the normal release process and credited in the changelog unless the reporter prefers to remain anonymous.

## Safe harbor

ProfilePack will not pursue legal action against security researchers who act in good faith and follow this policy. To qualify:

- Only test against websites and fixture pages you own or have permission to test, or against local fixture files from this repository.
- Do not access, modify, or exfiltrate data that does not belong to you.
- Do not use automated scanning that degrades service for others.
- Report findings privately and give maintainers reasonable time to fix the issue before any public disclosure.

Good-faith research that respects these rules is welcome and appreciated.
