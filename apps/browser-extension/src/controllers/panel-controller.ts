import {
  isSameThread,
  type ComposerRef,
  type MailConnector,
  type MailEvent,
  type Operation,
  type Settings,
  type ThreadRef,
} from '@email-writer/contracts';
import {
  createSession,
  usesConversationContext,
  type IdGenerator,
  type SessionState,
} from '@email-writer/core';

import type { ActionController } from './action-controller';
import type { SessionStore } from './session-store';

export type OpenRequest =
  | { readonly origin: 'toolbar' }
  | { readonly origin: 'thread-launcher'; readonly thread: ThreadRef }
  | {
      readonly origin: 'composer-launcher';
      readonly composer: ComposerRef;
      readonly quickAction: 'revise' | 'translate' | null;
    };

export interface PanelControllerDependencies {
  readonly store: SessionStore;
  readonly connector: MailConnector;
  readonly actions: ActionController;
  readonly ids: IdGenerator;
  readonly settings: () => Settings;
}

export interface PanelController {
  isOpen(): boolean;
  open(request: OpenRequest): void;
  close(): void;
  /** "Bu konuşmayla yeni çalışma başlat": açık konuşmaya bağlı yeni oturum. */
  startNewWork(): void;
  changeOperation(operation: Operation): void;
  setUseConversation(enabled: boolean): void;
  onVisibilityChange(listener: (open: boolean) => void): () => void;
  dispose(): void;
}

/** Oturumda kullanıcıya ait bir içerik var mı? Varsa sessizce silinmez. */
export function hasUserWork(state: SessionState): boolean {
  return (
    state.form.sourceText.trim() !== '' ||
    state.form.instruction.trim() !== '' ||
    state.preview !== null ||
    state.binding.kind !== 'panel'
  );
}

function threadOfComposer(composer: ComposerRef): ThreadRef | null {
  return composer.threadKey === null ? null : { scope: composer.scope, threadKey: composer.threadKey };
}

function isSameOptionalThread(a: ThreadRef | null, b: ThreadRef | null): boolean {
  return a === null || b === null ? a === b : isSameThread(a, b);
}

/**
 * Panelin açılmasını, hedef seçimini ve sayfa olaylarını koordine eder. Panel
 * yalnızca kullanıcı bir düğmeye bastığında açılır; e-posta açmak tek başına
 * okuma veya işlem başlatmaz.
 */
export function createPanelController(deps: PanelControllerDependencies): PanelController {
  const { store, connector, actions, ids } = deps;
  let open = false;
  const listeners = new Set<(open: boolean) => void>();

  const setOpen = (value: boolean) => {
    if (open !== value) {
      open = value;
      for (const listener of listeners) {
        listener(open);
      }
    }
  };

  const freshSession = (thread: ThreadRef | null, operation: Operation) => {
    const settings = deps.settings();
    store.replace(
      createSession({
        sessionId: ids.next(),
        thread,
        operation,
        defaults: { targetLanguage: settings.targetLanguage, tone: settings.tone },
      }),
    );
  };

  /** Kullanıcı istediğinde (yanıt veya "konuşmayı da kullan") konuşmayı okur. */
  const readThreadIfNeeded = () => {
    const state = store.getState();
    if (state.thread !== null && state.threadSnapshot === null && usesConversationContext(state)) {
      void actions.readThread();
    }
  };

  /** Mevcut çalışma başka bir konuşmaya aitse ve içerik varsa korunur. */
  const prepareSessionFor = (thread: ThreadRef | null, operation: Operation): boolean => {
    const state = store.getState();
    if (isSameOptionalThread(state.thread, thread) && state.staleReason !== 'account-changed') {
      return true;
    }
    if (hasUserWork(state)) {
      return false;
    }
    freshSession(thread, operation);
    return true;
  };

  const unsubscribe = connector.subscribe((event: MailEvent) => {
    if (event.type === 'account-changed') {
      actions.cancelPending();
    }
    store.dispatch({ type: 'mail-event', event });
  });

  return {
    isOpen: () => open,

    open(request) {
      switch (request.origin) {
        case 'toolbar': {
          const { activeThread } = connector.getPageState();
          const state = store.getState();
          if (state.phase.status === 'idle' && !hasUserWork(state)) {
            freshSession(activeThread, state.form.operation);
          }
          break;
        }
        case 'thread-launcher':
          if (prepareSessionFor(request.thread, 'reply')) {
            store.dispatch({ type: 'form-changed', changes: { operation: 'reply' } });
          }
          break;
        case 'composer-launcher': {
          const operation = request.quickAction ?? store.getState().form.operation;
          if (prepareSessionFor(threadOfComposer(request.composer), operation)) {
            if (request.quickAction !== null) {
              store.dispatch({ type: 'form-changed', changes: { operation: request.quickAction } });
            }
            // Seçim, odak panele geçmeden ve ilk beklemeden önce yakalanır.
            void actions.loadFromComposer(request.composer);
          }
          break;
        }
      }
      setOpen(true);
      readThreadIfNeeded();
    },

    close() {
      // Form verisi bellekte kalır; yalnızca devam eden okuma ve bekleme iptal edilir.
      actions.cancelPending();
      setOpen(false);
    },

    startNewWork() {
      actions.cancelPending();
      const { activeThread } = connector.getPageState();
      freshSession(activeThread, store.getState().form.operation);
      readThreadIfNeeded();
    },

    changeOperation(operation) {
      store.dispatch({ type: 'form-changed', changes: { operation } });
      readThreadIfNeeded();
    },

    setUseConversation(enabled) {
      store.dispatch({ type: 'form-changed', changes: { useConversation: enabled } });
      readThreadIfNeeded();
    },

    onVisibilityChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      unsubscribe();
      listeners.clear();
    },
  };
}
