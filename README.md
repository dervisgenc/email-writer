# Email Writer

A browser extension that helps you write better emails without leaving your mail client. The first supported client is Outlook on the web. Manifest V3 packages for Chromium browsers (Chrome, Edge, Brave) and Firefox are built from one codebase.

## Features

- **Revise, translate, reply and compose** from a toolbar next to the Outlook draft. Results appear as a preview first; nothing is written to your draft until you approve it.
- **Conversation context:** replies use the messages you opened in the same conversation. You can see, edit or remove every message before it is used.
- **Rich content:** results can contain lists, tables and simple bar charts, written to the draft as email-safe HTML.
- **Change the result:** turn it into a table or bullet points, add a chart, shorten it, make it more formal or friendlier, or ask for any other change.
- **Flexible languages:** translate into any language, keep favourites in the Translate menu and set standing writing instructions (for example "always formal").
- **Interface languages:** English, Turkish, German, French and Spanish, or automatic from the browser language.
- **AI connection methods:** your ChatGPT Plus/Pro plan (Sign in with ChatGPT), your own OpenAI API key, or your Claude subscription through Claude Code on your computer (experimental).

## Privacy

- Email Writer never sends email; sending is always up to you.
- Text is sent to the AI provider you chose (OpenAI or Anthropic) only when you request a revision, translation or reply.
- Emails you open are kept in memory only while the page is open and are never written to disk.
- Sign-in tokens and API keys are stored by the local helper app in a file only you can access, never in browser storage.

## Status

Under active development and not yet published to browser stores. Reading, context, preview and controlled writing to the draft have been verified live in Outlook on the web (Firefox on macOS, with Claude Code), including rich tables, undo and re-apply. Generation has also been verified with a ChatGPT Plus account.

The local helper app runs on **macOS, Linux and Windows** (Windows verified on Windows 11 with Chrome, Edge, Brave and Firefox) and currently needs Node.js 22 or later. Single-file helper builds and one-command installers are in progress. A license will be chosen before the first public release.

## Getting started

Requirements: Node.js 22+, pnpm (via Corepack).

```sh
pnpm install
pnpm dev            # develop in Chromium (real AI connection)
pnpm dev:firefox    # develop in Firefox
pnpm check          # typecheck, lint, format, tests, builds for both browsers, package checks
pnpm test:e2e       # Chromium end-to-end tests on a synthetic Outlook page
pnpm test:firefox   # Firefox smoke test
```

### Connecting an AI provider

1. Build everything: `pnpm build`.
2. Register the local helper app with your browser:
   - Firefox: `pnpm ai:install firefox`
   - Chromium browsers: `pnpm ai:install chrome --extension-id=EXTENSION_ID` (also `edge` or `brave`)
3. Open the extension settings and choose a method: **Continue with ChatGPT**, add an OpenAI API key, or select **Claude plan** (Claude Code must be installed and signed in).

Eligibility, setup details and troubleshooting are described in the [AI connection guide](./docs/AI_BAGLANTISI.md). Only `pnpm build:test` produces labelled sample results instead of real AI output.

## Project structure

```text
apps/browser-extension/        WXT extension: entry points, controllers, mounting, platform helpers, locales
apps/ai-companion/             Local native messaging helper: OAuth callback, credential storage, provider routing
packages/ai-openai/            ChatGPT OAuth, model discovery and Responses API adapter
packages/ai-claude-code/       Runs the user's Claude Code in a restricted print mode
packages/contracts/            Shared data and action definitions, boundary schemas, AI prompt
packages/core/                 Context, action preparation, session state and write preconditions (pure functions)
packages/email-format/         Limited Markdown to email-safe HTML, plain text and verification text
packages/ui/                   Vue panel, toolbar, result card and settings components
packages/mail-connectors/
  outlook-web/                 Reads, observes and writes Outlook on the web pages in a controlled way
tests/                         Unit, contract, integration and end-to-end tests with synthetic samples
docs/                          Developer guide, AI connection guide and Outlook verification protocol
```

## Documentation

The detailed documentation is currently written in Turkish.

- [Project plan](./PROJE_PLANI.md)
- [Implementation details](./implementation_details.md)
- [Developer guide](./docs/GELISTIRICI_REHBERI.md)
- [AI connection: ChatGPT, OpenAI API and Claude Code](./docs/AI_BAGLANTISI.md)
- [Outlook on the web page verification](./docs/outlook-web-dogrulama.md)
- [Browser and account matrix](./tests/manual/browser-matrix.md)
- [Work log](./YAPILAN_ISLER.md)
