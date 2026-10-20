import type { ApplyRequest, ComposerRef, MailEvent } from '@writehand/contracts';
import type { OutlookWebConnection } from '@writehand/outlook-web';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { describeMailConnectorContract } from '../../contracts/mail-connector.contract';
import {
  createConnection,
  createDomWriter,
  editor,
  loadFixture,
  never,
  selectText,
  typeInto,
} from './outlook-page';

describeMailConnectorContract('Outlook Web (synthetic fixture)', () => {
  loadFixture('conversation-inline-reply.html');
  const connection = createConnection();
  return {
    connector: connection.connector,
    selectablePhrase: 'toplantı odası',
    selectInComposer: (_ref, phrase) => selectText(editor(), phrase),
    typeInComposer: (_ref, text) => typeInto(editor(), text),
    cleanup: () => {
      document.body.innerHTML = '';
    },
  };
});

describe('Outlook Web connector — reading the page and conversation', () => {
  let connection: OutlookWebConnection;

  beforeEach(() => {
    loadFixture('conversation-inline-reply.html');
    connection = createConnection();
  });
  afterEach(() => {
    connection.connector.dispose();
    document.body.innerHTML = '';
  });

  it('recognizes the conversation and the reply draft (but not the search box) without collecting message bodies', () => {
    const state = connection.connector.getPageState();

    expect(state.support).toBe('ready');
    expect(state.activeThread?.threadKey).toMatch(/^conv-/);
    expect(state.composers).toHaveLength(1);
    expect(state.composers[0]?.threadKey).toBe(state.activeThread?.threadKey);
    // The account scope is opaque; it carries neither the account name nor the address.
    expect(state.scope?.accountScopeId).toMatch(/^acct-[0-9a-z]+$/);
    expect(JSON.stringify(state)).not.toContain('Deneme');
  });

  it('reads the expanded messages of the clicked conversation with sender, date and blocks', async () => {
    const thread = connection.connector.getPageState().activeThread!;
    const result = await connection.connector.readThread(thread, never);
    if (!result.ok) throw new Error(result.error.code);
    const [first, second] = result.value.messages;

    expect(result.value.subject).toBe('Proje toplantısı');
    expect(result.value.messages).toHaveLength(2);
    // The sender's address is not taken; the displayed date is not parsed.
    expect(first).toMatchObject({
      senderLabel: 'Mehmet Demir',
      sentAt: null,
      sentAtText: 'Cum 10.10.2026 11:00',
    });
    expect(first?.blocks.map((block) => block.kind)).toEqual(['body', 'signature']);
    expect(first?.blocks[0]?.text).toBe('Merhaba Ayşe,\n\nPerşembe 14:00 toplantısını teyit edebilir misin?');

    // No date is made up when the date element is not recognized.
    expect(second).toMatchObject({ senderLabel: 'Ayşe Kaya', sentAt: null, sentAtText: null });
    expect(second?.blocks.map((block) => block.kind)).toEqual(['body', 'quote']);
  });

  it('skips hidden text, scripts and form values while keeping tables and lists readable', async () => {
    const thread = connection.connector.getPageState().activeThread!;
    const result = await connection.connector.readThread(thread, never);
    if (!result.ok) throw new Error(result.error.code);
    const body = result.value.messages[1]?.blocks[0]?.text ?? '';

    expect(body).toContain('Tutar | 1.250,00 TL');
    expect(body).toContain('Vade | 15.10.2026');
    expect(body).toContain('- Gündem\n- Fatura');
    expect(body).not.toContain('gizli önizleme');
    expect(body).not.toContain('__fixtureScriptRan');
    expect(body).not.toContain('form değeri');
    expect(body).not.toContain('color: red');
  });

  it('does not count a collapsed message as read and reports the coverage explicitly', async () => {
    const thread = connection.connector.getPageState().activeThread!;
    const result = await connection.connector.readThread(thread, never);
    if (!result.ok) throw new Error(result.error.code);

    expect(result.value.coverage).toEqual({
      source: 'visible-dom',
      status: 'partial',
      readableMessageCount: 2,
      knownUnreadableMessageCount: 1,
      reasons: ['unverified-history', 'collapsed-messages'],
    });
    // There are two expanded messages and no machine-readable date, so the active message is not guessed.
    expect(result.value.activeMessageKey).toBeNull();
  });

  it('returns no partial result when the read is cancelled', async () => {
    const thread = connection.connector.getPageState().activeThread!;
    const result = await connection.connector.readThread(thread, { aborted: true });
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'READ_CANCELLED' }) });
  });

  it('emits an event when the conversation changes and no longer reads the old one', async () => {
    const events: MailEvent[] = [];
    connection.connector.subscribe((event) => events.push(event));
    const previous = connection.connector.getPageState().activeThread!;

    // When Outlook opens another conversation, the list selection and the reading pane change together.
    document.querySelector('[data-convid="AAQkCONV1"]')?.setAttribute('aria-selected', 'false');
    document.querySelector('[data-convid="AAQkOTHER"]')?.setAttribute('aria-selected', 'true');
    document.getElementById('CONV_c1_SUBJECT')!.id = 'CONV_c2_SUBJECT';
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(events.some((event) => event.type === 'active-thread-changed')).toBe(true);
    expect(await connection.connector.readThread(previous, never)).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'THREAD_CHANGED' }),
    });
  });

  it('does not count it as a conversation change when the message list scrolls and the selected row leaves the DOM', async () => {
    const events: MailEvent[] = [];
    connection.connector.subscribe((event) => events.push(event));
    const thread = connection.connector.getPageState().activeThread!;

    // The virtual list removes off-screen rows; the reading pane stays the same.
    document.querySelector('[data-convid="AAQkCONV1"]')?.remove();
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(events.some((event) => event.type === 'active-thread-changed')).toBe(false);
    expect(connection.connector.getPageState().activeThread).toEqual(thread);
    expect((await connection.connector.readThread(thread, never)).ok).toBe(true);
  });

  it('returns a selection in a received message together with the ID of its message', async () => {
    const thread = connection.connector.getPageState().activeThread!;
    const snapshot = await connection.connector.readThread(thread, never);
    if (!snapshot.ok) throw new Error(snapshot.error.code);
    selectText(document.getElementById('UniqueMessageBody_2')!, 'Thursday works for me');

    const selection = await connection.connector.readSelectedMessageText(thread);
    if (!selection.ok || selection.value === null) throw new Error('no selection');
    expect(selection.value.text).toBe('Thursday works for me');
    expect(selection.value.messageKey).toBe(snapshot.value.messages[1]?.messageKey);
  });
});

describe('Outlook Web connector — reading and writing the draft', () => {
  let connection: OutlookWebConnection;
  let writer: ReturnType<typeof createDomWriter>;
  let composer: ComposerRef;

  beforeEach(() => {
    loadFixture('conversation-inline-reply.html');
    writer = createDomWriter();
    connection = createConnection(writer);
    composer = connection.connector.getPageState().composers[0]!;
  });
  afterEach(() => {
    connection.connector.dispose();
    document.body.innerHTML = '';
  });

  async function captureSelection(phrase: string, occurrence = 0) {
    selectText(editor(), phrase, occurrence);
    const selection = await connection.connector.captureDraftSelection(composer);
    if (!selection.ok || selection.value === null) throw new Error('no selection');
    return selection.value;
  }

  function selectionRequest(
    selection: { composerRevision: number; selectionId: string },
    text: string,
    id = 'w1',
  ): ApplyRequest {
    return {
      applyOperationId: id,
      target: {
        mode: 'replace-selection',
        composerRef: composer,
        expectedRevision: selection.composerRevision,
        selectionId: selection.selectionId,
      },
      text,
    };
  }

  it('separates the user-written part from the signature and quote', async () => {
    const result = await connection.connector.readComposer(composer);
    if (!result.ok) throw new Error(result.error.code);

    expect(result.value.editableText).toBe(
      'Toplantı yarın olsun mu, toplantı odası hazır.\nİkinci satır burada.',
    );
    expect(result.value.canReplaceBody).toBe(true);
    expect(result.value.containsRichContent).toBe(false);
  });

  it('replaces the selected part, leaving the text before and after, the signature and the quote unchanged', async () => {
    const selection = await captureSelection('toplantı odası');
    const outcome = await connection.connector.applyText(selectionRequest(selection, 'salon'));

    expect(outcome.status).toBe('applied');
    expect(editor().textContent).toContain('Toplantı yarın olsun mu, salon hazır.');
    expect(document.getElementById('Signature')?.textContent).toContain('Deneme Kullanıcı');
    expect(document.getElementById('divRplyFwdMsg')?.textContent).toContain('Ayşe Kaya');
  });

  it('changes only the selected occurrence when the same word appears in several places', async () => {
    // "toplantı" appears a second time (in lowercase); only that occurrence is selected.
    const selection = await captureSelection('toplantı', 0);
    await connection.connector.applyText(selectionRequest(selection, 'oda'));

    expect(editor().querySelector('div')?.textContent).toBe('Toplantı yarın olsun mu, oda odası hazır.');
  });

  it('does not accept a selection that runs into the signature as a draft selection', async () => {
    const range = document.createRange();
    range.setStart(editor().querySelector('div')!.firstChild!, 5);
    range.setEnd(document.getElementById('Signature')!.lastElementChild!.firstChild!, 3);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);

    expect(await connection.connector.captureDraftSelection(composer)).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'SELECTION_INVALID' }),
    });
  });

  it('writes once when the apply button is pressed twice', async () => {
    const selection = await captureSelection('toplantı odası');
    const request = selectionRequest(selection, 'salon');
    const [first, second] = await Promise.all([
      connection.connector.applyText(request),
      connection.connector.applyText(request),
    ]);

    expect([first.status, second.status].sort()).toEqual(['applied', 'rejected']);
    expect(writer.calls).toBe(1);
  });

  it('reports an unverifiable write as uncertain and does not retry automatically', async () => {
    const faulty = {
      id: 'faulty',
      replaceRange: (_editor: HTMLElement, range: Range) => {
        range.insertNode(document.createTextNode('[yarım]'));
        return true;
      },
      insertHtml: () => false,
    };
    connection.connector.dispose();
    connection = createConnection(faulty);
    composer = connection.connector.getPageState().composers[0]!;
    const selection = await captureSelection('toplantı odası');
    const request = selectionRequest(selection, 'salon');

    expect((await connection.connector.applyText(request)).status).toBe('uncertain');
    expect(await connection.connector.applyText(request)).toEqual({
      status: 'rejected',
      error: expect.objectContaining({ code: 'WRITE_UNCERTAIN' }),
    });
  });

  it('rejects safely when the editor does not accept the change', async () => {
    connection.connector.dispose();
    connection = createConnection({ id: 'refusing', replaceRange: () => false, insertHtml: () => false });
    composer = connection.connector.getPageState().composers[0]!;
    const selection = await captureSelection('toplantı odası');

    expect(await connection.connector.applyText(selectionRequest(selection, 'salon'))).toEqual({
      status: 'rejected',
      error: expect.objectContaining({ code: 'WRITE_UNSUPPORTED' }),
    });
  });

  it('keeps the signature and earlier correspondence when replacing the body', async () => {
    const snapshot = await connection.connector.readComposer(composer);
    if (!snapshot.ok) throw new Error(snapshot.error.code);
    const outcome = await connection.connector.applyText({
      applyOperationId: 'body-1',
      target: { mode: 'replace-body', composerRef: composer, expectedRevision: snapshot.value.revision },
      text: 'Tamamen yeni gövde.',
    });
    const after = await connection.connector.readComposer(composer);

    expect(outcome.status).toBe('applied');
    expect(after.ok && after.value.editableText).toBe('Tamamen yeni gövde.');
    expect(document.getElementById('Signature')?.textContent).toContain('Deneme Kullanıcı');
    expect(document.getElementById('divRplyFwdMsg')).not.toBeNull();
  });

  it('writes rich content (table and list) to the body, verifies it against the visible text and keeps it undoable', async () => {
    const snapshot = await connection.connector.readComposer(composer);
    if (!snapshot.ok) throw new Error(snapshot.error.code);
    const outcome = await connection.connector.applyText({
      applyOperationId: 'rich-1',
      target: { mode: 'replace-body', composerRef: composer, expectedRevision: snapshot.value.revision },
      text: 'Fiyatlar:\n\nÜrün | Fiyat\nA | 10\n\n- Teslim yarın',
      rich: {
        html:
          '<div>Fiyatlar:</div><div><br></div><table><thead><tr><th>Ürün</th><th>Fiyat</th></tr></thead>' +
          '<tbody><tr><td>A</td><td>10</td></tr></tbody></table><div><br></div><ul><li>Teslim yarın</li></ul>',
        visibleText: 'Fiyatlar:\nÜrün | Fiyat\nA | 10\n- Teslim yarın',
      },
    });

    expect(outcome).toMatchObject({ status: 'applied', undoId: expect.any(String) });
    expect(editor().querySelector('table td')?.textContent).toBe('A');
    expect(editor().querySelector('ul li')?.textContent).toBe('Teslim yarın');
    expect(document.getElementById('Signature')?.textContent).toContain('Deneme Kullanıcı');
    expect(document.getElementById('divRplyFwdMsg')).not.toBeNull();
  });

  it('writes and verifies after Outlook fills in the quote on focus', async () => {
    const snapshot = await connection.connector.readComposer(composer);
    if (!snapshot.ok) throw new Error(snapshot.error.code);
    const quote = document.getElementById('divRplyFwdMsg')!;
    editor().addEventListener(
      'focus',
      () => quote.append(document.createTextNode(' (Outlook odakta doldurdu)')),
      { once: true },
    );

    const outcome = await connection.connector.applyText({
      applyOperationId: 'focus-1',
      target: { mode: 'replace-body', composerRef: composer, expectedRevision: snapshot.value.revision },
      text: 'Odak sonrası gövde.',
    });

    expect(outcome).toMatchObject({ status: 'applied', undoId: expect.any(String) });
    expect(quote.textContent).toContain('(Outlook odakta doldurdu)');
    const after = await connection.connector.readComposer(composer);
    expect(after.ok && after.value.editableText).toBe('Odak sonrası gövde.');
  });

  it('verifies the write when Outlook appends content after the quote right after writing, but not when the start of the signature changes', async () => {
    const write = async (id: string, react: () => void) => {
      connection.connector.dispose();
      loadFixture('conversation-inline-reply.html');
      const base = createDomWriter();
      connection = createConnection({
        id: 'reacting',
        insertHtml: (target, range, html) => base.insertHtml(target, range, html),
        replaceRange(target, range, text) {
          const accepted = base.replaceRange(target, range, text);
          react();
          return accepted;
        },
      });
      const ref = connection.connector.getPageState().composers[0]!;
      const snapshot = await connection.connector.readComposer(ref);
      if (!snapshot.ok) throw new Error(snapshot.error.code);
      return connection.connector.applyText({
        applyOperationId: id,
        target: { mode: 'replace-body', composerRef: ref, expectedRevision: snapshot.value.revision },
        text: 'Yeni gövde.',
      });
    };

    const appended = await write('react-1', () => {
      const quote = document.createElement('div');
      quote.textContent = 'Outlook alıntıyı sona ekledi';
      editor().append(quote);
    });
    expect(appended.status).toBe('applied');

    const merged = await write('react-2', () =>
      document.getElementById('Signature')?.prepend(document.createTextNode('Yeni gövde.')),
    );
    expect(merged).toMatchObject({ status: 'uncertain' });
  });

  it('does not write rich content into an in-sentence selection', async () => {
    const selection = await captureSelection('toplantı odası');
    const outcome = await connection.connector.applyText({
      ...selectionRequest(selection, 'salon'),
      rich: { html: '<table><tr><td>x</td></tr></table>', visibleText: 'x' },
    });

    expect(outcome).toEqual({
      status: 'rejected',
      error: expect.objectContaining({ code: 'WRITE_UNSUPPORTED' }),
    });
    expect(writer.calls).toBe(0);
  });

  it("does not bump the revision when the signature or earlier correspondence changes, but does when the user's text changes", async () => {
    const before = await connection.connector.readComposer(composer);
    if (!before.ok) throw new Error(before.error.code);
    document.getElementById('divRplyFwdMsg')?.append(document.createTextNode(' (Outlook ekledi)'));
    document.getElementById('Signature')?.append(document.createElement('div'));
    // Outlook may also remove the trailing blank line while adding the quote.
    const blank = document.createElement('div');
    blank.append(document.createElement('br'));
    document.getElementById('Signature')?.before(blank);
    await new Promise((resolve) => setTimeout(resolve, 200));

    const quoted = await connection.connector.readComposer(composer);
    expect(quoted.ok && quoted.value.revision).toBe(before.value.revision);

    // Outlook may restructure written content to fit its own layout (same text).
    const first = editor().querySelector('div')!;
    const wrapper = document.createElement('div');
    first.replaceWith(wrapper);
    wrapper.append(first);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const restructured = await connection.connector.readComposer(composer);
    expect(restructured.ok && restructured.value.revision).toBe(before.value.revision);

    typeInto(editor(), ' ek');
    await new Promise((resolve) => setTimeout(resolve, 200));
    const typed = await connection.connector.readComposer(composer);
    expect(typed.ok && typed.value.revision).toBe(before.value.revision + 1);

    // Adding an image or table changes the draft even when the text stays the same.
    first.append(document.createElement('img'));
    await new Promise((resolve) => setTimeout(resolve, 200));
    const withImage = await connection.connector.readComposer(composer);
    expect(withImage.ok && withImage.value.revision).toBe(before.value.revision + 2);
  });

  it('cannot use the old selection and target after the DOM recreates the editor', async () => {
    const selection = await captureSelection('toplantı odası');
    const old = editor();
    const replacement = old.cloneNode(true) as HTMLElement;
    old.replaceWith(replacement);

    expect(await connection.connector.applyText(selectionRequest(selection, 'salon'))).toEqual({
      status: 'rejected',
      error: expect.objectContaining({ code: 'TARGET_MISSING' }),
    });
    expect(replacement.textContent).toContain('toplantı odası');
  });

  it('emits an event when the draft is removed', async () => {
    const events: MailEvent[] = [];
    connection.connector.subscribe((event) => events.push(event));
    editor().closest('[id^="docking_InitVisiblePart"]')?.remove();
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(events).toContainEqual({ type: 'composer-removed', ref: composer });
    expect(connection.connector.getPageState().composers).toEqual([]);
  });

  it("neither reads text from the extension's own UI nor treats it as an editor", async () => {
    const host = document.createElement('div');
    host.setAttribute('data-writehand-ui', 'panel');
    host.innerHTML = '<div contenteditable="true" role="textbox" aria-multiline="true">panel metni</div>';
    document.getElementById('UniqueMessageBody_1')?.append(host.cloneNode(true));
    document.body.append(host);
    await new Promise((resolve) => setTimeout(resolve, 200));

    const state = connection.connector.getPageState();
    const result = await connection.connector.readThread(state.activeThread!, never);
    expect(state.composers).toHaveLength(1);
    expect(result.ok && JSON.stringify(result.value)).not.toContain('panel metni');
  });
});
