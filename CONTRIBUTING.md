# Contributing

Thanks for taking the time to improve **dsh-peak-opencode**. This is a small, dependency-free plugin for DeepSeek Harness, so the workflow is deliberately simple.

## Requirements

- Node.js **22.19+** or **24+** (see `engines` in `package.json`).
- DeepSeek Harness for manual UI checks. The plugin is usually installed from a local path while developing.

## Setup

```bash
git clone https://github.com/lavandiI/dsh-peak-opencode.git
cd dsh-peak-opencode
npm test
```

There is no build step: the client half is plain ESM served from `lib/client.js`. To try a change in DSH, install the folder as a local bundle:

```text
plugin_manager action=install_bundle target=<path-to-plugin>
```

or use **Settings → Plugins → Install** and point it at the cloned folder, then refresh the Web GUI page. The host half (`lib/index.js`) is loaded on DSH startup, so changes to it need a DSH restart; the client half is picked up by a page refresh.

## Project layout

| Path | Purpose |
| --- | --- |
| `lib/client.js` | The band, settings panel, catalog parsing, all eight language dictionaries and the direct fallback request. |
| `lib/index.js` | Host half: fetches and caches the OpenCode Go catalog, serves `/dsh-peak-opencode/models`. |
| `locale/<lang>.json` | Plugin manager metadata: title, short description and `meta.detail`. |
| `detail/<lang>.md` | Long description shown on the plugin page in Plugins. |
| `test/render.cjs` | Renders the band and settings against a React stub; checks phases, prices, translations and the settings behavior. |
| `test/host.mjs` | Checks the host catalog route against the real endpoint format. |

## Translations

User-visible text lives in the `MESSAGES` dictionaries in `lib/client.js` (one section per language). If you add or change a string:

1. Add it to **all eight** dictionaries (`en`, `ru`, `zh`, `ja`, `es`, `fr`, `de`, `pt`). Keep `{placeholders}` intact.
2. Update the matching `detail/<lang>.md` page if the change affects the plugin description.
3. Run `npm test`: it fails on raw keys leaking into the settings panel, and the README test enforces the language-file layout.

The plugin always follows the DSH interface language; there is deliberately no separate language switch.

## Commits and pull requests

- Use short, imperative commit subjects, ideally [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- Keep the diff focused; update `CHANGELOG.md` for user-visible changes.
- Before opening a PR, run:

  ```bash
  npm test
  npm pack --dry-run
  ```

- UI changes should be checked in a real DSH window; attach a screenshot and mention the window width, since the band's layout is responsive.
- Do not commit `artifacts/`, screenshots of personal conversations, API keys, tokens or local absolute paths. `.gitignore` already excludes the common cases.

## Reporting bugs and requesting features

Use the issue templates. A useful bug report includes:

- plugin version and DSH version;
- provider and model id (for example `opencode-go / longcat-2.5-preview-free`);
- DSH interface language;
- expected and actual behavior, plus the renderer console error if there is one;
- a screenshot for layout issues, with the window width.

For security issues, please follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Code of conduct

Participation is covered by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
