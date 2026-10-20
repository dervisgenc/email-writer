import type { MailEvent, ThreadSnapshot } from '@writehand/contracts';
import type { OutlookWebConnection } from '@writehand/outlook-web';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createConnection, loadFixture, never } from './outlook-page';

/**
 * Anonymized sample of the real Outlook structure: the reading pane shows only
 * the selected message (October 15, 2026, Firefox, work account, English UI).
 */
describe('Outlook Web — selected message view (real structure)', () => {
  let connection: OutlookWebConnection;

  const readActiveThread = async (): Promise<ThreadSnapshot> => {
    const thread = connection.connector.getPageState().activeThread;
    if (thread === null) throw new Error('No open conversation found.');
    const result = await connection.connector.readThread(thread, never);
    if (!result.ok) throw new Error(result.error.code);
    return result.value;
  };

  beforeEach(() => {
    loadFixture('selected-message-reading-pane.html');
    connection = createConnection();
  });
  afterEach(() => {
    connection.connector.dispose();
    document.body.innerHTML = '';
  });

  it("recognizes the open message by the selected row's conversation ID", () => {
    const state = connection.connector.getPageState();

    expect(state.support).toBe('ready');
    expect(state.activeThread?.threadKey).toMatch(/^conv-/);
    expect(state.composers).toEqual([]);
  });

  it("reads the subject, the sender's display name and the displayed date from the header", async () => {
    const snapshot = await readActiveThread();
    const [message] = snapshot.messages;

    expect(snapshot.subject).toBe('RE: Teklif revizyonu');
    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.activeMessageKey).toBe(message?.messageKey);
    // The address is dropped; the date is not parsed.
    expect(message).toMatchObject({
      senderLabel: 'Deniz Yılmaz',
      sentAt: null,
      sentAtText: 'Wed 15-Oct-26 9:12 AM',
    });
    expect(message?.senderLabel).not.toContain('@');
  });

  it('separates the body from the earlier correspondence, keeping empty table cells and Outlook buttons out of the text', async () => {
    const [message] = (await readActiveThread()).messages;
    const [body, quote] = message?.blocks ?? [];

    expect(message?.blocks.map((block) => block.kind)).toEqual(['body', 'quote']);
    expect(body?.text).toBe(
      // The <br> after the table leaves one blank line, as in the browser.
      'External Sender: This e-mail originated outside the organization. Do not open links unless you recognize the sender.\n\n' +
        'Merhaba Ece,\n\n' +
        'Revize teklifi ekte paylaşıyorum. Toplam tutar 48.500 TL.\n\n' +
        'İyi çalışmalar,\n\n' +
        'Deniz',
    );
    expect(quote?.text.startsWith('From: Ece Kara')).toBe(true);
    expect(quote?.text).toContain('Deniz Bey merhaba, teklifi güncelleyebilir misiniz?');
    for (const outlookUi of ['Show original size', 'Reply', 'Summarize', 'You replied']) {
      expect(JSON.stringify(message?.blocks)).not.toContain(outlookUi);
    }
  });

  it('does not take a recipient or a quoted address as the sender when the header has no sender', async () => {
    document.getElementById('MSG_Itm0001_FROM')?.remove();

    const [message] = (await readActiveThread()).messages;

    expect(message?.senderLabel).toBeNull();
    expect(message?.sentAtText).toBe('Wed 15-Oct-26 9:12 AM');
  });

  it('treats the name as unknown when the sender shows only an address, instead of using the address as the name', async () => {
    document.getElementById('MSG_Itm0001_FROM')!.textContent = 'no-reply@example.test';

    const [message] = (await readActiveThread()).messages;

    expect(message?.senderLabel).toBeNull();
  });

  it('takes the author (the last persona card) of an "on behalf of" message, not the sending account address', async () => {
    // Real structure: [sending account card] "on behalf of" [author card]
    const persona = (text: string) => {
      const card = document.createElement('span');
      card.setAttribute('data-lpc-hover-target-id', 'lpc-react-target-9');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-haspopup', 'dialog');
      card.textContent = text;
      const wrapper = document.createElement('div');
      wrapper.append(card);
      return wrapper;
    };
    document
      .getElementById('MSG_Itm0001_FROM')!
      .replaceChildren(
        persona('jira@example.test'),
        ' on behalf of ',
        persona('Deniz Yılmaz <deniz.yilmaz@example.test>'),
      );

    const [message] = (await readActiveThread()).messages;

    expect(message?.senderLabel).toBe('Deniz Yılmaz');
  });

  it('ties the message ID to the container holding both header and body, so it stays the same across reads', async () => {
    const first = await readActiveThread();
    const second = await readActiveThread();

    expect(second.messages[0]?.messageKey).toBe(first.messages[0]?.messageKey);
  });

  it('gives the same message the same ID even when Outlook re-renders it (after visiting another message and coming back)', async () => {
    const first = await readActiveThread();
    const container = document.querySelector('[data-fixture="message-container"]')!;
    container.replaceWith(container.cloneNode(true));

    const second = await readActiveThread();

    expect(second.messages[0]?.messageKey).toBe(first.messages[0]?.messageKey);
    expect(first.messages[0]?.messageKey).toMatch(/^msg-[0-9a-z]+$/);
  });
});

/**
 * Real structure: in the selected message view, clicking "Reply" makes Outlook
 * remove the message from the reading pane and put the reply editor in its place.
 */
describe('Outlook Web — reading pane turning into the reply editor (real structure)', () => {
  let connection: OutlookWebConnection;

  beforeEach(() => {
    loadFixture('selected-message-reading-pane.html');
    connection = createConnection();
  });
  afterEach(() => {
    connection.connector.dispose();
    document.body.innerHTML = '';
  });

  it('does not count as a conversation change; the editor is a reply to that conversation and the conversation button gives way to the toolbar', async () => {
    const before = connection.connector.getPageState();
    const events: string[] = [];
    connection.connector.subscribe((event) => events.push(event.type));

    loadFixture('selected-message-reply-compose.html');
    await settle();
    const after = connection.connector.getPageState();

    expect(after.activeThread).toEqual(before.activeThread);
    expect(events).not.toContain('active-thread-changed');
    expect(after.composers).toHaveLength(1);
    expect(after.composers[0]?.threadKey).toBe(before.activeThread?.threadKey);
    expect(connection.locateLauncherAnchors().map((anchor) => anchor.target.kind)).toEqual(['composer']);
  });

  it('reports the replied-to message (recorded while shown) and the subject, but no message body since it is no longer on the page', async () => {
    const thread = connection.connector.getPageState().activeThread!;
    const shown = await connection.connector.readThread(thread, never);
    if (!shown.ok) throw new Error(shown.error.code);

    loadFixture('selected-message-reply-compose.html');
    await settle();
    const replying = await connection.connector.readThread(
      connection.connector.getPageState().activeThread!,
      never,
    );
    if (!replying.ok) throw new Error(replying.error.code);

    expect(replying.value.messages).toEqual([]);
    expect(replying.value.activeMessageKey).toBe(shown.value.messages[0]?.messageKey);
    expect(replying.value.subject).toBe('RE: Teklif revizyonu');
  });

  it('keeps the conversation and finally binds the draft as a reply even when Outlook opens the editor empty and fills in the quote later', async () => {
    const thread = connection.connector.getPageState().activeThread!;
    const events: MailEvent[] = [];
    connection.connector.subscribe((event) => events.push(event));

    loadFixture('selected-message-reply-compose.html');
    for (const quote of document.querySelectorAll('#appendonsend, #divRplyFwdMsg')) quote.remove();
    await settle();
    expect(connection.connector.getPageState().activeThread).toEqual(thread);
    const early = connection.connector.getPageState().composers[0]!;
    expect(early.threadKey).toBeNull();
    const before = await connection.connector.readComposer(early);
    if (!before.ok) throw new Error(before.error.code);
    const [earlyAnchor] = connection.locateLauncherAnchors();

    // Outlook fills in the quote.
    const quote = document.createElement('div');
    quote.id = 'divRplyFwdMsg';
    quote.textContent = 'From: Deniz Yılmaz';
    document.querySelector('[data-fixture="reply-editor"]')!.append(quote);
    // Changes inside the editor are first batched by the editor watcher, then the page is re-evaluated.
    await settle(400);

    const late = connection.connector.getPageState().composers[0]!;
    expect(late).toEqual({ ...early, threadKey: thread.threadKey });
    const types = events.map((event) => event.type);
    expect(types).not.toContain('active-thread-changed');
    // It is the same editor: it is not removed and re-added, so open work does not count as "draft closed".
    expect(types.filter((type) => type === 'composer-removed' || type === 'composer-added')).toEqual([
      'composer-added',
    ]);
    expect(events).toContainEqual({ type: 'composer-rebound', previous: early, ref: late });
    // The toolbar (and the card in it) is not rebuilt; only its target becomes the reply.
    expect(connection.locateLauncherAnchors()).toEqual([
      { ...earlyAnchor, target: { kind: 'composer', composer: late } },
    ]);
    // The user's region did not change: the revision stays the same, the old ref still reaches
    // the same editor, and a result prepared beforehand can still be written.
    const read = await connection.connector.readComposer(early);
    expect(read.ok && read.value).toMatchObject({ ref: late, revision: before.value.revision });
    const outcome = await connection.connector.applyText({
      applyOperationId: 'late-quote',
      target: { mode: 'replace-body', composerRef: early, expectedRevision: before.value.revision },
      text: 'Teşekkürler, uygundur.',
    });
    expect(outcome.status).toBe('applied');
    expect(document.getElementById('divRplyFwdMsg')?.textContent).toBe('From: Deniz Yılmaz');
  });

  it('does not bind a reply draft opened while another list row is selected (e.g. the Drafts folder) to the last conversation', () => {
    loadFixture('selected-message-reply-compose.html');
    // As if the user switched to the Drafts folder and selected another row.
    const row = document.querySelector('[data-convid="AAQkConvFirst"]')!;
    row.setAttribute('data-convid', 'AAQkDraftOther');
    // The state is read without waiting for the observer to batch the change.
    const fresh = createConnection();
    expect(fresh.connector.getPageState().activeThread).toBeNull();
    expect(fresh.connector.getPageState().composers[0]?.threadKey).toBeNull();
    fresh.connector.dispose();
  });
});

/** Waits for the page observer to batch and process the changes. */
function settle(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
