import {
  appError,
  isSameThread,
  type AppError,
  type BlockRef,
  type ComposerRef,
  type MailConnector,
  type TextProcessor,
  type ThreadSnapshot,
} from '@email-writer/contracts';
import {
  buildContext,
  deriveCapabilities,
  effectiveApplyTarget,
  isSessionBusy,
  prepareAction,
  withMessageEdit,
  withMessageInclusion,
  type Clock,
  type ContextPolicy,
  type IdGenerator,
  type SessionState,
  type SourceBinding,
} from '@email-writer/core';

import type { MessageHistoryStore } from './message-history';
import type { SessionStore } from './session-store';

export type SourceKind = 'draft' | 'selection' | 'received-message';

export type LoadSourceResult = 'loaded' | 'nothing-selected' | 'failed' | 'busy';

export interface ActionControllerDependencies {
  readonly store: SessionStore;
  readonly connector: MailConnector;
  /** Bu aşamanın normal derlemesinde metin işleme bağlantısı yoktur (`null`). */
  readonly processor: TextProcessor | null;
  /** Sayfa oturumunda okunan mesajlar; ilgili olanlar varsayılan olarak bağlama girer. */
  readonly history: MessageHistoryStore;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly policy?: ContextPolicy;
  /** Sayfa okuma zaman aşımı; ölçülmüş servis süresi değil, başlangıç ayarıdır. */
  readonly readTimeoutMs?: number;
}

export interface ActionController {
  readThread(): Promise<void>;
  rebuildContext(): void;
  /**
   * Kullanıcı yeni bir mesaj açtı ve arka planda okundu. Bağlam kullanılıyorsa
   * ve kullanıcı bir sonuç üzerinde çalışmıyorsa bağlam güncellenir.
   */
  threadCaptured(snapshot: ThreadSnapshot): void;
  setMessageIncluded(messageKey: string, included: boolean): void;
  /** Bağlamdaki mesaj metnini düzenler; `null` orijinal metne döner. */
  setMessageText(messageKey: string, text: string | null): void;
  includeBlock(block: BlockRef): void;
  /** Aktif mesaj tanınamadığında kullanıcının seçtiği yanıt hedefi. */
  setReplyTarget(messageKey: string): void;
  loadSource(kind: SourceKind, composer: ComposerRef | null): Promise<LoadSourceResult>;
  /** Hızlı işlemde önce geçerli seçim, yoksa güvenle ayrılmış taslak gövdesi alınır. */
  loadFromComposer(composer: ComposerRef): Promise<LoadSourceResult>;
  prepare(): Promise<void>;
  /** Devam eden okuma ve sonuç beklemesini iptal eder; tamamlanmış girdi korunur. */
  cancelPending(): void;
  dispose(): void;
}

interface PendingWork {
  readonly operationId: string;
  readonly abort: AbortController;
  readonly kind: 'read' | 'process';
}

export function createActionController(deps: ActionControllerDependencies): ActionController {
  const { store, connector, ids, clock } = deps;
  const readTimeoutMs = deps.readTimeoutMs ?? 3_000;
  const pending = new Map<string, PendingWork>();

  const begin = (kind: PendingWork['kind'], operationId = ids.next()): PendingWork => {
    const work = { operationId, abort: new AbortController(), kind };
    pending.set(operationId, work);
    return work;
  };
  const finish = (work: PendingWork) => pending.delete(work.operationId);

  // Form değişince bekleyen sonuç geçersiz olur; işlem iptal edilir.
  const unsubscribe = store.subscribe((state) => {
    for (const work of pending.values()) {
      if (
        work.kind === 'process' &&
        (state.phase.status !== 'prepared' || state.phase.requestId !== work.operationId)
      ) {
        work.abort.abort();
        finish(work);
      }
    }
  });

  const contextFor = (state: SessionState, snapshot = state.threadSnapshot) => {
    if (state.thread === null || snapshot === null) {
      return null;
    }
    return buildContext(
      {
        expectedThread: state.thread,
        snapshot,
        history: deps.history.entries(),
        selection: state.form.contextSelection,
        includedBlocks: state.form.includedBlocks,
        edits: state.form.contextEdits,
        replyTargetKey: state.form.replyTargetKey,
        ...(deps.policy ? { policy: deps.policy } : {}),
      },
      { clock, ids },
    );
  };

  /** Bağlam yalnızca kullanıcı bir sonuç üzerinde çalışmıyorsa sessizce güncellenir. */
  const canRefreshQuietly = (state: SessionState) =>
    state.threadSnapshot !== null && (state.phase.status === 'idle' || state.phase.status === 'editing');

  const rebuildContext = () => {
    const context = contextFor(store.getState());
    if (context !== null) {
      store.dispatch({ type: 'context-built', context });
    }
  };

  const readSource = async (
    operation: () => Promise<{ text: string; binding: SourceBinding } | 'nothing-selected' | AppError>,
  ): Promise<LoadSourceResult> => {
    if (isSessionBusy(store.getState())) {
      return 'busy';
    }
    const work = begin('read');
    store.dispatch({ type: 'read-started', operationId: work.operationId, subject: 'source' });
    const outcome = await operation();
    finish(work);
    if (outcome === 'nothing-selected') {
      store.dispatch({ type: 'read-cancelled', operationId: work.operationId });
      return 'nothing-selected';
    }
    if ('code' in outcome) {
      store.dispatch({ type: 'read-failed', operationId: work.operationId, error: outcome });
      return 'failed';
    }
    store.dispatch({ type: 'source-loaded', operationId: work.operationId, ...outcome });
    return 'loaded';
  };

  const readDraft = async (composer: ComposerRef) => {
    const result = await connector.readComposer(composer);
    if (!result.ok) {
      return result.error;
    }
    const snapshot = result.value;
    return {
      text: snapshot.editableText,
      binding: {
        kind: 'draft',
        composerRef: snapshot.ref,
        composerRevision: snapshot.revision,
        loadedText: snapshot.editableText,
        canReplaceBody: snapshot.canReplaceBody,
        canInsertIntoEmptyBody: snapshot.canInsertIntoEmptyBody,
      } satisfies SourceBinding,
    };
  };

  const readSelection = async (composer: ComposerRef) => {
    const result = await connector.captureDraftSelection(composer);
    if (!result.ok) {
      return result.error;
    }
    if (result.value === null) {
      return 'nothing-selected' as const;
    }
    const selection = result.value;
    return {
      text: selection.text,
      binding: {
        kind: 'draft-selection',
        composerRef: selection.composerRef,
        composerRevision: selection.composerRevision,
        selectionId: selection.selectionId,
        loadedText: selection.text,
      } satisfies SourceBinding,
    };
  };

  const readReceivedSelection = async () => {
    const thread = store.getState().thread;
    if (thread === null) {
      return appError('CONTEXT_REQUIRED');
    }
    const result = await connector.readSelectedMessageText(thread);
    if (!result.ok) {
      return result.error;
    }
    if (result.value === null) {
      return 'nothing-selected' as const;
    }
    const selection = result.value;
    return {
      text: selection.text,
      binding: {
        kind: 'received-message',
        threadRef: selection.threadRef,
        messageKey: selection.messageKey,
        loadedText: selection.text,
      } satisfies SourceBinding,
    };
  };

  return {
    async readThread() {
      const state = store.getState();
      const thread = state.thread;
      if (thread === null || isSessionBusy(state)) {
        return;
      }
      const work = begin('read');
      store.dispatch({ type: 'read-started', operationId: work.operationId, subject: 'thread' });
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        work.abort.abort();
      }, readTimeoutMs);
      const result = await connector.readThread(thread, work.abort.signal);
      clearTimeout(timer);
      finish(work);

      if (!result.ok) {
        const error = timedOut ? appError('READ_TIMEOUT') : result.error;
        if (error.code === 'READ_CANCELLED') {
          store.dispatch({ type: 'read-cancelled', operationId: work.operationId });
        } else {
          store.dispatch({ type: 'read-failed', operationId: work.operationId, error });
        }
        return;
      }
      const snapshot = result.value;
      deps.history.record(snapshot);
      const current = store.getState();
      const context = contextFor({ ...current, thread: current.thread ?? thread }, snapshot);
      if (context !== null) {
        store.dispatch({ type: 'thread-read', operationId: work.operationId, snapshot, context });
      }
    },

    rebuildContext,

    threadCaptured(snapshot) {
      const state = store.getState();
      if (!canRefreshQuietly(state) || state.thread === null) {
        return;
      }
      if (isSameThread(state.thread, snapshot.ref)) {
        const context = contextFor(state, snapshot);
        if (context !== null) {
          store.dispatch({ type: 'thread-refreshed', snapshot, context });
        }
      } else {
        // Başka bir konuşma okundu; aynı konudaysa bağlama varsayılan olarak girer.
        rebuildContext();
      }
    },

    setMessageIncluded(messageKey, included) {
      const contextSelection = withMessageInclusion(
        store.getState().form.contextSelection,
        messageKey,
        included,
      );
      store.dispatch({ type: 'form-changed', changes: { contextSelection } });
      rebuildContext();
    },

    setMessageText(messageKey, text) {
      const contextEdits = withMessageEdit(store.getState().form.contextEdits, messageKey, text);
      store.dispatch({ type: 'form-changed', changes: { contextEdits } });
      rebuildContext();
    },

    includeBlock(block) {
      const state = store.getState();
      store.dispatch({
        type: 'form-changed',
        changes: { includedBlocks: [...state.form.includedBlocks, block] },
      });
      rebuildContext();
    },

    setReplyTarget(messageKey) {
      store.dispatch({ type: 'form-changed', changes: { replyTargetKey: messageKey } });
      rebuildContext();
    },

    loadSource(kind, composer) {
      switch (kind) {
        case 'draft':
          return composer === null ? Promise.resolve('failed') : readSource(() => readDraft(composer));
        case 'selection':
          return composer === null ? Promise.resolve('failed') : readSource(() => readSelection(composer));
        case 'received-message':
          return readSource(readReceivedSelection);
      }
    },

    async loadFromComposer(composer) {
      const fromSelection = await readSource(() => readSelection(composer));
      return fromSelection === 'nothing-selected' ? readSource(() => readDraft(composer)) : fromSelection;
    },

    async prepare() {
      const state = store.getState();
      const capabilities = deriveCapabilities(state, { processingAvailable: deps.processor !== null });
      if (capabilities.isBusy || capabilities.prepareBlocker !== null || deps.processor === null) {
        return;
      }
      if (capabilities.usesContext && state.context === null) {
        store.dispatch({
          type: 'action-rejected',
          errors: [appError('CONTEXT_REQUIRED', { field: 'context' })],
        });
        return;
      }

      const prepared = prepareAction(
        {
          sessionId: state.sessionId,
          formRevision: state.formRevision,
          draft: {
            operation: state.form.operation,
            source: { origin: state.binding.kind, text: state.form.sourceText },
            instruction: state.form.instruction,
            targetLanguage: state.form.targetLanguage,
            tone: state.form.tone,
            context: capabilities.usesContext ? state.context : null,
            target: effectiveApplyTarget(state),
          },
        },
        { clock, ids },
      );
      if (!prepared.ok) {
        store.dispatch({ type: 'action-rejected', errors: prepared.error });
        return;
      }

      const action = prepared.value;
      const work = begin('process', action.requestId);
      store.dispatch({ type: 'action-prepared', action });
      const outcome = await deps.processor.process(action, work.abort.signal);
      if (work.abort.signal.aborted) {
        return;
      }
      finish(work);
      store.dispatch(
        outcome.ok
          ? { type: 'result-received', candidate: outcome.value }
          : { type: 'processing-failed', requestId: action.requestId, error: outcome.error },
      );
    },

    cancelPending() {
      for (const work of pending.values()) {
        work.abort.abort();
        if (work.kind === 'read') {
          store.dispatch({ type: 'read-cancelled', operationId: work.operationId });
        }
      }
      pending.clear();
      const state = store.getState();
      if (state.phase.status === 'prepared') {
        // Bekleyen sonuç iptal edildi; geç gelen cevap tekrar etkinleşmez.
        store.dispatch({
          type: 'processing-failed',
          requestId: state.phase.requestId,
          error: appError('READ_CANCELLED'),
        });
        store.dispatch({ type: 'error-dismissed' });
      }
    },

    dispose() {
      unsubscribe();
      for (const work of pending.values()) {
        work.abort.abort();
      }
      pending.clear();
    },
  };
}
