# Security policy

## Supported versions

Writehand has two parts that are released together from this repository: the browser extension and the helper app on your computer.

| Version | Supported |
| --- | --- |
| Latest release (extension and helper app) | Yes |
| Helper app up to two minor versions older than the extension | Yes, until the extension asks you to update it |
| Anything older | No: update the extension from your browser's store and the helper app from the extension settings |

Security fixes are released as a new version; there are no separate patch branches.

## Reporting a vulnerability

Please report vulnerabilities **privately** through GitHub: open the repository's **Security** tab and select **Report a vulnerability** ([direct link](https://github.com/dervisgenc/writehand/security/advisories/new)). Do not open a public issue, pull request or discussion for a suspected vulnerability.

Include what you found, the affected component and version, the steps to reproduce and the impact you expect. Never include real email content, access tokens, API keys or account details; use made-up text and redact anything personal.

You can expect an acknowledgement within a week. Once a fix is released, the advisory is published with credit to you unless you prefer otherwise.

## Scope

In scope:

- **Browser extension** (`apps/browser-extension`): message validation between extension parts, what is read from Outlook on the web and Gmail pages, what is written to drafts, settings storage, API key storage and the requests to API key providers (`packages/ai-chat-completions`, `@writehand/ai-openai/api-key`).
- **Helper app** (`apps/ai-companion` and the provider packages): the native messaging protocol, ChatGPT sign-in (loopback callback, token handling), credential storage, how Claude Code is started, update download and verification.
- **Installation and release**: `install.sh`, `install.ps1`, the helper app's `install`, `uninstall` and `update` commands, release archives, `SHA256SUMS` and its signature.

Out of scope: vulnerabilities in Outlook on the web, Gmail, the OpenAI, Anthropic, Groq or OpenRouter services, Claude Code itself, browsers, or a computer that is already compromised.

## Threat model

- **No email is ever sent.** The extension only writes into a draft after you approve the preview; sending is always up to you.
- **Email content is untrusted input.** It is never run as HTML, links and images in it are not opened, and instructions inside it are not followed. Claude Code runs without tools, settings, MCP servers or session transcripts.
- **Text goes only to the provider you chose** (Groq, OpenRouter, OpenAI or Anthropic), and only when you ask for a revision, translation, reply or new email. There is no Writehand server, analytics or error reporting.
- **API keys never reach a web page.** A key is checked with its provider before it is saved, then stored encrypted (AES-GCM, bound to its provider) in the extension's storage. The encryption key is non-extractable and kept in the extension's own IndexedDB, which web pages and content scripts cannot open. Only the background decrypts a key, and only to send it to its provider's API, whose origin the user allowed. Mail pages (Outlook and Gmail) cannot save, read or remove keys. This does not protect a key from someone who can use your browser profile or read its files; use keys with a spending limit.
- **ChatGPT tokens stay on your computer, outside the browser.** The helper app keeps them in a file only your user account can read (`~/.config/writehand` on macOS and Linux, `%LOCALAPPDATA%\writehand` on Windows). They are never sent back to the extension. Writehand never reads or stores Claude credentials; it only runs `claude auth status` and `claude -p`.
- **Only Writehand can start the helper.** The browser starts the helper app only for the extension IDs listed in its registration, and the helper accepts account and update commands only from the extension's own pages.
- **Updates are verified.** The helper app downloads updates only from this repository's releases and installs them only if `SHA256SUMS` carries a valid Ed25519 signature from the release key built into the helper app and the archive matches its checksum. Release files also carry GitHub build provenance attestations.
- **No administrator rights.** Installation, updates and removal touch only your user account's folders and (on Windows) your own registry keys.
