# Manual testing

This is the release checklist for real browsers, real Outlook accounts and clean machines. The automated tests run only on synthetic pages; they do not show that Writehand works in real Outlook on the web or that the helper app installs cleanly on a user's computer.

See also: [Releasing](./RELEASING.md), [Helper app](./HELPER_APP.md), [Development guide](./DEVELOPMENT.md#outlook-on-the-web-selectors).

## Rules

- **Never send email.** Work only in test drafts with made-up text and discard them at the end.
- **Never record real email content.** Results contain versions, pass or fail and short notes, never message text, names, addresses or screenshots of a real mailbox.
- **Record exact versions.** Write down the operating system, browser, extension and helper app versions. Do not write "works in all browsers": a browser or account type that was not checked is not supported.

## Test matrix

Cover at least these combinations for a release. Every helper app archive (macOS arm64 and x64, Linux x64 and arm64, Windows x64) is also installed by CI on each change.

| # | System | Browser | Outlook account | Outlook language |
| --- | --- | --- | --- | --- |
| 1 | macOS (Apple silicon) | Firefox | Work or school | English |
| 2 | macOS | Chrome | Work or school | English |
| 3 | Windows 11 x64 | Edge | Work or school | English |
| 4 | Windows 11 x64 | Chrome or Firefox | Outlook.com (personal) | English |
| 5 | Linux x64 | Chrome | Work or school | English |
| 6 | Linux x64 | Firefox | Work or school | English |
| 7 | Any | Brave | Work or school, or Outlook.com | English |
| 8 | Any two of the above | Two different browsers | Any | Turkish |

Connection methods: test the ChatGPT plan and the OpenAI API key on at least one machine per system, and Claude Code on at least one machine.

Record each run:

| Date | System and version | Browser and version | Extension | Helper app | Account | Language | Methods | Sections passed | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | | |

## Before you start

- [ ] Use a clean machine or a new OS user account: no `~/.local/share/writehand` or `~/.config/writehand` (macOS, Linux), no `%LOCALAPPDATA%\Programs\writehand` or `%LOCALAPPDATA%\writehand` (Windows), and no earlier Writehand extension.
- [ ] Get the extension: the store listing, or the release packages loaded manually (unzip `writehand-<version>-chromium.zip` and use **Load unpacked**; in Firefox load `writehand-<version>-firefox.zip` from `about:debugging`).
- [ ] The one-line command always installs `releases/latest`. To test a draft release before publishing it, install the helper app from the downloaded draft folder instead ([Verifying a draft release](./RELEASING.md#verifying-a-draft-release)) and skip only the command itself.
- [ ] Have test accounts ready: Outlook on the web, a ChatGPT Plus or Pro account, an OpenAI API key, and Claude Code installed and signed in (`claude`, then `/login`) for the Claude method.

## 1. Welcome wizard and helper app install

- [ ] Installing the extension opens the welcome wizard by itself. The browser's install prompt does not mention native applications.
- [ ] **Welcome:** the explanation is shown; **Source code on GitHub** opens the repository.
- [ ] **Helper app:** the right system is preselected, and the command matches the [install commands](./HELPER_APP.md#install-and-uninstall). With an unpacked Chromium build the command ends with `--extension-id=<ID>` (`$env:WRITEHAND_EXTENSION_ID` on Windows).
- [ ] **Permission prompt:** the step shows **Permission needed** with an **Allow** button. Select **Allow**; the browser asks to communicate with cooperating native applications. Decline once: the notice stays. Select **Allow** again and accept.
- [ ] Copy the command and run it in Terminal (macOS, Linux) or PowerShell (Windows). No administrator prompt appears, the checksum check passes and the command ends without errors.
- [ ] Within a few seconds the wizard shows **Helper app connected (version x.y.z)**, without reloading the extension. Check this in a Chromium browser as well as Firefox.
- [ ] The program starts without a Gatekeeper (macOS) or SmartScreen (Windows) warning.
- [ ] `~/.local/share/writehand/writehand status` (Windows: `& "$env:LOCALAPPDATA\Programs\writehand\writehand.exe" status`) shows the version, the registered browsers and whether Claude Code is ready, and prints no account details.
- [ ] Windows: `reg query "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.dervisgenc.writehand"` shows the manifest path (Edge: `Microsoft\Edge`, Brave: `Chromium`, Firefox: `Mozilla`).

## 2. Connection methods

Connect each method in the wizard's **Connection** step or in **Settings → AI connection**, then run **Try it → Revise the sample**. The revised sample appears and the wizard reports that everything works.

**ChatGPT plan**

- [ ] **Continue with ChatGPT** opens the system browser. After signing in and allowing plan usage, the settings show the account, the plan notice and the available models.
- [ ] Choose a model and revise the sample.
- [ ] **Rename** the connection, **Disconnect**, then **Reconnect**: the name is kept and generation works again.
- [ ] Optional, with a second account: **Add a different account or workspace**, then **Use this account** to switch between them.
- [ ] **Remove account** asks for confirmation and removes the connection.

**OpenAI API key**

- [ ] Paste the key and select **Connect key**: the field is cleared, "API key saved in the helper app." appears and the models are listed.
- [ ] Choose a model and revise the sample.
- [ ] **Remove key** removes it.

**Claude plan (experimental)**

- [ ] The helper app was installed from a terminal where Claude Code works (if Claude Code was installed later, run the install command again).
- [ ] **Claude plan** shows the Claude Code account, organization and plan. Models: Claude Sonnet (default) and Claude Opus.
- [ ] Revise the sample with each model.
- [ ] After signing out of Claude Code (`/logout` in `claude`), the settings explain what to do instead of failing silently; after signing in again, **Refresh** picks up the change.

## 3. Outlook on the web

Open Outlook on the web (work: `outlook.office.com`, which may redirect to `outlook.cloud.microsoft`; personal: `outlook.live.com`). Use one connection method per run.

**Page and reading**

- [ ] The toolbar popup says "The writing assistant is available on this page."
- [ ] Opening a conversation shows a **Draft reply** button in the reading pane corner; it does not cover Outlook's buttons.
- [ ] **Draft reply** opens the panel. The context lists the opened messages with sender and date; repeated quotes and recognized signatures are listed as removed and the message body is kept.
- [ ] Open a second conversation: the panel switches to it without a warning. The current conversation is under **This conversation** and selected; the earlier one is under **Other opened emails** and not selected.
- [ ] A conversation with collapsed messages reports their number or that it could not be determined; collapsed text is not in the context.
- [ ] Editing a context message and **Restore original** work; the email itself never changes.
- [ ] With the **Automatic** theme, the panel follows Outlook's light and dark mode.

**Writing**

- [ ] **Reply** opens a draft with the Writehand toolbar in its bottom-right corner: **Write reply**, **Revise**, **Translate** and the panel button. The search box and other fields get no buttons.
- [ ] **Write reply:** enter an instruction; the **Reply draft** card shows the context chip and a result. **Apply to draft** inserts it; the quoted message and the signature are unchanged.
- [ ] **Revise** with a selected word or sentence: **Apply to draft** changes only the selection.
- [ ] **Revise** without a selection: the user's part of the draft is revised; signature and quote are untouched.
- [ ] **Translate:** choose a language from the menu, check the **Translation** card and apply it.
- [ ] **New message → Write:** describe the email; the **Email draft** card's result is applied to the empty body.
- [ ] **Change the result:** **Make a table**, **Bullet points** and a free-form change update the preview; an applied table appears in the draft as a table.
- [ ] **Open in panel** moves the work from the card to the panel without losing it.
- [ ] **Undo last apply** restores the previous text (as plain text). After typing in the draft, undo is disabled. After a successful undo, the same result can be applied again.
- [ ] Leave the draft and return, and resize the window: the applied text stays.
- [ ] With a reply draft and a new message open at the same time, only the draft whose button was pressed changes.
- [ ] Note what **Ctrl+Z** (**Cmd+Z**) does right after an apply.
- [ ] Open a draft in a separate window (pop-out, not supported) and note what appears; nothing may be written to another draft.
- [ ] After switching to another Outlook account, the panel content is cleared.
- [ ] In the calendar (`/calendar`) no buttons appear and the popup reports that the mail area was not recognized.
- [ ] Discard every test draft. Nothing was sent.

## 4. Settings

- [ ] The helper app card shows **Connected**, the version and system, and the registered browsers.
- [ ] After changing the interface language (Automatic, English, Türkçe, Deutsch, Français, Español), the settings page and the Outlook toolbar use it (reload the Outlook tab if needed).
- [ ] Favourite translation languages appear in the **Translate** menu; standing writing instructions affect the next result.
- [ ] Turning the extension off for the site hides the buttons and panel in Outlook.
- [ ] **Check for updates** can be turned off. With an older helper app installed and a newer release published, **Update** reports "Updated to version x.y.z" and the card shows the new version.

## 5. Uninstall

- [ ] Run the command from **Settings → Helper app → How to uninstall** without the data option. The program and all browser registrations are removed, the credentials folder (`~/.config/writehand`, `%LOCALAPPDATA%\writehand`) remains, and the card shows **Not installed**.
- [ ] Install again, then uninstall with `--delete-data` (PowerShell: `-DeleteData`): the credentials folder is removed too.
- [ ] Windows: a few seconds after uninstalling, `%LOCALAPPDATA%\Programs\writehand` is gone and `reg query` finds none of the four keys.
- [ ] Remove the extension from the browser.
