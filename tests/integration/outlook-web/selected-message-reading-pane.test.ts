import type { ThreadSnapshot } from '@email-writer/contracts';
import type { OutlookWebConnection } from '@email-writer/outlook-web';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createConnection, loadFixture, never } from './outlook-page';

/**
 * Gerçek Outlook yapısının anonim örneği: okuma bölmesinde yalnızca seçili
 * mesaj gösteriliyor (15 Ekim 2026, Firefox, iş hesabı, İngilizce arayüz).
 */
describe('Outlook Web — seçili mesaj görünümü (gerçek yapı)', () => {
  let connection: OutlookWebConnection;

  const readActiveThread = async (): Promise<ThreadSnapshot> => {
    const thread = connection.connector.getPageState().activeThread;
    if (thread === null) throw new Error('Açık konuşma bulunamadı.');
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

  it('seçili satırın konuşma kimliğiyle açık mesajı tanır', () => {
    const state = connection.connector.getPageState();

    expect(state.support).toBe('ready');
    expect(state.activeThread?.threadKey).toMatch(/^conv-/);
    expect(state.composers).toEqual([]);
  });

  it('konuyu, gönderenin görünen adını ve görünen tarihi başlıktan okur', async () => {
    const snapshot = await readActiveThread();
    const [message] = snapshot.messages;

    expect(snapshot.subject).toBe('RE: Teklif revizyonu');
    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.activeMessageKey).toBe(message?.messageKey);
    // Adres atılır; tarih ayrıştırılmaz.
    expect(message).toMatchObject({
      senderLabel: 'Deniz Yılmaz',
      sentAt: null,
      sentAtText: 'Wed 15-Oct-26 9:12 AM',
    });
    expect(message?.senderLabel).not.toContain('@');
  });

  it('gövdeyi ve önceki yazışmayı ayırır; boş tablo hücresi ve Outlook düğmeleri metne karışmaz', async () => {
    const [message] = (await readActiveThread()).messages;
    const [body, quote] = message?.blocks ?? [];

    expect(message?.blocks.map((block) => block.kind)).toEqual(['body', 'quote']);
    expect(body?.text).toBe(
      // Tablodan sonraki <br> tarayıcıda olduğu gibi bir boş satır bırakır.
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

  it('başlıkta gönderen yoksa alıcıyı veya alıntıdaki adresi gönderen saymaz', async () => {
    document.getElementById('MSG_Itm0001_FROM')?.remove();

    const [message] = (await readActiveThread()).messages;

    expect(message?.senderLabel).toBeNull();
    expect(message?.sentAtText).toBe('Wed 15-Oct-26 9:12 AM');
  });

  it('gönderen yalnızca adresle görünüyorsa adı bilinmiyor sayar; adresi ad olarak vermez', async () => {
    document.getElementById('MSG_Itm0001_FROM')!.textContent = 'no-reply@example.test';

    const [message] = (await readActiveThread()).messages;

    expect(message?.senderLabel).toBeNull();
  });

  it('"adına gönderilmiş" iletide yazarı (son kişi kartı) alır; gönderen hesabın adresini almaz', async () => {
    // Gerçek yapı: [gönderen hesap kartı] "on behalf of" [yazar kartı]
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

  it('mesaj kimliği başlığı ve gövdeyi birlikte taşıyan kapsayıcıya bağlıdır; okumalar arasında değişmez', async () => {
    const first = await readActiveThread();
    const second = await readActiveThread();

    expect(second.messages[0]?.messageKey).toBe(first.messages[0]?.messageKey);
  });

  it('Outlook mesajı yeniden çizse de (başka mesaja gidip dönünce) aynı ileti aynı kimliği alır', async () => {
    const first = await readActiveThread();
    const container = document.querySelector('[data-fixture="message-container"]')!;
    container.replaceWith(container.cloneNode(true));

    const second = await readActiveThread();

    expect(second.messages[0]?.messageKey).toBe(first.messages[0]?.messageKey);
    expect(first.messages[0]?.messageKey).toMatch(/^msg-[0-9a-z]+$/);
  });
});

/**
 * Gerçek yapı: seçili mesaj görünümünde "Reply"a basınca Outlook okuma
 * bölmesindeki mesajı kaldırır ve yerine yanıt editörünü koyar.
 */
describe('Outlook Web — okuma bölmesi yanıt editörüne dönüşünce (gerçek yapı)', () => {
  let connection: OutlookWebConnection;

  beforeEach(() => {
    loadFixture('selected-message-reading-pane.html');
    connection = createConnection();
  });
  afterEach(() => {
    connection.connector.dispose();
    document.body.innerHTML = '';
  });

  it('konuşma değişmiş sayılmaz; editör o konuşmanın yanıtıdır ve konuşma düğmesi yerini araç çubuğuna bırakır', async () => {
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

  it('okuma, yanıtlanan mesajı (gösterilirken kaydedilen) ve konuyu verir; mesaj gövdesi sayfada olmadığı için okunmaz', async () => {
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

  it('Outlook editörü boş açıp alıntıyı sonra doldursa da konuşma korunur ve taslak sonunda yanıt olarak bağlanır', async () => {
    const thread = connection.connector.getPageState().activeThread!;
    const events: string[] = [];
    connection.connector.subscribe((event) => events.push(event.type));

    loadFixture('selected-message-reply-compose.html');
    for (const quote of document.querySelectorAll('#appendonsend, #divRplyFwdMsg')) quote.remove();
    await settle();
    expect(connection.connector.getPageState().activeThread).toEqual(thread);
    expect(connection.connector.getPageState().composers[0]?.threadKey).toBeNull();

    // Outlook alıntıyı doldurur.
    const quote = document.createElement('div');
    quote.id = 'divRplyFwdMsg';
    quote.textContent = 'From: Deniz Yılmaz';
    document.querySelector('[data-fixture="reply-editor"]')!.append(quote);
    // Editörün içi önce editör izleyicisinde birleştirilir, sonra sayfa yeniden değerlendirilir.
    await settle(400);

    expect(connection.connector.getPageState().composers[0]?.threadKey).toBe(thread.threadKey);
    expect(events).not.toContain('active-thread-changed');
    expect(events).toEqual(expect.arrayContaining(['composer-removed', 'composer-added']));
  });

  it('listede başka bir satır seçiliyken açılan yanıt taslağı (ör. Taslaklar klasörü) son konuşmaya bağlanmaz', () => {
    loadFixture('selected-message-reply-compose.html');
    // Taslaklar klasörüne geçilip başka bir satır seçilmiş gibi.
    const row = document.querySelector('[data-convid="AAQkConvFirst"]')!;
    row.setAttribute('data-convid', 'AAQkDraftOther');
    // Gözlemci değişikliği birleştirene kadar beklemeden durum okunur.
    const fresh = createConnection();
    expect(fresh.connector.getPageState().activeThread).toBeNull();
    expect(fresh.connector.getPageState().composers[0]?.threadKey).toBeNull();
    fresh.connector.dispose();
  });
});

/** Sayfa gözlemcisinin değişiklikleri birleştirip işlemesi için bekler. */
function settle(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
