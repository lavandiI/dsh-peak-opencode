# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.4.x | Yes |
| Earlier | No |

Only the latest published minor line receives fixes.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private vulnerability reporting:

- <https://github.com/lavandiI/dsh-peak-opencode/security/advisories/new>

Include the affected version, the DSH version, steps to reproduce, and the impact you see. Reports are handled on a best-effort basis; please allow time for a fix before public disclosure.

## Scope and attack surface

The plugin is a client-side band and a small host route, and it ships no secrets:

- **No credentials.** The OpenCode Go catalog at `https://opencode.ai/inference/go/v1/models` is public and needs no API key. The plugin never reads DSH credentials.
- **Untrusted catalog data.** Model names, prices and multiplier rules are rendered as text in the band and settings. A malicious or malformed catalog should only produce wrong labels or a broken band, not code execution; if you find a path where catalog text escapes into markup, that is a vulnerability.
- **Host route.** `/dsh-peak-opencode/models` serves a cached JSON snapshot. It does not accept parameters beyond `?refresh=1` and does not expose profile data.
- **Local storage and CSS.** Custom CSS is applied from the plugin's own settings in the user's browser; it is user-authored code by design, like a user stylesheet.
- **DOM contract.** Positioning relies on `data-composer-card` and the `conversation.input.dock` slot. A host change can hide the band; that is a compatibility issue, not a security one.

Dependencies are the DSH-provided React runtime and Node's standard library; the package declares no third-party runtime dependencies, so there is no supply chain beyond npm itself.
