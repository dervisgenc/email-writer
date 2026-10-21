# Privacy policy

_Effective date: October 21, 2026_

Writehand is a free, open-source writing assistant for Outlook on the web. It consists of a browser extension and, for the ChatGPT and Claude plans, a small helper app that runs on your computer. This policy covers both.

**In short:** Writehand has no server, no account system, no analytics, no advertising and no error reporting. The developer never receives your emails, your text or your sign-in details. Your text goes only to the AI provider you choose, and only when you ask for it.

## What Writehand handles

### Email content and your text

When you select **Write reply**, **Write**, **Revise** or **Translate**, Writehand sends the following to the AI provider you selected:

- the text you selected or typed, and your instruction;
- the messages you chose as context (sender name, subject, displayed date and message text), which you can review, edit or remove before sending;
- your options (target language, tone) and your standing writing instructions from the settings.

With an API key, the extension sends this request from your browser directly to the provider. With the ChatGPT or Claude plan, it goes from the extension to the helper app on your computer and from there directly to the provider:

| Connection method | Provider | Provider's privacy policy |
| --- | --- | --- |
| API key from Groq | Groq | <https://groq.com/privacy-policy> |
| API key from OpenRouter | OpenRouter, which forwards it to the model's provider according to your OpenRouter privacy settings | <https://openrouter.ai/privacy> |
| ChatGPT plan or API key from OpenAI | OpenAI | <https://openai.com/policies/privacy-policy> |
| Claude Code on your computer (experimental) | Anthropic | <https://www.anthropic.com/legal/privacy> |

How the provider processes and retains your request is governed by its own terms and by your account settings with that provider.

Nothing is sent when you only open or read an email. To suggest context, the extension keeps the emails you open in memory while the Outlook tab is open; they are never written to disk and are discarded when the tab is closed or reloaded.

If a reply draft is already open and its earlier conversation was not captured, a recognized quote inside that draft can provide context instead. It is shown as partial context for review; the editable draft and the signature before the quote are excluded from that conversation context. It is sent only when you request generation, under the same rules as other selected context.

Writehand never sends email. Results are shown as a preview first and are written into your draft only after you approve them; sending is always up to you.

### Settings

Your preferences (interface language, translation languages, tone, standing instructions, theme) and your connection choice (method, API key provider and model) are stored in your browser's extension storage on your device. They are not synchronized or sent anywhere.

### Sign-in details and API keys

- **API key (Groq, OpenRouter or OpenAI):** the key you enter is stored in your browser's extension storage, encrypted with a key that the browser keeps for the extension and that no script can export. Web pages, including Outlook, cannot read it. It is never shown again, never synchronized and sent only to the provider it belongs to, to authenticate your requests. Before the first request, the browser asks you to allow Writehand to connect to that provider.
- **ChatGPT plan:** when you sign in with ChatGPT, the helper app receives sign-in tokens from OpenAI on your computer. It stores them in a file that only your user account can read (`~/.config/writehand` on macOS and Linux, `%LOCALAPPDATA%\writehand` on Windows). They are never stored in the browser and never sent back to the extension. They are sent only to OpenAI, to authenticate your requests.

- **Claude Code:** Writehand never reads or stores your Claude credentials. The helper app only runs your locally installed Claude Code, which handles its own sign-in.

### Update checks

While update checks are turned on (the default), the helper app asks GitHub at most once a day for the version number of the latest Writehand release (`api.github.com/repos/dervisgenc/writehand/releases/latest`). The request contains no email content and no account details. Like any web request, it reveals your IP address to GitHub ([GitHub's privacy statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement)). You can turn update checks off in the extension settings under **Helper app**. Updates are downloaded only when you choose to install them.

## Browser permissions

| Permission | Why it is needed |
| --- | --- |
| Access to `outlook.office.com`, `outlook.office365.com`, `outlook.live.com` and `outlook.cloud.microsoft` | To show the Writehand buttons in Outlook on the web, read the draft or the emails you work with, and write approved results into your draft. Writehand does not run on any other website. |
| Storage | To save your preferences on your device. |
| Native messaging (optional, requested when you choose the ChatGPT or Claude plan) | To talk to the helper app on your computer, which holds those connections. |
| Access to `api.groq.com`, `openrouter.ai` or `api.openai.com` (optional, requested when you connect an API key for that provider) | To send your generation requests to the provider whose key you connected. Writehand does not get access to any other site. |

## What Writehand does not do

- It does not collect, sell or share personal data, and it has no server that could receive it.
- It does not use analytics, tracking, advertising or crash reporting.
- It does not read your mailbox in the background or send email.
- It does not use your data to train models. (Whether a provider uses your requests is governed by your agreement with that provider.)

## Deleting your data

- Remove the extension from your browser to delete its settings and any saved API key. You can also remove a key in **Settings → AI connection → Remove key**, and revoke it on the provider's website.
- Uninstall the helper app with `--delete-data` (macOS and Linux) or `-DeleteData` (Windows) to delete stored sign-in tokens and API keys; see the [README](./README.md#install). You can also revoke Writehand's access in your ChatGPT settings under **Security and login**.
- Data that a provider has already received is subject to that provider's retention policy.

## Changes and contact

Changes to this policy are published in this repository, and its history shows every revision. For questions, open an issue at <https://github.com/dervisgenc/writehand/issues>. To report a security issue, follow the [security policy](./SECURITY.md).
