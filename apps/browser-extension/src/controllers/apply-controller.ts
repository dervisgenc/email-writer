import {
  appError,
  isSameThread,
  type AppError,
  type ApplyTarget,
  type ComposerRef,
  type MailConnector,
  type Result,
} from '@email-writer/contracts';
import { isSessionBusy, validateApply, validateUndo, type IdGenerator } from '@email-writer/core';

import type { SessionStore } from './session-store';

export interface ApplyControllerDependencies {
  readonly store: SessionStore;
  readonly connector: MailConnector;
  readonly ids: IdGenerator;
  readonly copyText: (text: string) => Promise<Result<void, AppError>>;
}

export type BindResult =
  | { readonly status: 'bound' }
  /** Taslakta yazı var: ayrı "Mevcut yanıt metnini değiştir" onayı gerekir. */
  | { readonly status: 'needs-replace-confirmation'; readonly composer: ComposerRef }
  | { readonly status: 'failed'; readonly error: AppError };

export interface ApplyController {
  apply(): Promise<void>;
  undo(): Promise<void>;
  copy(): Promise<Result<void, AppError>>;
  /** Hedefi olmayan bir yanıt önizlemesini, aynı konuşmanın açık taslağına bağlar. */
  bindComposer(composer: ComposerRef, allowReplace: boolean): Promise<BindResult>;
}

/**
 * Yazma ve geri alma kurallarını bağlantı modülüne uygulatır. DOM ayrıntılarını
 * bilmez; son doğrulamayı bağlantı modülü ayrıca yapar.
 */
export function createApplyController(deps: ApplyControllerDependencies): ApplyController {
  const { store, connector, ids } = deps;

  return {
    async apply() {
      const state = store.getState();
      if (isSessionBusy(state)) {
        return;
      }
      const request = validateApply(state);
      if (!request.ok) {
        return;
      }
      const operationId = ids.next();
      store.dispatch({
        type: 'apply-started',
        operationId,
        applyOperationId: request.value.applyOperationId,
      });
      const outcome = await connector.applyText(request.value);
      store.dispatch({
        type: 'apply-finished',
        operationId,
        applyOperationId: request.value.applyOperationId,
        outcome,
      });
    },

    async undo() {
      const state = store.getState();
      if (isSessionBusy(state)) {
        return;
      }
      const request = validateUndo(state);
      if (!request.ok) {
        return;
      }
      const operationId = ids.next();
      store.dispatch({ type: 'undo-started', operationId });
      const outcome = await connector.undoChange(request.value.undoId);
      store.dispatch({ type: 'undo-finished', operationId, outcome });
    },

    copy() {
      const preview = store.getState().preview;
      if (preview === null || preview.text.trim().length === 0) {
        return Promise.resolve({ ok: false, error: appError('RESULT_INVALID') });
      }
      return deps.copyText(preview.text);
    },

    async bindComposer(composer, allowReplace) {
      const state = store.getState();
      // Aynı konu başlığı yeterli değildir: hesap ve konuşma ilişkisi doğrulanmalı.
      if (
        state.thread === null ||
        composer.threadKey === null ||
        !isSameThread(state.thread, { scope: composer.scope, threadKey: composer.threadKey })
      ) {
        return { status: 'failed', error: appError('THREAD_CHANGED') };
      }
      const snapshot = await connector.readComposer(composer);
      if (!snapshot.ok) {
        return { status: 'failed', error: snapshot.error };
      }
      const { value } = snapshot;
      const isEmpty = value.editableText.trim().length === 0;
      let target: ApplyTarget;
      if (isEmpty && value.canInsertIntoEmptyBody) {
        target = { mode: 'insert-empty', composerRef: value.ref, expectedRevision: value.revision };
      } else if (!isEmpty && !allowReplace) {
        return { status: 'needs-replace-confirmation', composer };
      } else if (!isEmpty && value.canReplaceBody) {
        target = { mode: 'replace-body', composerRef: value.ref, expectedRevision: value.revision };
      } else {
        return { status: 'failed', error: appError('WRITE_UNSUPPORTED') };
      }
      store.dispatch({ type: 'target-bound', target });
      return { status: 'bound' };
    },
  };
}
