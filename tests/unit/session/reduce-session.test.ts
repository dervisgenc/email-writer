import { appError, DEFAULT_CONTEXT_SELECTION } from '@email-writer/contracts';
import {
  buildContext,
  deriveCapabilities,
  reduceSession,
  validateApply,
  type SessionState,
} from '@email-writer/core';
import { describe, expect, it } from 'vitest';

import { meetingThread, threadA, threadB } from '../../fixtures/synthetic-mail/threads';
import { testDependencies } from '../test-dependencies';
import {
  composerRef,
  newSession,
  prepareFrom,
  reduceAll,
  selectionBinding,
  sessionWithPreview,
} from './session-helpers';

const capabilities = (state: Parameters<typeof deriveCapabilities>[0]) =>
  deriveCapabilities(state, { processingAvailable: true });

describe('reduceSession — sürüm ve geç gelen sonuç', () => {
  it('ikinci işlem başladıktan sonra gelen birinci sonuç gösterilmez', () => {
    const loaded = reduceAll(newSession(), [{ type: 'form-changed', changes: { sourceText: 'ilk metin' } }]);
    const first = prepareFrom(loaded);
    const afterFirst = reduceSession(loaded, { type: 'action-prepared', action: first });
    const edited = reduceSession(afterFirst, {
      type: 'form-changed',
      changes: { sourceText: 'ikinci metin' },
    });
    const second = prepareFrom(edited);
    const afterSecond = reduceSession(edited, { type: 'action-prepared', action: second });

    const late = reduceSession(afterSecond, {
      type: 'result-received',
      candidate: {
        requestId: first.requestId,
        sessionId: 's1',
        formRevision: first.formRevision,
        text: 'eski',
        sample: true,
      },
    });

    expect(late).toBe(afterSecond);
    expect(late.preview).toBeNull();
  });

  it('kaynak aynı metinle yeniden alınınca önizleme eskimez ve taslağın yeni sürümüne uygulanır', () => {
    const preview = sessionWithPreview();
    const reloaded = reduceSession(preview, {
      type: 'source-loaded',
      operationId: null,
      text: selectionBinding.loadedText,
      binding: { ...selectionBinding, composerRevision: 6 },
    });

    expect(reloaded.phase.status).toBe('preview');
    expect(capabilities(reloaded).previewIsStale).toBe(false);
    const request = validateApply(reloaded);
    expect(request.ok && request.value.target.expectedRevision).toBe(6);
  });

  it('kaynak metni değişince önizleme eskir ve taslağa uygulanamaz', () => {
    const changed = reduceSession(sessionWithPreview(), {
      type: 'source-loaded',
      operationId: null,
      text: 'başka metin',
      binding: { ...selectionBinding, loadedText: 'başka metin', composerRevision: 7 },
    });

    expect(capabilities(changed).previewIsStale).toBe(true);
    expect(validateApply(changed)).toMatchObject({ ok: false, error: { code: 'PREVIEW_STALE' } });
  });

  it('iptal edilen işlemin sonucu sonradan gelse de etkinleşmez', () => {
    const loaded = reduceAll(newSession(), [{ type: 'form-changed', changes: { sourceText: 'metin' } }]);
    const action = prepareFrom(loaded);
    const prepared = reduceSession(loaded, { type: 'action-prepared', action });
    const cancelled = reduceSession(prepared, { type: 'form-changed', changes: { tone: 'formal' } });

    const late = reduceSession(cancelled, {
      type: 'result-received',
      candidate: {
        requestId: action.requestId,
        sessionId: 's1',
        formRevision: action.formRevision,
        text: 'x',
        sample: true,
      },
    });

    expect(late.preview).toBeNull();
    expect(late.phase.status).toBe('editing');
  });

  it('önizlemeyi elle düzenlemek kaynağı korur, yalnızca önizleme sürümünü artırır', () => {
    const state = sessionWithPreview();
    const edited = reduceSession(state, { type: 'preview-edited', text: 'Toplantıyı yarın yapalım.' });

    expect(edited.preview?.previewRevision).toBe(2);
    expect(edited.form.sourceText).toBe(state.form.sourceText);
    expect(edited.formRevision).toBe(state.formRevision);
  });

  it('kaynak değişince önizleme eskir: kopyalanabilir ama uygulanamaz', () => {
    const state = reduceSession(sessionWithPreview(), {
      type: 'form-changed',
      changes: { sourceText: 'yeni kaynak' },
    });
    const caps = capabilities(state);

    expect(caps.previewIsStale).toBe(true);
    expect(caps.canCopy).toBe(true);
    expect(caps.applyBlocker?.code).toBe('PREVIEW_STALE');
  });
});

describe('reduceSession — dış değişiklikler', () => {
  it('kullanıcı taslağı değiştirirse hedef geçersiz olur', () => {
    const state = reduceSession(sessionWithPreview(), {
      type: 'mail-event',
      event: { type: 'composer-changed', ref: composerRef, revision: 6 },
    });

    expect(state.staleReason).toBe('composer-changed');
    expect(capabilities(state).applyBlocker?.code).toBe('TARGET_CHANGED');
  });

  it('aktif konuşma değişince eski çalışmanın yazma düğmesi kapanır, metin korunur', () => {
    const state = reduceSession(sessionWithPreview(), {
      type: 'mail-event',
      event: { type: 'active-thread-changed', previous: threadA, current: threadB },
    });

    expect(capabilities(state).applyBlocker?.code).toBe('THREAD_CHANGED');
    expect(state.preview?.text).toBe('Toplantıyı yarın yapabiliriz.');
  });

  it('taslak kapanınca hedef kaybolur', () => {
    const state = reduceSession(sessionWithPreview(), {
      type: 'mail-event',
      event: { type: 'composer-removed', ref: composerRef },
    });

    expect(capabilities(state).applyBlocker?.code).toBe('TARGET_MISSING');
  });

  it('aynı taslak konuşmaya sonradan bağlanınca çalışma geçerli kalır ve yeni kimlikle uygulanır', () => {
    const rebound = { ...composerRef, threadKey: 'thread-late' };
    const state = reduceSession(sessionWithPreview(), {
      type: 'mail-event',
      event: { type: 'composer-rebound', previous: composerRef, ref: rebound },
    });

    expect(state.staleReason).toBeNull();
    expect(capabilities(state).applyBlocker).toBeNull();
    const request = validateApply(state);
    expect(request.ok && request.value.target.composerRef).toEqual(rebound);

    // Başka bir taslağın yeniden bağlanması bu çalışmayı etkilemez.
    const other = reduceSession(sessionWithPreview(), {
      type: 'mail-event',
      event: {
        type: 'composer-rebound',
        previous: { ...composerRef, composerKey: 'c2' },
        ref: { ...composerRef, composerKey: 'c2', threadKey: 'thread-late' },
      },
    });
    const otherRequest = validateApply(other);
    expect(otherRequest.ok && otherRequest.value.target.composerRef).toEqual(composerRef);
  });

  it('hesap değişince içerik temizlenir', () => {
    const state = reduceSession(sessionWithPreview(), {
      type: 'mail-event',
      event: { type: 'account-changed' },
    });

    expect(state.preview).toBeNull();
    expect(state.form.sourceText).toBe('');
    expect(state.thread).toBeNull();
    expect(state.staleReason).toBe('account-changed');
  });

  it('konuşmaya yeni içerik gelirse bağlam yeniden okunmadan işlem hazırlanmaz', () => {
    const snapshot = meetingThread();
    const context = buildContext(
      { expectedThread: threadA, snapshot, selection: DEFAULT_CONTEXT_SELECTION, includedBlocks: [] },
      testDependencies(),
    );
    const state = reduceAll(newSession(), [
      { type: 'form-changed', changes: { operation: 'reply', instruction: 'Onayla' } },
      { type: 'read-started', operationId: 'r1', subject: 'thread' },
      { type: 'thread-read', operationId: 'r1', snapshot, context },
      { type: 'mail-event', event: { type: 'thread-content-changed', threadRef: threadA } },
    ]);

    expect(state.contextStale).toBe(true);
    expect(capabilities(state).prepareBlocker?.code).toBe('CONTEXT_STALE');
  });

  it('arka planda okunan yeni içerik, kullanıcı bir sonuç üzerinde çalışmıyorsa bağlamı yeniler', () => {
    const snapshot = meetingThread();
    const context = buildContext(
      { expectedThread: threadA, snapshot, selection: DEFAULT_CONTEXT_SELECTION, includedBlocks: [] },
      testDependencies(),
    );
    const refreshed = { ...snapshot, revision: 2 };
    const editing = reduceAll(newSession(), [
      { type: 'form-changed', changes: { operation: 'reply', instruction: 'Onayla' } },
      { type: 'read-started', operationId: 'r1', subject: 'thread' },
      { type: 'thread-read', operationId: 'r1', snapshot, context },
      { type: 'mail-event', event: { type: 'thread-content-changed', threadRef: threadA } },
      { type: 'thread-refreshed', snapshot: refreshed, context },
    ]);

    expect(editing.contextStale).toBe(false);
    expect(editing.threadSnapshot?.revision).toBe(2);
    expect(capabilities(editing).prepareBlocker).toBeNull();

    // Önizleme varken bağlam sessizce değişmez; önizleme geçerli kalır, "bağlam eskidi" uyarısı görünür.
    const read = reduceAll(newSession(), [
      { type: 'read-started', operationId: 'r1', subject: 'thread' },
      { type: 'thread-read', operationId: 'r1', snapshot, context },
      {
        type: 'source-loaded',
        operationId: null,
        text: selectionBinding.loadedText,
        binding: selectionBinding,
      },
    ]);
    const action = prepareFrom(read);
    const withPreview = reduceAll(read, [
      { type: 'action-prepared', action },
      {
        type: 'result-received',
        candidate: {
          requestId: action.requestId,
          sessionId: action.sessionId,
          formRevision: action.formRevision,
          text: 'Sonuç',
          sample: true,
        },
      },
      { type: 'mail-event', event: { type: 'thread-content-changed', threadRef: threadA } },
      { type: 'thread-refreshed', snapshot: refreshed, context },
    ]);
    expect(withPreview.phase.status).toBe('preview');
    expect(withPreview.threadSnapshot?.revision).toBe(1);
    expect(withPreview.contextStale).toBe(true);
  });

  it('kullanıcı çalışmanın konuşmasına geri dönünce "konuşma değişti" uyarısı kalkar', () => {
    const away = reduceAll(newSession(), [
      { type: 'form-changed', changes: { instruction: 'Taslak talimat' } },
      { type: 'mail-event', event: { type: 'active-thread-changed', previous: threadA, current: null } },
    ]);
    expect(away.staleReason).toBe('thread-changed');

    const back = reduceAll(away, [
      { type: 'mail-event', event: { type: 'active-thread-changed', previous: null, current: threadA } },
    ]);
    expect(back.staleReason).toBeNull();
    expect(back.form.instruction).toBe('Taslak talimat');
  });

  it('okuma sırasında konuşma değiştiyse yarım bağlam atılır, kullanıcı girdisi korunur', () => {
    const snapshot = { ...meetingThread(), ref: threadB };
    const state = reduceAll(newSession(), [
      { type: 'form-changed', changes: { instruction: 'Taslak talimat' } },
      { type: 'read-started', operationId: 'r1', subject: 'thread' },
      {
        type: 'thread-read',
        operationId: 'r1',
        snapshot,
        context: { ok: false, error: appError('THREAD_CHANGED') },
      },
    ]);

    expect(state.phase).toEqual({
      status: 'error',
      error: expect.objectContaining({ code: 'THREAD_CHANGED' }),
    });
    expect(state.threadSnapshot).toBeNull();
    expect(state.form.instruction).toBe('Taslak talimat');
  });

  it('iptal edilen okumanın sonucu geri dönmez', () => {
    const state = reduceAll(newSession(), [
      { type: 'read-started', operationId: 'r1', subject: 'thread' },
      { type: 'read-cancelled', operationId: 'r1' },
      {
        type: 'thread-read',
        operationId: 'r1',
        snapshot: meetingThread(),
        context: { ok: false, error: appError('CONTEXT_REQUIRED') },
      },
    ]);

    expect(state.threadSnapshot).toBeNull();
  });
});

describe('reduceSession — taslağa uygulama ve geri alma', () => {
  function applyOnce() {
    const state = sessionWithPreview();
    const request = validateApply(state);
    if (!request.ok) throw new Error(`uygulanamaz: ${request.error.code}`);
    const applying = reduceSession(state, {
      type: 'apply-started',
      operationId: 'w1',
      applyOperationId: request.value.applyOperationId,
    });
    return { state, request: request.value, applying };
  }

  it('seçim değişimi için hedef doğrulanır ve tek bir uygulama isteği oluşur', () => {
    const { request } = applyOnce();

    expect(request.target).toEqual({
      mode: 'replace-selection',
      composerRef,
      expectedRevision: 5,
      selectionId: 'sel-1',
    });
    expect(request.text).toBe('Toplantıyı yarın yapabiliriz.');
  });

  it('uygulama sürerken ikinci uygulama başlatılmaz', () => {
    const { applying, request } = applyOnce();
    const again = reduceSession(applying, {
      type: 'apply-started',
      operationId: 'w2',
      applyOperationId: request.applyOperationId,
    });

    expect(again).toBe(applying);
    expect(capabilities(applying).isBusy).toBe(true);
  });

  it('başarılı yazmadan sonra geri alma açılır; kullanıcı yeni yazı yazarsa kapanır', () => {
    const { applying, request } = applyOnce();
    const applied = reduceAll(applying, [
      { type: 'mail-event', event: { type: 'composer-changed', ref: composerRef, revision: 6 } },
      {
        type: 'apply-finished',
        operationId: 'w1',
        applyOperationId: request.applyOperationId,
        outcome: { status: 'applied', composerRevision: 6, undoId: 'u1' },
      },
    ]);

    expect(applied.phase.status).toBe('applied');
    expect(applied.staleReason).toBeNull();
    expect(capabilities(applied).canUndo).toBe(true);
    // Aynı önizleme aynı hedefe ikinci kez yazılamaz.
    expect(capabilities(applied).applyBlocker).not.toBeNull();

    const typed = reduceSession(applied, {
      type: 'mail-event',
      event: { type: 'composer-changed', ref: composerRef, revision: 7 },
    });
    expect(capabilities(typed).canUndo).toBe(false);
  });

  it('geri almadan sonra seçim hedefi yeniden seçim ister; gövde hedefine aynı sonuç yeniden uygulanabilir', () => {
    const undo = (state: SessionState) => {
      const request = validateApply(state);
      if (!request.ok) throw new Error(request.error.code);
      return reduceAll(state, [
        { type: 'apply-started', operationId: 'w1', applyOperationId: request.value.applyOperationId },
        {
          type: 'apply-finished',
          operationId: 'w1',
          applyOperationId: request.value.applyOperationId,
          outcome: { status: 'applied', composerRevision: 6, undoId: 'u1' },
        },
        { type: 'undo-started', operationId: 'u-op' },
        { type: 'undo-finished', operationId: 'u-op', outcome: { status: 'undone', composerRevision: 7 } },
      ]);
    };

    const selection = undo(sessionWithPreview());
    expect(capabilities(selection).applyBlocker?.code).toBe('SELECTION_INVALID');

    const body = undo(
      reduceSession(sessionWithPreview(), {
        type: 'source-loaded',
        operationId: null,
        text: selectionBinding.loadedText,
        binding: {
          kind: 'draft',
          composerRef,
          composerRevision: 5,
          loadedText: selectionBinding.loadedText,
          canReplaceBody: true,
          canInsertIntoEmptyBody: false,
        },
      }),
    );
    const again = validateApply(body);
    expect(again.ok && again.value.target).toEqual({
      mode: 'replace-body',
      composerRef,
      expectedRevision: 7,
    });
  });

  it('belirsiz yazmada aynı işlem otomatik tekrarlanmaz', () => {
    const { applying, request } = applyOnce();
    const uncertain = reduceSession(applying, {
      type: 'apply-finished',
      operationId: 'w1',
      applyOperationId: request.applyOperationId,
      outcome: { status: 'uncertain', error: appError('WRITE_UNCERTAIN') },
    });
    const dismissed = reduceSession(uncertain, { type: 'error-dismissed' });

    expect(uncertain.phase).toEqual({
      status: 'error',
      error: expect.objectContaining({ code: 'WRITE_UNCERTAIN' }),
    });
    expect(dismissed.preview?.text).toBe('Toplantıyı yarın yapabiliriz.');
    expect(validateApply(dismissed)).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'WRITE_UNCERTAIN' }),
    });
  });

  it('önizleme kaynağın aynısıysa gereksiz yazma yapılmaz', () => {
    const state = sessionWithPreview(selectionBinding.loadedText);

    expect(validateApply(state)).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'RESULT_UNCHANGED' }),
    });
  });

  it('panelde yazılan metin açık taslağa otomatik yazma yetkisi vermez', () => {
    const loaded = reduceAll(newSession(), [
      { type: 'form-changed', changes: { sourceText: 'panel metni' } },
    ]);
    const action = prepareFrom(loaded);
    const state = reduceAll(loaded, [
      { type: 'action-prepared', action },
      {
        type: 'result-received',
        candidate: {
          requestId: action.requestId,
          sessionId: 's1',
          formRevision: action.formRevision,
          text: 'Panel metni.',
          sample: true,
        },
      },
    ]);

    expect(capabilities(state).applyTarget).toBeNull();
    expect(capabilities(state).applyBlocker?.code).toBe('TARGET_MISSING');
  });
});
