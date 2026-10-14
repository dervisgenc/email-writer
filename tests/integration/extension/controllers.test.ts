import { DEFAULT_SETTINGS } from '@email-writer/contracts';
import { createSession, deriveCapabilities } from '@email-writer/core';
import { afterEach, describe, expect, it } from 'vitest';

import { createActionController } from '../../../apps/browser-extension/src/controllers/action-controller';
import { createApplyController } from '../../../apps/browser-extension/src/controllers/apply-controller';
import { createPanelController } from '../../../apps/browser-extension/src/controllers/panel-controller';
import { toPanelView } from '../../../apps/browser-extension/src/controllers/panel-view';
import { createSessionStore } from '../../../apps/browser-extension/src/controllers/session-store';
import { createFixtureProcessor } from '../../../apps/browser-extension/src/development/fixture-results';
import { fixedClock, sequentialIds } from '../../unit/test-dependencies';
import { FakeConnector } from './fake-connector';

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const actions = createActionController({ store, connector, processor, clock: fixedClock(), ids });
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
    });
  return { connector, store, actions, applier, panel, view, copied };
}

describe('Panel akışı (sahte bağlantı ile)', () => {
  let current: ReturnType<typeof setup> | null = null;
  afterEach(() => {
    current?.actions.dispose();
    current?.panel.dispose();
    current = null;
  });

  it('taslaktaki "Düzelt" hızlı işlemi: seçim kaynak olur, örnek sonuç seçime uygulanır', async () => {
    current = setup();
    const { panel, actions, applier, store, connector, view } = current;

    panel.open({ origin: 'composer-launcher', composer: connector.composer, quickAction: 'revise' });
    await tick();
    expect(panel.isOpen()).toBe(true);
    expect(view().source).toMatchObject({ origin: 'draft-selection', text: 'toplantı' });
    expect(view().apply.mode).toBe('replace-selection');

    await actions.prepare();
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
    panel.open({ origin: 'composer-launcher', composer: connector.composer, quickAction: 'revise' });
    await tick();

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
    panel.open({ origin: 'composer-launcher', composer: connector.composer, quickAction: 'revise' });
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
    const { panel, actions, applier, connector, view } = current;
    panel.open({ origin: 'composer-launcher', composer: connector.composer, quickAction: 'revise' });
    await tick();
    await actions.prepare();

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
    panel.open({ origin: 'composer-launcher', composer: connector.composer, quickAction: 'revise' });
    await tick();

    connector.emit({ type: 'account-changed' });
    expect(store.getState().form.sourceText).toBe('');
    expect(store.getState().staleReason).toBe('account-changed');
  });

  it('başka konuşmanın çalışması varken yeni konuşmadan açılırsa içerik silinmez; yeni çalışma önerilir', async () => {
    current = setup();
    const { panel, store, connector, view } = current;
    panel.open({ origin: 'composer-launcher', composer: connector.composer, quickAction: 'revise' });
    await tick();

    const other = { scope: connector.scope, threadKey: 'thread-b' };
    connector.thread = other;
    connector.emit({ type: 'active-thread-changed', previous: null, current: other });
    panel.open({ origin: 'thread-launcher', thread: other });

    expect(store.getState().form.sourceText).toBe('toplantı');
    expect(view().canStartNewWork).toBe(true);
    expect(view().staleNotice).toBe('THREAD_CHANGED');

    panel.startNewWork();
    expect(store.getState().thread).toEqual(other);
    expect(store.getState().form.sourceText).toBe('');
  });

  it('kopyalama yalnızca önizleme metnini panoya verir', async () => {
    current = setup();
    const { panel, actions, applier, connector, copied } = current;
    panel.open({ origin: 'composer-launcher', composer: connector.composer, quickAction: 'translate' });
    await tick();
    await actions.prepare();

    await applier.copy();
    expect(copied).toEqual(['We can hold the meeting tomorrow.']);
  });
});
