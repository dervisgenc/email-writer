import type { ComposerRef } from '@writehand/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createConnection,
  createDomWriter,
  fixtureElement,
  gmailLoadsQuoteOnToggle,
  loadGmail,
  never,
} from './gmail-page';

/** A reply opened from the inbox list's context menu, without opening the email. */
const LIST_URL = '/mail/u/0/#inbox?compose=fixture-compose-3';

function listReply(connection: ReturnType<typeof createConnection>): ComposerRef {
  const [composer] = connection.connector.getPageState().composers;
  if (composer === undefined) throw new Error('no reply draft');
  return composer;
}

describe('Gmail connector — a reply opened from the message list', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('binds the reply to the conversation its form names, with the same key as the open conversation', () => {
    loadGmail();
    const open = createConnection();
    const conversationKey = open.connector.getPageState().activeThread?.threadKey;
    open.connector.dispose();

    loadGmail('reply-from-list.html', LIST_URL);
    const connection = createConnection();
    const state = connection.connector.getPageState();

    expect(state.activeThread).toBeNull();
    expect(listReply(connection).threadKey).toBe(conversationKey);
    connection.connector.dispose();
  });

  it("reads the replied-to message from the quote by pressing the reply's own toggle", async () => {
    // The key of the replied-to message when its conversation is open.
    loadGmail();
    const open = createConnection();
    const read = await open.connector.readThread(open.connector.getPageState().activeThread!, never);
    if (!read.ok) throw new Error(read.error.code);
    const repliedKey = read.value.messages[1]?.messageKey;
    open.connector.dispose();

    loadGmail('reply-from-list.html', LIST_URL);
    const gmail = gmailLoadsQuoteOnToggle();
    const connection = createConnection();
    const reply = listReply(connection);
    const result = await connection.connector.readThread(
      { scope: reply.scope, threadKey: reply.threadKey! },
      never,
    );
    if (!result.ok) throw new Error(result.error.code);
    const [message] = result.value.messages;

    expect(gmail.presses).toBe(1);
    expect(result.value.subject).toBe('Re: Proje toplantısı');
    expect(result.value.messages).toHaveLength(1);
    // The same key as when the conversation is open, so history and context line up.
    expect(message?.messageKey).toBe(repliedKey);
    expect(result.value.activeMessageKey).toBe(repliedKey);
    expect(message?.blocks.map((block) => block.text).join('\n')).toContain('Gündem: Bütçe ve takvim');
    // The user's empty draft is not part of the conversation.
    expect(message).toMatchObject({ senderLabel: null, sentAtText: null });
    connection.connector.dispose();
  });

  it('does not press the toggle again once the quote is loaded', async () => {
    loadGmail('reply-from-list.html', LIST_URL);
    const gmail = gmailLoadsQuoteOnToggle();
    const connection = createConnection();
    const reply = listReply(connection);
    const ref = { scope: reply.scope, threadKey: reply.threadKey! };
    await connection.connector.readThread(ref, never);
    await connection.connector.readThread(ref, never);

    expect(gmail.presses).toBe(1);
    connection.connector.dispose();
  });

  it('reports the replied-to message as not read when Gmail does not load the quote', async () => {
    loadGmail('reply-from-list.html', LIST_URL);
    const connection = createConnection(createDomWriter(), { quoteWaitMs: 50 });
    const reply = listReply(connection);
    const result = await connection.connector.readThread(
      { scope: reply.scope, threadKey: reply.threadKey! },
      never,
    );
    if (!result.ok) throw new Error(result.error.code);

    expect(result.value.messages).toEqual([]);
    expect(result.value.activeMessageKey).toBeNull();
    expect(result.value.coverage).toMatchObject({ knownUnreadableMessageCount: 1 });
    expect(result.value.coverage.reasons).toContain('collapsed-messages');
    connection.connector.dispose();
  });

  it('writes the reply into the empty draft above the quote it loaded', async () => {
    loadGmail('reply-from-list.html', LIST_URL);
    gmailLoadsQuoteOnToggle();
    const connection = createConnection();
    const reply = listReply(connection);
    await connection.connector.readThread({ scope: reply.scope, threadKey: reply.threadKey! }, never);
    const snapshot = await connection.connector.readComposer(reply);
    if (!snapshot.ok) throw new Error(snapshot.error.code);
    expect(snapshot.value.canInsertIntoEmptyBody).toBe(true);

    const outcome = await connection.connector.applyText({
      applyOperationId: 'apply-list-reply',
      target: { mode: 'insert-empty', composerRef: reply, expectedRevision: snapshot.value.revision },
      text: 'Teşekkürler, B-204 uygun.',
    });

    expect(outcome.status).toBe('applied');
    const after = await connection.connector.readComposer(reply);
    expect(after.ok && after.value.editableText.trim()).toBe('Teşekkürler, B-204 uygun.');
    expect(fixtureElement('list-reply-editor').querySelector('blockquote')?.textContent).toContain(
      'Oda B-204',
    );
    connection.connector.dispose();
  });
});
