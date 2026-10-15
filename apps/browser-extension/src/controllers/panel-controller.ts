import {
  isInstructionOperation,
  isSameThread,
  type ComposerRef,
  type LanguageCode,
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
  | { readonly origin: 'composer-launcher'; readonly composer: ComposerRef };

/** Yazma alanındaki araç çubuğundan doğrudan başlatılan işlem. */
export type QuickAction =
  | { readonly operation: 'revise' }
  | { readonly operation: 'translate'; readonly language: LanguageCode | null }
  | { readonly operation: 'reply' }
  | { readonly operation: 'compose' };

/**
 * Oturumun gösterildiği yer. Aynı oturum sağdaki panelde veya yazma alanının
 * yanındaki küçük kartta gösterilir; ikisi aynı anda açık olmaz.
 */
export type PanelSurface =
  | { readonly kind: 'closed' }
  | { readonly kind: 'panel' }
  | { readonly kind: 'inline'; readonly composerKey: string };

export interface PanelControllerDependencies {
  readonly store: SessionStore;
  readonly connector: MailConnector;
  readonly actions: ActionController;
  readonly ids: IdGenerator;
  readonly settings: () => Settings;
}

export interface PanelController {
  isOpen(): boolean;
  surface(): PanelSurface;
  open(request: OpenRequest): void;
  /**
   * Yazma alanındaki düğmeden işlemi doğrudan başlatır ve sonucu taslağın
   * yanındaki kartta gösterir. Düzeltme ve çeviri, taslağı veya seçimi alıp
   * hemen hazırlanır; yanıt ve yeni e-posta için kart talimat bekler.
   */
  runQuickAction(composer: ComposerRef, action: QuickAction): Promise<void>;
  /** Karttaki çalışmayı sağdaki panelde sürdürür. */
  expandToPanel(): void;
  close(): void;
  changeOperation(operation: Operation): void;
  setUseConversation(enabled: boolean): void;
  onSurfaceChange(listener: (surface: PanelSurface) => void): () => void;
  dispose(): void;
}

/** Oturumda kullanıcıya ait bir içerik var mı? */
function hasUserWork(state: SessionState): boolean {
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
  let surface: PanelSurface = { kind: 'closed' };
  const listeners = new Set<(surface: PanelSurface) => void>();

  const setSurface = (next: PanelSurface) => {
    const changed =
      next.kind !== surface.kind ||
      (next.kind === 'inline' && surface.kind === 'inline' && next.composerKey !== surface.composerKey);
    if (changed) {
      surface = next;
      for (const listener of listeners) {
        listener(surface);
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

  /**
   * Kullanıcı istediğinde (yanıt veya "konuşmayı da kullan") konuşmayı okur.
   * Oturum meşgulken okuma başlamaz; bu yüzden taslak okumasından sonra çağrılır.
   */
  const readThreadIfNeeded = async () => {
    const state = store.getState();
    if (state.thread !== null && state.threadSnapshot === null && usesConversationContext(state)) {
      await actions.readThread();
    }
  };

  /**
   * Çalışma, kullanıcının o an baktığı e-postaya aittir. Başka bir e-postaya
   * geçilince oturum o e-postayla yeniden başlar; kullanıcıdan "yeni çalışma"
   * onayı istenmez. Önceki e-postanın metni ve sonucu bırakılır.
   */
  const followThread = (thread: ThreadRef | null, operation: Operation): void => {
    const state = store.getState();
    if (isSameOptionalThread(state.thread, thread) && state.staleReason !== 'account-changed') {
      return;
    }
    actions.cancelPending();
    // Yeni ileti yazma bir konuşmaya ait değildir; konuşmaya geçilince yanıt olur.
    freshSession(thread, thread !== null && operation === 'compose' ? 'reply' : operation);
  };

  /**
   * Kullanıcı başka bir e-postaya geçti mi? Oturum bir konuşmaya bağlı değilse
   * (ör. yeni ileti yazılıyor) ve içinde iş varsa, o çalışma korunur.
   */
  const isNewConversation = (current: ThreadRef): boolean => {
    const state = store.getState();
    return state.thread !== null ? !isSameThread(state.thread, current) : !hasUserWork(state);
  };

  const unsubscribe = connector.subscribe((event: MailEvent) => {
    if (event.type === 'account-changed') {
      actions.cancelPending();
    }
    if (
      event.type === 'active-thread-changed' &&
      event.current !== null &&
      isNewConversation(event.current)
    ) {
      followThread(event.current, store.getState().form.operation);
      if (surface.kind === 'inline') {
        // Kart önceki e-postanın taslağına aitti.
        setSurface({ kind: 'closed' });
      } else if (surface.kind === 'panel') {
        void readThreadIfNeeded();
      }
      return;
    }
    store.dispatch({ type: 'mail-event', event });
  });

  return {
    isOpen: () => surface.kind !== 'closed',
    surface: () => surface,

    open(request) {
      switch (request.origin) {
        case 'toolbar': {
          const { activeThread } = connector.getPageState();
          if (activeThread !== null) {
            followThread(activeThread, store.getState().form.operation);
          }
          break;
        }
        case 'thread-launcher':
          followThread(request.thread, 'reply');
          store.dispatch({ type: 'form-changed', changes: { operation: 'reply' } });
          break;
        case 'composer-launcher':
          followThread(threadOfComposer(request.composer), store.getState().form.operation);
          setSurface({ kind: 'panel' });
          // Seçim, odak panele geçmeden ve ilk beklemeden önce yakalanır.
          void actions.loadFromComposer(request.composer).then(readThreadIfNeeded);
          return;
      }
      setSurface({ kind: 'panel' });
      void readThreadIfNeeded();
    },

    async runQuickAction(composer, action) {
      followThread(threadOfComposer(composer), action.operation);
      const language = action.operation === 'translate' ? action.language : null;
      store.dispatch({
        type: 'form-changed',
        changes: { operation: action.operation, ...(language === null ? {} : { targetLanguage: language }) },
      });
      setSurface({ kind: 'inline', composerKey: composer.composerKey });
      // Seçim, odak karta geçmeden ve ilk beklemeden önce yakalanır.
      const loaded = await actions.loadFromComposer(composer);
      if (loaded !== 'loaded') {
        return;
      }
      await readThreadIfNeeded();
      // Yanıt ve yeni e-posta için kart talimat bekler; diğer işlemler hemen hazırlanır.
      if (!isInstructionOperation(action.operation)) {
        await actions.prepare();
      }
    },

    expandToPanel() {
      if (surface.kind === 'inline') {
        setSurface({ kind: 'panel' });
        void readThreadIfNeeded();
      }
    },

    close() {
      // Form verisi bellekte kalır; yalnızca devam eden okuma ve bekleme iptal edilir.
      actions.cancelPending();
      setSurface({ kind: 'closed' });
    },

    changeOperation(operation) {
      store.dispatch({ type: 'form-changed', changes: { operation } });
      void readThreadIfNeeded();
    },

    setUseConversation(enabled) {
      store.dispatch({ type: 'form-changed', changes: { useConversation: enabled } });
      void readThreadIfNeeded();
    },

    onSurfaceChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      unsubscribe();
      listeners.clear();
    },
  };
}
