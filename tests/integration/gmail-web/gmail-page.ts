import { createGmailWebConnector, type GmailWebConnection } from '@writehand/gmail-web';
import type { EditorWriter } from '@writehand/mail-dom';

import { createDomWriter, fixtureElement, loadFixture, OWN_UI_SELECTOR } from '../../support/mail-page';

export { createDomWriter, fixtureElement, never, selectText, typeInto } from '../../support/mail-page';

/** Gmail's address for the first signed-in account with a conversation open. */
export const GMAIL_THREAD_URL = '/mail/u/0/#inbox/FMfcgzQXJWDsKmBvTkRbHnPLvXqZcwTt';

/** Loads the synthetic Gmail page at a Gmail-like address (the test document's path). */
export function loadGmail(name = 'conversation-inline-reply.html', url = GMAIL_THREAD_URL): void {
  window.history.replaceState(null, '', url);
  loadFixture('gmail', name);
}

let counter = 0;

export function createConnection(writer: EditorWriter = createDomWriter()): GmailWebConnection {
  return createGmailWebConnector({
    document,
    ownUiSelector: OWN_UI_SELECTOR,
    createId: () => `id-${(counter += 1)}`,
    now: () => new Date('2026-10-23T10:00:00.000Z'),
    writer,
    settle: () => Promise.resolve(),
    waitLimitMs: 0,
  });
}

export const replyEditor = () => fixtureElement('reply-editor');
export const newEditor = () => fixtureElement('new-editor');
