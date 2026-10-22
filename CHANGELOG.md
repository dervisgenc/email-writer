# Changelog

All notable changes to Writehand are recorded here. The extension and the helper app share one version; tags are named `vX.Y.Z`. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- API keys work in the extension itself, without the helper app: connect a key from Groq, OpenRouter or OpenAI in the settings or the welcome wizard. Groq's free plan and OpenRouter's free models need no payment method; with Groq, OpenAI's free open-weight model `openai/gpt-oss-120b` is selected by itself.
- Keys are checked with the provider before they are saved, stored encrypted in the browser (AES-GCM with a non-extractable key in the extension's own storage) and sent only to their provider. The browser asks for access to a provider's API only when you connect a key for it.
- **Sign in through Codex** (experimental) for ChatGPT Business, Enterprise and Edu workspaces, where OpenAI's Sign in with ChatGPT is blocked by organization policy. It uses the sign-in of OpenAI's Codex CLI, without installing Codex, and generates on ChatGPT's Codex backend for the chosen workspace.
- A separate error for a workspace or API account without credits (`AI_CREDITS_EXHAUSTED`), apart from plan usage limits.

### Changed

- The welcome wizard has three steps. The helper app is installed only for the ChatGPT and Claude plans, from the connection step; without it, the API key method is preselected.
- The connection method is chosen per browser profile; the helper app follows the method of the browser that uses it.
- The helper app no longer keeps an OpenAI API key. A key saved by helper app 0.1.0 is deleted the next time the helper app writes its credentials file; connect it again in the extension, where OpenAI is preselected for you.
- The organization-policy error (`AI_POLICY_DENIED`) explains that Business workspaces currently cannot allow Sign in with ChatGPT, points to the Codex sign-in and names the Admin Console setting for Enterprise and Edu.

### Fixed

- Write and reply prompts now distinguish directions from rough email text, preserve who is requesting what, and prefer the conversation's language unless the user explicitly chooses another language.
- Recover context from recognized quotes when Outlook already has a reply draft open. Keep that context local to its editor, exclude the editable draft and signature, and invalidate a context-free result if a late quote identifies the draft as a reply.

## [0.1.0] - 2026-10-21

### Added

- Writehand browser extension for Outlook on the web (Firefox, Edge, Chrome, Brave): revise, translate, reply and compose with a preview before anything is written to the draft, conversation context, rich results (tables, lists, charts) and five interface languages.
- Helper app as a single program for macOS, Linux and Windows, installed with one command and without administrator rights. It connects to a ChatGPT plan, an OpenAI API key or Claude Code (experimental) and keeps credentials on the computer.
- Welcome wizard that installs and checks the helper app, chooses a connection method and tries a sample revision.
- Signed releases: `SHA256SUMS` with an Ed25519 signature and build provenance attestations; the helper app updates itself only from verified releases.
- Writehand logo as the extension icon and on the welcome and settings pages.
