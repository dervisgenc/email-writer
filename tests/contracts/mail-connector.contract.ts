import type { ComposerRef, MailConnector, MailEvent, ThreadRef } from '@email-writer/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Her e-posta bağlantısının geçmesi gereken ortak sözleşme testleri. Yeni bir
 * bağlantı (ör. Gmail Web) eklendiğinde aynı testler o bağlantı için de
 * çalıştırılır; mevcut bağlantıların testleri de geçmeye devam etmelidir.
 */
export interface ContractHarness {
  readonly connector: MailConnector;
  /** Taslağın kullanıcıya ait bölgesinde bir ifadeyi seçer. */
  selectInComposer(ref: ComposerRef, phrase: string): void;
  /** Kullanıcının taslakta yazmasını taklit eder. */
  typeInComposer(ref: ComposerRef, text: string): void;
  /** Taslakta bulunan ve seçilebilecek bir ifade. */
  readonly selectablePhrase: string;
  cleanup(): void;
}

const notAborted = { aborted: false };

export function describeMailConnectorContract(name: string, setup: () => ContractHarness): void {
  describe(`MailConnector sözleşmesi: ${name}`, () => {
    let harness: ContractHarness;
    let connector: MailConnector;

    const firstComposer = (): ComposerRef => {
      const composer = connector.getPageState().composers[0];
      if (composer === undefined) {
        throw new Error('Sözleşme testi için açık bir taslak gerekir.');
      }
      return composer;
    };
    const activeThread = (): ThreadRef => {
      const thread = connector.getPageState().activeThread;
      if (thread === null) {
        throw new Error('Sözleşme testi için açık bir konuşma gerekir.');
      }
      return thread;
    };

    async function selectAndApply(text: string, applyOperationId = 'apply-1') {
      const composer = firstComposer();
      harness.selectInComposer(composer, harness.selectablePhrase);
      const selection = await connector.captureDraftSelection(composer);
      if (!selection.ok || selection.value === null) {
        throw new Error('Seçim yakalanamadı.');
      }
      const request = {
        applyOperationId,
        target: {
          mode: 'replace-selection' as const,
          composerRef: composer,
          expectedRevision: selection.value.composerRevision,
          selectionId: selection.value.selectionId,
        },
        text,
      };
      return { composer, request, outcome: await connector.applyText(request) };
    }

    beforeEach(() => {
      harness = setup();
      connector = harness.connector;
    });
    afterEach(() => {
      connector.dispose();
      harness.cleanup();
    });

    it('sayfa durumu tek bir kapsamdaki konuşma ve taslak referanslarını verir', () => {
      const state = connector.getPageState();
      expect(state.support).toBe('ready');
      expect(state.scope).not.toBeNull();
      expect(activeThread().scope).toEqual(state.scope);
      expect(
        state.composers.every((composer) => composer.scope.accountScopeId === state.scope?.accountScopeId),
      ).toBe(true);
    });

    it('başka kapsamdaki konuşmayı okumaz; kapsamı asla "tamamı" olarak bildirmez', async () => {
      const thread = activeThread();
      const foreign = { ...thread, scope: { ...thread.scope, accountScopeId: 'baska-hesap' } };
      const rejected = await connector.readThread(foreign, notAborted);
      expect(rejected).toEqual({ ok: false, error: expect.objectContaining({ code: 'THREAD_CHANGED' }) });

      const snapshot = await connector.readThread(thread, notAborted);
      if (!snapshot.ok) throw new Error(snapshot.error.code);
      expect(snapshot.value.ref).toEqual(thread);
      expect(snapshot.value.coverage.source).toBe('visible-dom');
      expect(['partial', 'unknown']).toContain(snapshot.value.coverage.status);
    });

    it('bilinmeyen taslak için TARGET_MISSING döner', async () => {
      const composer = { ...firstComposer(), composerKey: 'olmayan-taslak' };
      expect(await connector.readComposer(composer)).toEqual({
        ok: false,
        error: expect.objectContaining({ code: 'TARGET_MISSING' }),
      });
    });

    it('yakalanan seçim, taslağın yazılabilir metnindeki aralıkla aynıdır', async () => {
      const composer = firstComposer();
      harness.selectInComposer(composer, harness.selectablePhrase);
      const selection = await connector.captureDraftSelection(composer);
      const snapshot = await connector.readComposer(composer);
      if (!selection.ok || selection.value === null || !snapshot.ok) throw new Error('beklenmeyen hata');

      expect(selection.value.text).toBe(harness.selectablePhrase);
      expect(snapshot.value.editableText.slice(selection.value.start, selection.value.end)).toBe(
        harness.selectablePhrase,
      );
    });

    it('aynı uygulama kimliğiyle ikinci kez yazmaz', async () => {
      const { request, outcome } = await selectAndApply('YENİ METİN');
      expect(outcome.status).toBe('applied');
      const again = await connector.applyText(request);
      expect(again.status).toBe('rejected');
    });

    it('taslak sonradan değiştiyse eski hedefe yazmaz', async () => {
      const composer = firstComposer();
      harness.selectInComposer(composer, harness.selectablePhrase);
      const selection = await connector.captureDraftSelection(composer);
      if (!selection.ok || selection.value === null) throw new Error('seçim yok');
      harness.typeInComposer(composer, ' sonradan yazdım');

      const outcome = await connector.applyText({
        applyOperationId: 'apply-stale',
        target: {
          mode: 'replace-selection',
          composerRef: composer,
          expectedRevision: selection.value.composerRevision,
          selectionId: selection.value.selectionId,
        },
        text: 'YENİ METİN',
      });
      const after = await connector.readComposer(composer);
      expect(outcome).toEqual({
        status: 'rejected',
        error: expect.objectContaining({ code: 'TARGET_CHANGED' }),
      });
      expect(after.ok && after.value.editableText.includes('YENİ METİN')).toBe(false);
      expect(after.ok && after.value.editableText.includes('sonradan yazdım')).toBe(true);
    });

    it('son uygulamayı geri alır; araya yazı girdiyse geri almaz', async () => {
      const before = await connector.readComposer(firstComposer());
      const { composer, outcome } = await selectAndApply('YENİ METİN');
      if (outcome.status !== 'applied' || outcome.undoId === null) throw new Error('uygulanmadı');

      const undone = await connector.undoChange(outcome.undoId);
      const restored = await connector.readComposer(composer);
      expect(undone.status).toBe('undone');
      expect(restored.ok && before.ok && restored.value.editableText).toBe(
        before.ok && before.value.editableText,
      );

      const second = await selectAndApply('İKİNCİ', 'apply-2');
      if (second.outcome.status !== 'applied' || second.outcome.undoId === null)
        throw new Error('uygulanmadı');
      harness.typeInComposer(composer, ' yeni yazı');
      expect(await connector.undoChange(second.outcome.undoId)).toEqual({
        status: 'rejected',
        error: expect.objectContaining({ code: 'UNDO_INVALID' }),
      });
    });

    it('abonelikten çıkılabilir', () => {
      const events: MailEvent[] = [];
      const unsubscribe = connector.subscribe((event) => events.push(event));
      unsubscribe();
      expect(typeof unsubscribe).toBe('function');
      expect(events).toEqual([]);
    });
  });
}
