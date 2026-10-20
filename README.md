# Writehand

Writehand helps you write better emails without leaving Outlook on the web. It revises, translates, replies and drafts new emails with your ChatGPT plan, your own OpenAI API key or Claude Code on your computer. Every result is shown as a preview first; nothing is written to your draft until you approve it, and Writehand never sends email.

Writehand has two parts: a browser extension for Firefox, Edge, Chrome and Brave, and a small helper app on your computer that holds the AI connection.

## Install

1. Install the extension. Store listings are on their way: Firefox Add-ons and Microsoft Edge Add-ons first, then the Chrome Web Store (which Brave uses).
2. The welcome page opens and shows a one-line command that installs the helper app for your user account. No administrator rights are needed.

   macOS and Linux (Terminal):

   ```sh
   curl -fsSL https://github.com/dervisgenc/email-writer/releases/latest/download/install.sh | sh
   ```

   Windows (PowerShell):

   ```powershell
   irm https://github.com/dervisgenc/email-writer/releases/latest/download/install.ps1 | iex
   ```

   The command downloads the helper app for your system from the latest release, checks its SHA-256 checksum, installs it in your user folder and registers it with Firefox, Chrome, Edge and Brave.

3. Choose how to connect (ChatGPT plan, OpenAI API key or Claude) and try a sample revision. Then open a draft in Outlook; the Writehand toolbar appears next to it.

To uninstall the helper app (add `--delete-data` or `-DeleteData` to also sign out of ChatGPT and delete saved keys):

```sh
curl -fsSL https://github.com/dervisgenc/email-writer/releases/latest/download/install.sh | sh -s -- uninstall
```

```powershell
& ([scriptblock]::Create((irm https://github.com/dervisgenc/email-writer/releases/latest/download/install.ps1))) -Uninstall
```

## Features

- **Revise, translate, reply and compose** from a toolbar next to the Outlook draft. Results appear as a preview first; nothing is written to your draft until you approve it.
- **Conversation context:** replies use the messages you opened in the same conversation. You can see, edit or remove every message before it is used.
- **Rich content:** results can contain lists, tables and simple bar charts, written to the draft as email-safe HTML.
- **Change the result:** turn it into a table or bullet points, add a chart, shorten it, make it more formal or friendlier, or ask for any other change.
- **Flexible languages:** translate into any language, keep favourites in the Translate menu and set standing writing instructions (for example "always formal").
- **Interface languages:** English, Turkish, German, French and Spanish, or automatic from the browser language.
- **AI connection methods:** your ChatGPT Plus/Pro plan (Sign in with ChatGPT), your own OpenAI API key, or your Claude subscription through Claude Code on your computer (experimental).

## How it works

```text
Outlook on the web ─ extension (preview, approval, writing to the draft)
                         │ native messaging, only with your permission
                         ▼
                   helper app on your computer ─ ChatGPT / OpenAI API / Claude Code
```

A browser extension cannot listen for the ChatGPT sign-in callback on your computer, start Claude Code or keep secrets outside the browser, so the helper app does that part. The browser starts it only when Writehand asks for something, and only for Writehand's extension IDs. The extension asks for permission to talk to it on the welcome page.

The helper app is a single program (no Node.js needed) for macOS (Apple silicon and Intel), Linux (x64 and arm64) and Windows (x64; Windows on Arm through emulation). It can update itself from the extension's settings: it downloads only releases of this repository and installs them only after checking the Ed25519 signature of `SHA256SUMS` and the archive's checksum.

## Privacy

- Writehand never sends email; sending is always up to you.
- Text goes to the AI provider you chose (OpenAI or Anthropic) only when you request a revision, translation, reply or new email. There is no Writehand server, analytics or error reporting.
- Emails you open are kept in memory only while the page is open and are never written to disk.
- Sign-in tokens and API keys are stored by the helper app in a file only your user account can read, never in browser storage.
- While update checks are on (the default), the helper app asks GitHub for the latest version number at most once a day. You can turn this off in the settings.

To report a security issue privately, see the [security policy](./SECURITY.md).

## Status

Not yet published to browser stores. Reading, context, preview and controlled writing to the draft have been verified live in Outlook on the web (Firefox on macOS, with Claude Code), including rich tables, undo and re-apply; generation has also been verified with a ChatGPT Plus account. The helper app has been verified on macOS, Linux and Windows 11 (Chrome, Edge, Brave and Firefox). The single-file helper, its installers and the welcome wizard were verified on Linux; CI builds and installs the helper on every supported system.

## Development

Requirements: Node.js 22+ (24 LTS to build the single-file helper), pnpm 12.

```sh
pnpm install
pnpm dev            # develop in Chromium (real AI connection)
pnpm dev:firefox    # develop in Firefox
pnpm check          # typecheck, lint, format, tests, builds for both browsers, package checks
pnpm test:e2e       # Chromium end-to-end tests on a synthetic Outlook page
pnpm test:firefox   # Firefox smoke test
pnpm ai:build       # helper app as a Node.js script
pnpm ai:install     # install that build for your browsers (add --extension-id=ID for an unpacked Chromium build)
pnpm ai:sea         # single-file helper app and its release archive (Node.js 24)
```

Releases are built by GitHub Actions from `vX.Y.Z` tags; see the [developer guide](./docs/GELISTIRICI_REHBERI.md#sürümleme-ve-yayın) and [building from source](./docs/BUILD.md).

## Project structure

```text
apps/browser-extension/        WXT extension: entry points, welcome wizard, controllers, mounting, platform helpers, locales
apps/ai-companion/             Helper app: native messaging host, installer, updater, install scripts
packages/ai-openai/            ChatGPT OAuth, model discovery and Responses API adapter
packages/ai-claude-code/       Runs the user's Claude Code in a restricted print mode
packages/contracts/            Shared data and action definitions, boundary schemas, brand, AI prompt
packages/core/                 Context, action preparation, session state and write preconditions (pure functions)
packages/email-format/         Limited Markdown to email-safe HTML, plain text and verification text
packages/ui/                   Vue panel, toolbar, result card, settings and setup components
packages/mail-connectors/
  outlook-web/                 Reads, observes and writes Outlook on the web pages in a controlled way
tests/                         Unit, contract, integration and end-to-end tests with synthetic samples
.github/workflows/             CI on Linux, macOS and Windows; signed draft releases
```

## Documentation

The detailed documentation is written in Turkish.

- [Developer guide](./docs/GELISTIRICI_REHBERI.md)
- [AI connection and helper app](./docs/AI_BAGLANTISI.md)
- [Building from source](./docs/BUILD.md) (English)
- [Outlook on the web page verification](./docs/outlook-web-dogrulama.md)
- [Project plan](./PROJE_PLANI.md) and [implementation details](./implementation_details.md)
- [Browser and account matrix](./tests/manual/browser-matrix.md)
- [Changelog](./CHANGELOG.md) and [work log](./YAPILAN_ISLER.md)

## License

Writehand is open source under the [MIT License](./LICENSE).
