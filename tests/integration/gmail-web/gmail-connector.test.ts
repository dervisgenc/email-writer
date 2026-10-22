import type { ApplyRequest, ComposerRef, MailEvent } from '@writehand/contracts';
import type { GmailWebConnection } from '@writehand/gmail-web';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { describeMailConnectorContract } from '../../contracts/mail-connector.contract';
import {
  createConnection,
  fixtureElement,
  loadGmail,
  never,
  newEditor,
  replyEditor,
  selectText,
  typeInto,
} from './gmail-page';

describeMailConnectorContract('Gmail (synthetic fixture)', () => {
  loadGmail();
  const connection = createConnection();
  return {
    connector: connection.connector,
    selectablePhrase: 'toplantı odası',
    selectInComposer: (_ref, phrase) => selectText(replyEditor(), phrase),
    typeInComposer: (_ref, text) => typeInto(replyEditor(), text),
    cleanup: () => {
      document.body.innerHTML = '';
    },
  };
});

describe('Gmail connector — page and conversation', () => {
  let connection: GmailWebConnection;

  beforeEach(() => {
    loadGmail();
    connection = createConnection();
  });
  afterEach(() => {
    connection.connector.dispose();
    document.body.innerHTML = '';
  });

  const replyComposer = (): ComposerRef => {
    const ref = connection.connector.getPageState().composers.find((composer) => composer.threadKey !== null);
    if (ref === undefined) throw new Error('no reply draft');
    return ref;
  };
  const newComposer = (): ComposerRef => {
    const ref = connection.connector.getPageState().composers.find((composer) => composer.threadKey === null);
    if (ref === undefined) throw new Error('no new draft');
    return ref;
  };

  it('finds the shown conversation by its Gmail id, the inline reply and the compose window', () => {
    const state = connection.connector.getPageState();

    expect(state.support).toBe('ready');
    expect(state.scope).toMatchObject({ providerId: 'gmail-web' });
    expect(state.scope?.accountScopeId).toMatch(/^acct-[0-9a-z]+$/);
    expect(state.activeThread?.threadKey).toMatch(/^thread-/);
    expect(state.composers).toHaveLength(2);
    // The inline reply belongs to the conversation; the compose window cannot be proven to.
    expect(replyComposer().threadKey).toBe(state.activeThread?.threadKey);
    expect(newComposer().threadKey).toBeNull();
    // Opaque keys only: no subject, name or address.
    expect(JSON.stringify(state)).not.toMatch(/Proje|Mehmet|example\.com/);
  });

  it('reads the expanded messages with sender name and displayed date, never the address', async () => {
    const thread = connection.connector.getPageState().activeThread!;
    const result = await connection.connector.readThread(thread, never);
    if (!result.ok) throw new Error(result.error.code);
    const { subject, messages, coverage, activeMessageKey } = result.value;
    const [first, second] = messages;

    // The hidden view Gmail keeps in the DOM is not read.
    expect(subject).toBe('Proje toplantısı');
    expect(messages).toHaveLength(2);
    expect(first).toMatchObject({
      senderLabel: 'Mehmet Demir',
      sentAt: null,
      sentAtText: 'Cum, 10 Eki 2026 11:00',
    });
    expect(first?.blocks.map((block) => block.kind)).toEqual(['body', 'signature']);
    // Line breaks before the signature are left to context normalization, as for Outlook.
    expect(first?.blocks[0]?.text.trimEnd()).toBe(
      'Merhaba Ayşe,\n\nPerşembe 14:00 toplantısını teyit edebilir misin?',
    );
    expect(second).toMatchObject({ senderLabel: 'Ayşe Kaya', sentAtText: '11:42' });
    expect(second?.blocks.map((block) => block.kind)).toEqual(['body', 'quote']);
    expect(JSON.stringify(messages)).not.toContain('example.com');

    // With two expanded messages, the reply target is not guessed.
    expect(activeMessageKey).toBeNull();
    // The collapsed message is counted, not read.
    expect(coverage).toMatchObject({
      source: 'visible-dom',
      status: 'partial',
      readableMessageCount: 2,
      knownUnreadableMessageCount: 1,
    });
    expect(coverage.reasons).toContain('collapsed-messages');
  });

  it('keeps lists and tables readable and skips hidden text and scripts', async () => {
    const thread = connection.connector.getPageState().activeThread!;
    const result = await connection.connector.readThread(thread, never);
    if (!result.ok) throw new Error(result.error.code);
    const body = result.value.messages[1]?.blocks[0]?.text ?? '';

    expect(body).toContain('- Bütçe\n- Takvim');
    expect(body).toContain('Oda | B-204');
    expect(body).not.toContain('gizli izleme metni');
    expect(body).not.toContain('__shouldNotRun');
  });

  it('gives a message the same key every time it is read', async () => {
    const thread = connection.connector.getPageState().activeThread!;
    const first = await connection.connector.readThread(thread, never);
    const again = await connection.connector.readThread(thread, never);
    if (!first.ok || !again.ok) throw new Error('read failed');

    expect(again.value.messages.map((message) => message.messageKey)).toEqual(
      first.value.messages.map((message) => message.messageKey),
    );
    expect(first.value.messages[0]?.messageKey).toMatch(/^msg-/);
  });

  it("separates the user's text from the signature and the quote in a reply draft", async () => {
    const snapshot = await connection.connector.readComposer(replyComposer());
    if (!snapshot.ok) throw new Error(snapshot.error.code);

    expect(snapshot.value.editableText.trim()).toBe(
      'Toplantı odası olarak B-204 uygun, toplantı odası rezervasyonunu ben yaparım.',
    );
    expect(snapshot.value.canReplaceBody).toBe(true);
  });

  it('writes into an empty new message above the signature and keeps the signature', async () => {
    const ref = newComposer();
    const snapshot = await connection.connector.readComposer(ref);
    if (!snapshot.ok) throw new Error(snapshot.error.code);
    expect(snapshot.value.canInsertIntoEmptyBody).toBe(true);

    const request: ApplyRequest = {
      applyOperationId: 'apply-new',
      target: { mode: 'insert-empty', composerRef: ref, expectedRevision: snapshot.value.revision },
      text: 'Merhaba ekip, perşembe 14:00 toplantısında görüşelim.',
    };
    const outcome = await connection.connector.applyText(request);
    const after = await connection.connector.readComposer(ref);

    expect(outcome.status).toBe('applied');
    expect(after.ok && after.value.editableText.trim()).toBe(request.text);
    expect(newEditor().querySelector('.gmail_signature')?.textContent).toBe('Ayşe Kaya');
  });

  it('replaces the whole user region of a reply and keeps the signature and the trimmed quote', async () => {
    const ref = replyComposer();
    const snapshot = await connection.connector.readComposer(ref);
    if (!snapshot.ok) throw new Error(snapshot.error.code);

    const outcome = await connection.connector.applyText({
      applyOperationId: 'apply-body',
      target: { mode: 'replace-body', composerRef: ref, expectedRevision: snapshot.value.revision },
      text: 'B-204 uygun; odayı ben ayırırım.',
    });
    const after = await connection.connector.readComposer(ref);

    expect(outcome.status).toBe('applied');
    expect(after.ok && after.value.editableText.trim()).toBe('B-204 uygun; odayı ben ayırırım.');
    expect(replyEditor().querySelector('.gmail_signature')?.textContent).toBe('Ayşe Kaya');
    expect(fixtureElement('trimmed-toggle').isConnected).toBe(true);
  });

  it('keeps a quote the user expanded into the editor out of the editable text and intact on write', async () => {
    replyEditor().insertAdjacentHTML(
      'beforeend',
      '<div class="gmail_quote gmail_quote_container"><div class="gmail_attr">Mehmet Demir şunu yazdı:</div><blockquote class="gmail_quote">Teyit eder misin?</blockquote></div>',
    );
    fixtureElement('trimmed-toggle').remove();
    const ref = replyComposer();
    const snapshot = await connection.connector.readComposer(ref);
    if (!snapshot.ok) throw new Error(snapshot.error.code);
    expect(snapshot.value.editableText).not.toContain('Teyit eder misin?');

    const outcome = await connection.connector.applyText({
      applyOperationId: 'apply-expanded',
      target: { mode: 'replace-body', composerRef: ref, expectedRevision: snapshot.value.revision },
      text: 'Odayı ben ayırırım.',
    });

    expect(outcome.status).toBe('applied');
    expect(replyEditor().querySelector('blockquote')?.textContent).toBe('Teyit eder misin?');
  });

  it('treats a reply without a signature as safely separated only while its quote is trimmed outside the editor', async () => {
    replyEditor().querySelector('.gmail_signature_prefix')?.remove();
    replyEditor().querySelector('.gmail_signature')?.remove();
    const trimmed = await connection.connector.readComposer(replyComposer());
    expect(trimmed.ok && trimmed.value.canReplaceBody).toBe(true);

    // Without the toggle, the quote could be anywhere in the editor: the whole body is not replaced.
    fixtureElement('trimmed-toggle').remove();
    await new Promise((resolve) => setTimeout(resolve, 200));
    const uncertain = await connection.connector.readComposer(replyComposer());
    expect(uncertain.ok && uncertain.value.canReplaceBody).toBe(false);
  });

  it('returns a selection in a received message with the key of that message only', async () => {
    const thread = connection.connector.getPageState().activeThread!;
    const read = await connection.connector.readThread(thread, never);
    if (!read.ok) throw new Error(read.error.code);
    selectText(fixtureElement('thread-view'), 'toplantısını teyit');

    const selection = await connection.connector.readSelectedMessageText(thread);

    expect(selection).toEqual({
      ok: true,
      value: {
        threadRef: thread,
        messageKey: read.value.messages[0]?.messageKey,
        text: 'toplantısını teyit',
      },
    });
  });

  it("places the conversation button in the subject row, before Gmail's own buttons, and a toolbar on each draft", () => {
    const anchors = connection.locateLauncherAnchors();
    const [thread] = anchors;

    expect(anchors.map((anchor) => anchor.target.kind)).toEqual(['thread', 'composer', 'composer']);
    // The full-width subject row, not the heading's own container, which is only as wide as the subject.
    expect(thread?.element).toBe(fixtureElement('subject-row'));
    expect(thread?.obstacles).toHaveLength(2);
    expect(thread?.obstacles?.[0]).toBe(fixtureElement('print-all'));
  });

  it('reports only match counts for selector verification', () => {
    const report = connection.selectorReport();
    // Verified on a real Gmail account; collapsed messages are still a candidate.
    expect(report.find((entry) => entry.key === 'composeEditor')).toMatchObject({
      status: 'verified',
      matches: 2,
    });
    expect(report.find((entry) => entry.key === 'collapsedMessage')).toMatchObject({ status: 'candidate' });
    expect(JSON.stringify(report)).not.toMatch(/Mehmet|Proje/);
  });
});

describe('Gmail connector — navigation and pages', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reports a new conversation when Gmail shows another one', async () => {
    loadGmail();
    const connection = createConnection();
    const events: MailEvent[] = [];
    connection.connector.subscribe((event) => events.push(event));
    const before = connection.connector.getPageState().activeThread?.threadKey;

    // Gmail hides the shown view and reveals another one.
    fixtureElement('thread-view').style.display = 'none';
    fixtureElement('hidden-view').style.display = '';
    await new Promise((resolve) => setTimeout(resolve, 200));
    const after = connection.connector.getPageState().activeThread?.threadKey;

    expect(after).toMatch(/^thread-/);
    expect(after).not.toBe(before);
    expect(events.some((event) => event.type === 'active-thread-changed')).toBe(true);
    connection.connector.dispose();
  });

  it("falls back to the URL's conversation token when the subject has no id", () => {
    loadGmail();
    const subject = fixtureElement('thread-view').querySelector('h2')!;
    subject.removeAttribute('data-thread-perm-id');
    subject.removeAttribute('data-legacy-thread-id');
    const connection = createConnection();

    expect(connection.connector.getPageState().activeThread?.threadKey).toMatch(/^url-/);
    connection.connector.dispose();
  });

  it('adds nothing to Google Chat on the same host', () => {
    loadGmail('conversation-inline-reply.html', '/chat/u/0/');
    const connection = createConnection();

    expect(connection.connector.getPageState()).toMatchObject({ support: 'unsupported', composers: [] });
    expect(connection.locateLauncherAnchors()).toEqual([]);
    connection.connector.dispose();
  });

  it("counts a Gmail page without the app's main area or an editor (e.g. print view) as unsupported", () => {
    loadGmail('conversation-inline-reply.html', '/mail/u/0/?view=pt&search=all');
    document.body.innerHTML =
      '<div class="bodycontainer"><table><tr><td>Yazdırma görünümü</td></tr></table></div>';
    const connection = createConnection();

    expect(connection.connector.getPageState().support).toBe('unsupported');
    connection.connector.dispose();
  });

  it('supports a compose window opened on its own', () => {
    loadGmail('conversation-inline-reply.html', '/mail/u/0/?view=cm&fs=1');
    fixtureElement('gmail-app')
      .querySelectorAll('[role="main"]')
      .forEach((main) => main.remove());
    const connection = createConnection();

    expect(connection.connector.getPageState()).toMatchObject({ support: 'ready', activeThread: null });
    expect(connection.connector.getPageState().composers).toHaveLength(1);
    connection.connector.dispose();
  });

  it('gives each signed-in account its own scope', () => {
    loadGmail('conversation-inline-reply.html', '/mail/u/0/#inbox');
    const first = createConnection();
    const firstScope = first.connector.getPageState().scope?.accountScopeId;
    first.connector.dispose();

    loadGmail('conversation-inline-reply.html', '/mail/u/1/#inbox');
    const second = createConnection();
    expect(second.connector.getPageState().scope?.accountScopeId).not.toBe(firstScope);
    second.connector.dispose();
  });
});

describe('Gmail theme', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.body.removeAttribute('style');
  });

  it('follows a dark Gmail theme from the main surface', () => {
    loadGmail();
    fixtureElement('theme-surface').setAttribute(
      'style',
      'background-color: rgb(32, 33, 36); color: rgb(232, 234, 237)',
    );
    const connection = createConnection();

    expect(connection.readTheme()).toMatchObject({
      scheme: 'dark',
      colors: { background: 'rgb(32, 33, 36)' },
    });
    connection.connector.dispose();
  });

  it('does not guess a theme from a transparent surface', () => {
    loadGmail();
    fixtureElement('theme-surface').setAttribute('style', 'background-color: transparent');
    const connection = createConnection();

    expect(connection.readTheme()).toBeNull();
    connection.connector.dispose();
  });
});
