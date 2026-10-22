import { createGmailWebConnector, type GmailWebConnection, type GmailWebOptions } from '@writehand/gmail-web';
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

export function createConnection(
  writer: EditorWriter = createDomWriter(),
  options: Partial<Pick<GmailWebOptions, 'quoteWaitMs'>> = {},
): GmailWebConnection {
  return createGmailWebConnector({
    ...options,
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

/**
 * Plays Gmail's part in jsdom, where the page's script does not run: pressing the reply's
 * "•••" toggle loads the quote into the draft. Returns how often the toggle was pressed.
 */
export function gmailLoadsQuoteOnToggle(): { presses: number } {
  const counter = { presses: 0 };
  fixtureElement('list-reply-toggle').addEventListener('click', (event) => {
    counter.presses += 1;
    fixtureElement('list-reply-editor').insertAdjacentHTML(
      'beforeend',
      '<br><div class="gmail_quote gmail_quote_container"><div class="gmail_attr">Ayşe Kaya şunu yazdı:</div><blockquote class="gmail_quote">Evet, uygun. Gündem: Bütçe ve takvim. Oda B-204.</blockquote></div>',
    );
    (event.currentTarget as HTMLElement).style.display = 'none';
  });
  return counter;
}
