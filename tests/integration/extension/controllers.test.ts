import { DEFAULT_SETTINGS } from '@email-writer/contracts';
import { createSession, deriveCapabilities } from '@email-writer/core';
import { afterEach, describe, expect, it } from 'vitest';

import { createActionController } from '../../../apps/browser-extension/src/controllers/action-controller';
import { createApplyController } from '../../../apps/browser-extension/src/controllers/apply-controller';
import { createMessageHistory } from '../../../apps/browser-extension/src/controllers/message-history';
import { createPanelController } from '../../../apps/browser-extension/src/controllers/panel-controller';
import { toPanelView } from '../../../apps/browser-extension/src/controllers/panel-view';
import { createSessionStore } from '../../../apps/browser-extension/src/controllers/session-store';
import { createFixtureProcessor } from '../../../apps/browser-extension/src/development/fixture-results';
import { body, message, thread, threadB } from '../../fixtures/synthetic-mail/threads';
import { fixedClock, sequentialIds } from '../../unit/test-dependencies';
import { FakeConnector } from './fake-connector';

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/** Kullanıcı listede başka konudaki bir e-postayı açar. */
function switchToInvoice(connector: FakeConnector) {
  const previous = connector.thread;
  connector.thread = threadB;
  connector.threadSnapshot = thread([message('b1', 0, [body('Fatura ekte')])], {
    ref: threadB,
    subject: 'Fatura',
  });
  connector.emit({ type: 'active-thread-changed', previous, current: threadB });
}

function setup(options: { processorDelayMs?: number; processor?: boolean } = {}) {
  const connector = new FakeConnector();
  const ids = sequentialIds('op');
  const store = createSessionStore(
    createSession({
      sessionId: 's0',
      thread: connector.thread,
      defaults: { targetLanguage: 'en', tone: 'neutral' },
    }),
  );
  const processor =
    options.processor === false ? null : createFixtureProcessor({ delayMs: options.processorDelayMs ?? 0 });
  const history = createMessageHistory({ connector, isEnabled: () => true, debounceMs: 0 });
  const actions = createActionController({ store, connector, processor, history, clock: fixedClock(), ids });
  history.subscribe((snapshot) => actions.threadCaptured(snapshot));
  const copied: string[] = [];
  const applier = createApplyController({
    store,
    connector,
    ids,
    copyText: async (text) => {
      copied.push(text);
      return { ok: true, value: undefined };
    },
  });
  const panel = createPanelController({ store, connector, actions, ids, settings: () => DEFAULT_SETTINGS });
  const view = () =>
    toPanelView({
      state: store.getState(),
      capabilities: deriveCapabilities(store.getState(), { processingAvailable: processor !== null }),
      page: connector.getPageState(),
      ui: { pendingReplace: null, replyReplaceComposer: null, notice: null },
      history: history.entries(),
    });
  return { connector, store, actions, applier, panel, history, view, copied };
}

describe('Panel akışı (sahte bağlantı ile)', () => {
  let current: ReturnType<typeof setup> | null = null;
  afterEach(() => {
    current?.actions.dispose();
    current?.panel.dispose();
    current?.history.dispose();
    current = null;
  });

  it('taslaktaki "Düzelt" düğmesi işlemi doğrudan yapar: seçim kaynak olur, sonuç kartta seçime uygulanır', async () => {
    current = setup();
    const { panel, applier, store, connector, view } = current;

    await panel.runQuickAction(connector.composer, { operation: 'revise' });
    expect(panel.surface()).toEqual({ kind: 'inline', composerKey: 'c1' });
    expect(view().source).toMatchObject({ origin: 'draft-selection', text: 'toplantı' });
    expect(view().apply.mode).toBe('replace-selection');
    expect(view().preview).toMatchObject({ text: 'Toplantıyı yarın yapabiliriz.', sample: true });

    await applier.apply();
    expect(connector.applied).toHaveLength(1);
    expect(connector.applied[0]?.target).toMatchObject({
      mode: 'replace-selection',
      selectionId: 'sel-1',
      expectedRevision: 3,
    });
    expect(store.getState().phase.status).toBe('applied');
    expect(view().status).toEqual({ kind: 'success', message: 'applied' });
    expect(view().apply.canUndo).toBe(true);
  });

  it('normal derlemede (metin işleme yok) düğme nedenini açıklar ve işlem kaydı oluşmaz', async () => {
    current = setup({ processor: false });
    const { panel, actions, store, connector, view } = current;
    await panel.runQuickAction(connector.composer, { operation: 'revise' });

    expect(view().prepare).toEqual({
      canPrepare: false,
      blocker: 'PROCESSING_UNAVAILABLE',
      isPreparing: false,
    });
    await actions.prepare();
    expect(store.getState().action).toBeNull();
  });

  it('sonuç beklenirken kaynak değişirse geç gelen sonuç gösterilmez', async () => {
    current = setup({ processorDelayMs: 30 });
    const { panel, actions, store, connector } = current;
    panel.open({ origin: 'composer-launcher', composer: connector.composer });
    await tick();

    const pending = actions.prepare();
    await tick();
    store.dispatch({ type: 'form-changed', changes: { sourceText: 'başka metin' } });
    await pending;
    await tick(40);

    expect(store.getState().preview).toBeNull();
    expect(store.getState().phase.status).toBe('editing');
  });

  it('sonuç hazırlanırken kullanıcı taslağa yazarsa eski sonuç uygulanamaz', async () => {
    current = setup();
    const { panel, applier, connector, view } = current;
    await panel.runQuickAction(connector.composer, { operation: 'revise' });

    connector.userTypes(' ve yeni yazı');
    expect(view().staleNotice).toBe('TARGET_CHANGED');
    expect(view().apply.canApply).toBe(false);
    await applier.apply();
    expect(connector.applied).toHaveLength(0);
  });

  it('konuşma düğmesinden açılınca yanıt modunda konuşmayı okur ve bağlamı açıklar', async () => {
    current = setup();
    const { panel, view, connector } = current;

    panel.open({ origin: 'thread-launcher', thread: connector.thread! });
    await tick();

    expect(view().operation).toBe('reply');
    expect(view().context.status).toBe('ready');
    expect(view().context.notices).toContainEqual({ kind: 'message-count', count: 3 });
    expect(view().context.messages.find((message) => message.isReplyTarget)?.locked).toBe(true);
  });

  it('paneli kapatmak okumayı iptal eder ama girilen metni korur', async () => {
    current = setup();
    const { panel, store, connector } = current;
    connector.readDelayMs = 30;
    panel.open({ origin: 'thread-launcher', thread: connector.thread! });
    store.dispatch({ type: 'form-changed', changes: { instruction: 'Teşekkür et' } });
    panel.close();
    await tick(40);

    expect(panel.isOpen()).toBe(false);
    expect(store.getState().threadSnapshot).toBeNull();
    expect(store.getState().form.instruction).toBe('Teşekkür et');
  });

  it('hesap değişince eski çalışmanın içeriği temizlenir', async () => {
    current = setup();
    const { panel, store, connector } = current;
    panel.open({ origin: 'composer-launcher', composer: connector.composer });
    await tick();

    connector.emit({ type: 'account-changed' });
    expect(store.getState().form.sourceText).toBe('');
    expect(store.getState().staleReason).toBe('account-changed');
  });

  it('başka e-postaya geçince çalışma o e-postayla kendiliğinden başlar; panel açıksa yeni bağlam okunur', async () => {
    current = setup();
    const { panel, store, connector, view } = current;
    panel.open({ origin: 'thread-launcher', thread: connector.thread! });
    store.dispatch({ type: 'form-changed', changes: { instruction: 'Teşekkür et' } });
    await tick();

    switchToInvoice(connector);
    await tick(5);

    expect(store.getState().thread).toEqual(threadB);
    expect(store.getState().form.instruction).toBe('');
    expect(view().operation).toBe('reply');
    expect(view().staleNotice).toBeNull();
    expect(panel.surface()).toEqual({ kind: 'panel' });
    // Önceki konuşmanın mesajları listede (yeniden eskiye) seçilmemiş kalır; yeni konuşmanınki bağlamdadır.
    expect(view().context.messages.map((m) => [m.messageKey, m.group, m.included])).toEqual([
      ['b1', 'current', true],
      ['m3', 'other', false],
      ['m2', 'other', false],
      ['m1', 'other', false],
    ]);
  });

  it('başka e-postanın taslağındaki düğme, önceki çalışmayı sormadan işlemi doğrudan yapar', async () => {
    current = setup();
    const { panel, store, connector, view } = current;
    await panel.runQuickAction(connector.composer, { operation: 'revise' });
    expect(view().preview).not.toBeNull();

    // Sayfa olayı henüz gelmeden yeni e-postanın taslağından düğmeye basılır.
    connector.thread = threadB;
    connector.composer = { scope: connector.scope, composerKey: 'c2', threadKey: threadB.threadKey };
    await panel.runQuickAction(connector.composer, { operation: 'translate', language: 'en' });

    expect(panel.surface()).toEqual({ kind: 'inline', composerKey: 'c2' });
    expect(store.getState().thread).toEqual(threadB);
    expect(view().staleNotice).toBeNull();
    expect(view().operation).toBe('translate');
    expect(view().preview).toMatchObject({ text: 'We can hold the meeting tomorrow.' });
  });

  it('kart açıkken başka e-postaya geçilince kart kapanır; önceki sonuç yeni e-postada görünmez', async () => {
    current = setup();
    const { panel, store, connector } = current;
    await panel.runQuickAction(connector.composer, { operation: 'revise' });

    switchToInvoice(connector);

    expect(panel.surface()).toEqual({ kind: 'closed' });
    expect(store.getState().thread).toEqual(threadB);
    expect(store.getState().preview).toBeNull();
  });

  it('yeni ileti yazılırken başka e-posta açılsa da yazılan talimat korunur', async () => {
    current = setup();
    const { panel, store, connector } = current;
    connector.composer = { ...connector.composer, threadKey: null };
    await panel.runQuickAction(connector.composer, { operation: 'compose' });
    store.dispatch({ type: 'form-changed', changes: { instruction: 'Ekibe toplantı öner' } });

    switchToInvoice(connector);

    expect(store.getState().thread).toBeNull();
    expect(store.getState().form.instruction).toBe('Ekibe toplantı öner');
  });

  it('"Yanıt yaz" kartı kapatılıp aynı düğmeyle yeniden açılınca hazır yanıt eskimez ve taslağa uygulanır', async () => {
    current = setup();
    const { panel, store, connector, view, applier, actions } = current;
    await panel.runQuickAction(connector.composer, { operation: 'reply' });
    store.dispatch({ type: 'form-changed', changes: { instruction: 'Teşekkür et' } });
    await actions.prepare();
    panel.close();

    await panel.runQuickAction(connector.composer, { operation: 'reply' });
    expect(view().preview).toMatchObject({ stale: false });
    await applier.apply();
    expect(connector.applied).toHaveLength(1);
  });

  it('taslağa yazı eklendikten sonra kart yeniden açılırsa önizleme eskir; yeni metin üzerine uygulanmaz', async () => {
    current = setup();
    const { panel, store, connector, view, applier, actions } = current;
    connector.selection = null;
    await panel.runQuickAction(connector.composer, { operation: 'reply' });
    store.dispatch({ type: 'form-changed', changes: { instruction: 'Teşekkür et' } });
    await actions.prepare();

    connector.userTypes(' ve yeni yazı');
    await panel.runQuickAction(connector.composer, { operation: 'reply' });
    expect(view().preview).toMatchObject({ stale: true });
    await applier.apply();
    expect(connector.applied).toHaveLength(0);
  });

  it('kopyalama yalnızca önizleme metnini panoya verir', async () => {
    current = setup();
    const { panel, applier, connector, copied } = current;
    await panel.runQuickAction(connector.composer, { operation: 'translate', language: 'en' });

    await applier.copy();
    expect(copied).toEqual(['We can hold the meeting tomorrow.']);
  });

  it('"Yanıt yaz" kartı talimat bekler; bağlam önceden okunur, gönderilen talimatla yanıt hazırlanır', async () => {
    current = setup();
    const { panel, store, connector, view } = current;

    await panel.runQuickAction(connector.composer, { operation: 'reply' });
    expect(panel.surface()).toEqual({ kind: 'inline', composerKey: 'c1' });
    expect(view().operation).toBe('reply');
    expect(view().context.status).toBe('ready');
    expect(store.getState().preview).toBeNull();

    store.dispatch({ type: 'form-changed', changes: { instruction: 'Kibarca teşekkür et' } });
    await current.actions.prepare();
    expect(view().preview?.text).toMatch(/Mesajınız için teşekkürler/);

    panel.expandToPanel();
    expect(panel.surface()).toEqual({ kind: 'panel' });
  });

  it('kullanıcı başka işleme geçince eski işlemin eskimiş sonucu gösterilmez', async () => {
    current = setup();
    const { panel, connector, view } = current;
    await panel.runQuickAction(connector.composer, { operation: 'revise' });
    expect(view().preview).not.toBeNull();

    panel.open({ origin: 'thread-launcher', thread: connector.thread! });
    await tick();

    expect(view().operation).toBe('reply');
    expect(view().preview).toBeNull();
  });

  it('yeni iletide "Yaz" kartı talimat bekler; konuşma bağlamı olmadan e-posta metni hazırlanır', async () => {
    current = setup();
    const { panel, store, connector, view } = current;
    connector.composer = { ...connector.composer, threadKey: null };

    await panel.runQuickAction(connector.composer, { operation: 'compose' });
    expect(view().operation).toBe('compose');
    expect(view().writeOperation).toBe('compose');
    expect(view().context.required).toBe(false);
    expect(store.getState().preview).toBeNull();

    store.dispatch({ type: 'form-changed', changes: { instruction: 'Ekibe perşembe toplantısı öner' } });
    await current.actions.prepare();
    expect(view().preview?.text).toMatch(/Perşembe 14:00/);
  });

  it('okuma bölmesi yanıt editörüne dönüşünce bağlam ve yanıtlanan mesaj daha önce açılan mesajlardan gelir', async () => {
    current = setup();
    const { panel, store, connector, view } = current;
    // Kullanıcı mesajı açtı; arka planda okunup geçmişe eklendi.
    await tick(5);

    // "Reply": okuma bölmesinde mesaj gövdesi kalmaz; bağlantı yanıtlanan mesajı bildirir.
    connector.threadSnapshot = thread([], { activeMessageKey: 'm3' });
    await panel.runQuickAction(connector.composer, { operation: 'reply' });

    expect(view().context.messages.map((m) => [m.messageKey, m.included, m.isReplyTarget])).toEqual([
      ['m1', true, false],
      ['m2', true, false],
      ['m3', true, true],
    ]);
    store.dispatch({ type: 'form-changed', changes: { instruction: 'Teşekkür et' } });
    await current.actions.prepare();
    expect(store.getState().action?.context?.activeMessageKey).toBe('m3');
    expect(view().preview).not.toBeNull();
  });

  describe('okunan mesajlar ve bağlam', () => {
    it('aynı konuşmada sonradan açılan mesaj bağlama kendiliğinden girer', async () => {
      current = setup();
      const { panel, connector, view } = current;
      panel.open({ origin: 'thread-launcher', thread: connector.thread! });
      await tick();
      expect(view().context.messages.filter((m) => m.included)).toHaveLength(3);

      // Kullanıcı aynı konuşmanın başka bir mesajını açar (okuma bölmesi yalnızca onu gösterir).
      connector.threadSnapshot = thread([message('m4', 0, [body('Dördüncü mesaj')])]);
      connector.emit({ type: 'thread-content-changed', threadRef: connector.thread! });
      await tick(5);

      const messages = view().context.messages;
      expect(messages.map((m) => [m.messageKey, m.group, m.included])).toEqual([
        ['m1', 'current', true],
        ['m2', 'current', true],
        ['m3', 'current', true],
        ['m4', 'current', true],
      ]);
    });

    it('önceki konuşmadan okunan mesaj, kullanıcı eklerse bağlama "başka konuşma" olarak girer', async () => {
      current = setup();
      const { panel, actions, connector, store } = current;
      panel.open({ origin: 'thread-launcher', thread: connector.thread! });
      await tick();

      switchToInvoice(connector);
      await tick(5);
      actions.setMessageIncluded('m2', true);

      expect(store.getState().context?.messages.find((m) => m.messageKey === 'm2')).toMatchObject({
        conversation: 'other',
        subject: 'Proje toplantısı',
      });
    });

    it('bağlamdaki mesaj metni düzenlenebilir ve orijinaline döndürülebilir', async () => {
      current = setup();
      const { panel, actions, connector, view } = current;
      panel.open({ origin: 'thread-launcher', thread: connector.thread! });
      await tick();

      actions.setMessageText('m2', 'Yalnızca fatura sorusu önemli.');
      expect(view().context.messages.find((m) => m.messageKey === 'm2')).toMatchObject({
        text: 'Yalnızca fatura sorusu önemli.',
        edited: true,
      });

      actions.setMessageText('m2', null);
      expect(view().context.messages.find((m) => m.messageKey === 'm2')?.edited).toBe(false);
    });

    it('hesap değişince okunan mesajlar silinir', async () => {
      current = setup();
      const { connector, history } = current;
      await tick(5);
      expect(history.entries().length).toBeGreaterThan(0);

      connector.emit({ type: 'account-changed' });
      expect(history.entries()).toEqual([]);
    });
  });
});
