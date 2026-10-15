import type { ApplyRequest, ComposerRef, MailEvent } from '@email-writer/contracts';
import type { OutlookWebConnection } from '@email-writer/outlook-web';
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

describeMailConnectorContract('Outlook Web (sentetik örnek)', () => {
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

describe('Outlook Web bağlantısı — sayfa ve konuşma okuma', () => {
  let connection: OutlookWebConnection;

  beforeEach(() => {
    loadFixture('conversation-inline-reply.html');
    connection = createConnection();
  });
  afterEach(() => {
    connection.connector.dispose();
    document.body.innerHTML = '';
  });

  it('konuşmayı ve arama kutusu hariç yanıt taslağını tanır; mesaj gövdesi toplamaz', () => {
    const state = connection.connector.getPageState();

    expect(state.support).toBe('ready');
    expect(state.activeThread?.threadKey).toMatch(/^conv-/);
    expect(state.composers).toHaveLength(1);
    expect(state.composers[0]?.threadKey).toBe(state.activeThread?.threadKey);
    // Hesap kapsamı opaktır; hesap adını veya adresini taşımaz.
    expect(state.scope?.accountScopeId).toMatch(/^acct-[0-9a-z]+$/);
    expect(JSON.stringify(state)).not.toContain('Deneme');
  });

  it('tıklanan konuşmadaki açık mesajları gönderen, tarih ve bloklarıyla okur', async () => {
    const thread = connection.connector.getPageState().activeThread!;
    const result = await connection.connector.readThread(thread, never);
    if (!result.ok) throw new Error(result.error.code);
    const [first, second] = result.value.messages;

    expect(result.value.subject).toBe('Proje toplantısı');
    expect(result.value.messages).toHaveLength(2);
    // Gönderenin adresi alınmaz; görünen tarih ayrıştırılmaz.
    expect(first).toMatchObject({
      senderLabel: 'Mehmet Demir',
      sentAt: null,
      sentAtText: 'Cum 10.10.2026 11:00',
    });
    expect(first?.blocks.map((block) => block.kind)).toEqual(['body', 'signature']);
    expect(first?.blocks[0]?.text).toBe('Merhaba Ayşe,\n\nPerşembe 14:00 toplantısını teyit edebilir misin?');

    // Tarih elemanı tanınmıyorsa tarih uydurulmaz.
    expect(second).toMatchObject({ senderLabel: 'Ayşe Kaya', sentAt: null, sentAtText: null });
    expect(second?.blocks.map((block) => block.kind)).toEqual(['body', 'quote']);
  });

  it('gizli metni, betikleri ve form değerlerini almaz; tablo ve listeleri okunur tutar', async () => {
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

  it('kapalı mesajı okunmuş saymaz ve kapsamı açıkça raporlar', async () => {
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
    // İki açık mesaj var ve makinece okunur tarih yok: aktif mesaj tahmin edilmez.
    expect(result.value.activeMessageKey).toBeNull();
  });

  it('okuma iptal edilirse yarım sonuç dönmez', async () => {
    const thread = connection.connector.getPageState().activeThread!;
    const result = await connection.connector.readThread(thread, { aborted: true });
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'READ_CANCELLED' }) });
  });

  it('konuşma değişince olay yayar ve eski konuşmayı okumaz', async () => {
    const events: MailEvent[] = [];
    connection.connector.subscribe((event) => events.push(event));
    const previous = connection.connector.getPageState().activeThread!;

    // Outlook başka konuşmayı açınca listede seçim ve okuma bölmesi birlikte değişir.
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

  it("ileti listesi kaydırılıp seçili satır DOM'dan çıkınca konuşma değişmiş sayılmaz", async () => {
    const events: MailEvent[] = [];
    connection.connector.subscribe((event) => events.push(event));
    const thread = connection.connector.getPageState().activeThread!;

    // Sanal liste ekran dışındaki satırları kaldırır; okuma bölmesi aynı kalır.
    document.querySelector('[data-convid="AAQkCONV1"]')?.remove();
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(events.some((event) => event.type === 'active-thread-changed')).toBe(false);
    expect(connection.connector.getPageState().activeThread).toEqual(thread);
    expect((await connection.connector.readThread(thread, never)).ok).toBe(true);
  });

  it('gelen mesajdaki seçimi, ait olduğu mesajın kimliğiyle verir', async () => {
    const thread = connection.connector.getPageState().activeThread!;
    const snapshot = await connection.connector.readThread(thread, never);
    if (!snapshot.ok) throw new Error(snapshot.error.code);
    selectText(document.getElementById('UniqueMessageBody_2')!, 'Thursday works for me');

    const selection = await connection.connector.readSelectedMessageText(thread);
    if (!selection.ok || selection.value === null) throw new Error('seçim yok');
    expect(selection.value.text).toBe('Thursday works for me');
    expect(selection.value.messageKey).toBe(snapshot.value.messages[1]?.messageKey);
  });
});

describe('Outlook Web bağlantısı — taslak okuma ve yazma', () => {
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
    if (!selection.ok || selection.value === null) throw new Error('seçim yok');
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

  it('kullanıcının yazdığı bölümü imza ve alıntıdan ayırır', async () => {
    const result = await connection.connector.readComposer(composer);
    if (!result.ok) throw new Error(result.error.code);

    expect(result.value.editableText).toBe(
      'Toplantı yarın olsun mu, toplantı odası hazır.\nİkinci satır burada.',
    );
    expect(result.value.canReplaceBody).toBe(true);
    expect(result.value.containsRichContent).toBe(false);
  });

  it('seçili bölümü değiştirir; öncesi, sonrası, imza ve alıntı aynı kalır', async () => {
    const selection = await captureSelection('toplantı odası');
    const outcome = await connection.connector.applyText(selectionRequest(selection, 'salon'));

    expect(outcome.status).toBe('applied');
    expect(editor().textContent).toContain('Toplantı yarın olsun mu, salon hazır.');
    expect(document.getElementById('Signature')?.textContent).toContain('Deneme Kullanıcı');
    expect(document.getElementById('divRplyFwdMsg')?.textContent).toContain('Ayşe Kaya');
  });

  it('aynı kelime farklı yerlerde varsa yalnızca seçilen geçiş değişir', async () => {
    // "toplantı" ikinci kez (küçük harfle) geçiyor; yalnızca o seçilir.
    const selection = await captureSelection('toplantı', 0);
    await connection.connector.applyText(selectionRequest(selection, 'oda'));

    expect(editor().querySelector('div')?.textContent).toBe('Toplantı yarın olsun mu, oda odası hazır.');
  });

  it('imzaya taşan seçim taslak seçimi olarak kabul edilmez', async () => {
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

  it('uygulama düğmesine iki kez basılırsa tek yazma yapılır', async () => {
    const selection = await captureSelection('toplantı odası');
    const request = selectionRequest(selection, 'salon');
    const [first, second] = await Promise.all([
      connection.connector.applyText(request),
      connection.connector.applyText(request),
    ]);

    expect([first.status, second.status].sort()).toEqual(['applied', 'rejected']);
    expect(writer.calls).toBe(1);
  });

  it('yazma doğrulanamazsa sonuç belirsizdir ve otomatik tekrar yapılmaz', async () => {
    const faulty = {
      id: 'faulty',
      replaceRange: (_editor: HTMLElement, range: Range) => {
        range.insertNode(document.createTextNode('[yarım]'));
        return true;
      },
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

  it('editör değişikliği kabul etmezse güvenle reddeder', async () => {
    connection.connector.dispose();
    connection = createConnection({ id: 'refusing', replaceRange: () => false });
    composer = connection.connector.getPageState().composers[0]!;
    const selection = await captureSelection('toplantı odası');

    expect(await connection.connector.applyText(selectionRequest(selection, 'salon'))).toEqual({
      status: 'rejected',
      error: expect.objectContaining({ code: 'WRITE_UNSUPPORTED' }),
    });
  });

  it('gövdeyi değiştirirken imza ve önceki yazışmayı korur', async () => {
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

  it('DOM editörü yeniden oluşturursa eski seçim ve hedef kullanılamaz', async () => {
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

  it('taslak kaldırılınca olay yayar', async () => {
    const events: MailEvent[] = [];
    connection.connector.subscribe((event) => events.push(event));
    editor().closest('[id^="docking_InitVisiblePart"]')?.remove();
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(events).toContainEqual({ type: 'composer-removed', ref: composer });
    expect(connection.connector.getPageState().composers).toEqual([]);
  });

  it('eklentinin kendi arayüzündeki metin okunmaz ve editör sayılmaz', async () => {
    const host = document.createElement('div');
    host.setAttribute('data-email-writer-ui', 'panel');
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
