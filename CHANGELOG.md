# Changelog

All notable changes to Writehand are recorded here. The extension and the helper app share one version; tags are named `vX.Y.Z`. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Writehand browser extension for Outlook on the web (Firefox, Edge, Chrome, Brave): revise, translate, reply and compose with a preview before anything is written to the draft, conversation context, rich results (tables, lists, charts) and five interface languages.
- Helper app as a single program for macOS, Linux and Windows, installed with one command and without administrator rights. It connects to a ChatGPT plan, an OpenAI API key or Claude Code (experimental) and keeps credentials on the computer.
- Welcome wizard that installs and checks the helper app, chooses a connection method and tries a sample revision.
- Signed releases: `SHA256SUMS` with an Ed25519 signature and build provenance attestations; the helper app updates itself only from verified releases.
