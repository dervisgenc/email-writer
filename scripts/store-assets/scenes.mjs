// Screenshot scenes: each one uses the real UI in the demo mailbox or on one of the
// extension's own pages like a user would (clicks, types, selects text) and sets up the
// moment to capture. The order is the store order; the Chrome Web Store shows the first five.
import { COSTS, LAUNCH_THREAD, REPLY, REVISE, TRANSLATE } from './story.mjs';

export const toolbar = (page) => page.getByRole('toolbar', { name: 'Writehand' });
export const editor = (page) => page.locator('[data-demo="editor"]');
export const panel = (page) => page.getByRole('dialog', { name: 'Writing assistant' });

/** Opens the demo mailbox and waits until the extension's buttons are in place. */
export async function openMailbox(page, origin, { theme = 'light', folders = true } = {}) {
  await page.goto(`${origin}/mail/?theme=${theme}&folders=${folders ? 'expanded' : 'collapsed'}`);
  await page
    .getByRole('button', { name: 'Draft a reply to this conversation and review the context' })
    .waitFor();
}

/** The page a scene starts on: the demo mailbox or the extension's welcome wizard. */
export async function openScene(page, scene, { origin, extensionId }) {
  if (scene.start === 'welcome') {
    await page.goto(`chrome-extension://${extensionId}/welcome.html`);
    await page.getByRole('heading', { name: 'Welcome to Writehand' }).waitFor();
    return;
  }
  await openMailbox(page, origin, scene);
}

/** Selects the text of the first lines of the draft body like a user would (not the signature or quote). */
export async function selectDraftText(page) {
  await editor(page).evaluate((element) => {
    const first = element.querySelector('.elementToProof');
    const range = document.createRange();
    range.selectNodeContents(first);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
}

/**
 * Opens the conversation and waits about as long as a user would read it: the extension
 * adds the opened message to its context history after a short delay, and the reply
 * draft uses that message as context.
 */
export async function openConversation(page, id) {
  await page.locator(`[data-conversation="${id}"]`).click();
  await page.waitForTimeout(1200);
}

export async function openReply(page) {
  await page.locator('.pill-btn[aria-label="Reply"]').click();
  await editor(page).click({ position: { x: 40, y: 12 } });
  await toolbar(page).waitFor();
}

export async function composeMail(page, { to, subject, body = '' }) {
  await page.evaluate((mail) => window.demo.compose(mail), { to, subject, body });
  await editor(page).click({ position: { x: 40, y: 12 } });
  await toolbar(page).waitFor();
}

/** Waits until the result card or the panel preview is ready. */
export async function waitForResult(scope) {
  await scope.getByRole('button', { name: 'Apply to draft' }).waitFor();
  // The card's opening transition and the preview's first render.
  await scope.page().waitForTimeout(400);
}

export const SCENES = [
  {
    name: '01-reply',
    folders: false,
    caption: {
      title: 'Reply to any email in seconds',
      text: 'Say what you want in a few words. Writehand drafts the reply; you review it and send.',
    },
    async run(page) {
      await openConversation(page, LAUNCH_THREAD);
      await openReply(page);
      await toolbar(page).getByRole('button', { name: 'Write reply' }).click();
      await page.keyboard.type(REPLY.instruction);
      await page.keyboard.press('Enter');
      const card = page.getByRole('dialog', { name: 'Reply draft' });
      await waitForResult(card);
      await card.getByRole('button', { name: 'Apply to draft' }).click();
      await card.getByText('Text placed in the draft.').waitFor();
    },
  },
  {
    name: '02-revise',
    caption: {
      title: 'Polish your draft before you send it',
      text: 'Fix tone, grammar and clarity. You see the result first and decide what goes in.',
    },
    async run(page) {
      await composeMail(page, { to: REVISE.to, subject: REVISE.subject, body: REVISE.draft });
      await selectDraftText(page);
      await toolbar(page).getByRole('button', { name: 'Revise' }).click();
      await waitForResult(page.getByRole('dialog', { name: 'Suggested revision' }));
    },
  },
  {
    name: '03-translate',
    caption: {
      title: 'Write in any language',
      text: 'Translate your draft or a selection, then apply it to the email with one click.',
    },
    async run(page) {
      // Without a selection, the whole draft body is translated (except the signature and quote).
      await composeMail(page, { to: REVISE.to, subject: REVISE.subject, body: REVISE.text });
      await toolbar(page).getByRole('button', { name: 'Choose translation language' }).click();
      await page.getByRole('menuitemradio', { name: TRANSLATE.languageName }).click();
      await waitForResult(page.getByRole('dialog', { name: 'Translation' }));
    },
  },
  {
    name: '04-tables',
    theme: 'dark',
    folders: false,
    caption: {
      title: 'Turn text into tables, lists and charts',
      text: 'Reshape any result in one click, then apply it to your email with clean formatting.',
    },
    async run(page) {
      await composeMail(page, { to: COSTS.to, subject: COSTS.subject });
      await toolbar(page).getByRole('button', { name: 'Write', exact: true }).click();
      await page.keyboard.type(COSTS.instruction);
      await page.keyboard.press('Enter');
      const card = page.getByRole('dialog', { name: 'Email draft' });
      await waitForResult(card);
      await card.getByRole('button', { name: 'Make a table' }).click();
      await card.getByText('In-store displays').waitFor();
      await waitForResult(card);
      // Scroll the preview box far enough to show the whole table.
      await card.locator('.ew-rich-preview__paper').evaluate((paper) => {
        const table = paper.querySelector('table');
        paper.scrollTop = table.offsetTop + table.offsetHeight + 16 - paper.clientHeight;
      });
    },
  },
  {
    name: '05-connect',
    start: 'welcome',
    width: 960,
    caption: {
      title: 'Use the AI plan you already have',
      text: 'Sign in with ChatGPT, use your own OpenAI API key, or Claude Code on your computer.',
    },
    async run(page) {
      for (const step of ['Helper app', 'Connection']) {
        await page.getByRole('button', { name: 'Continue' }).click();
        await page.locator('.ew-steps__item[data-state="current"]', { hasText: step }).waitFor();
      }
      await page.getByText('Connected · Ready to generate text').waitFor();
    },
  },
  {
    name: '06-context',
    folders: false,
    caption: {
      title: 'You decide what the AI sees',
      text: 'Review, edit or remove every message used as context. Writehand never sends email.',
    },
    async run(page) {
      // Two conversations are opened first; the panel suggests them as "other opened emails".
      for (const id of ['c-budget', 'c-review', LAUNCH_THREAD]) {
        await openConversation(page, id);
      }
      await openReply(page);
      await toolbar(page).getByRole('button', { name: 'Open the writing assistant panel' }).click();
      const writer = panel(page);
      await writer.getByRole('radio', { name: 'Draft reply' }).click();
      await writer.getByLabel('Reply instruction').fill(REPLY.instruction);
      await writer.getByRole('button', { name: /Other opened emails/ }).click();
      await writer
        .getByText('This conversation')
        .evaluate((heading) => heading.scrollIntoView({ block: 'start' }));
    },
  },
  {
    name: '07-privacy',
    start: 'welcome',
    width: 960,
    caption: {
      title: 'Private by design',
      text: 'No Writehand server and no tracking. Your text goes only to the AI provider you choose.',
    },
    async run() {},
  },
];
