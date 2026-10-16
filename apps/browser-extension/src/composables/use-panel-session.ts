import {
  REFINEMENT_INSTRUCTIONS,
  type ComposerRef,
  type MailConnector,
  type PageState,
  type RefinementKind,
  type TargetLanguage,
  type Tone,
} from '@email-writer/contracts';
import { ACTION_LIMITS, deriveCapabilities } from '@email-writer/core';
import type { SourceReloadKind } from '@email-writer/ui';
import { computed, onScopeDispose, shallowRef } from 'vue';

import type { ActionController } from '../controllers/action-controller';
import type { ApplyController } from '../controllers/apply-controller';
import type { MessageHistoryStore } from '../controllers/message-history';
import type { PanelController } from '../controllers/panel-controller';
import { sessionComposer, toPanelView, type TransientUiState } from '../controllers/panel-view';
import type { SessionStore } from '../controllers/session-store';

export interface PanelSessionDependencies {
  readonly store: SessionStore;
  readonly connector: MailConnector;
  readonly panel: PanelController;
  readonly actions: ActionController;
  readonly applier: ApplyController;
  readonly history: MessageHistoryStore;
  readonly processingAvailable: boolean;
}

const NOTICE_DURATION_MS = 4_000;

/**
 * Denetleyicilerle Vue arasındaki ince bağlantı. Yeni iş kuralı burada
 * yazılmaz: görünüm `toPanelView` ile üretilir, olaylar denetleyicilere iletilir.
 */
export function usePanelSession(deps: PanelSessionDependencies) {
  const { store, connector, panel, actions, applier, history } = deps;
  const state = shallowRef(store.getState());
  const page = shallowRef<PageState>(connector.getPageState());
  // Arka planda okunan mesajlar bağlam listesinde hemen görünsün diye.
  const historyEntries = shallowRef(history.entries());
  const ui = shallowRef<TransientUiState>({ pendingReplace: null, replyReplaceComposer: null, notice: null });
  let noticeTimer: ReturnType<typeof setTimeout> | null = null;

  const unsubscribeStore = store.subscribe((next) => {
    state.value = next;
    historyEntries.value = history.entries();
  });
  const unsubscribeHistory = history.subscribe(() => {
    historyEntries.value = history.entries();
  });
  const unsubscribeConnector = connector.subscribe((event) => {
    if (event.type === 'page-state-changed') {
      page.value = event.state;
    }
  });
  onScopeDispose(() => {
    unsubscribeStore();
    unsubscribeHistory();
    unsubscribeConnector();
    if (noticeTimer !== null) {
      clearTimeout(noticeTimer);
    }
  });

  const patchUi = (changes: Partial<TransientUiState>) => {
    ui.value = { ...ui.value, ...changes };
  };

  const showNotice = (notice: TransientUiState['notice']) => {
    patchUi({ notice });
    if (noticeTimer !== null) {
      clearTimeout(noticeTimer);
    }
    noticeTimer = setTimeout(() => patchUi({ notice: null }), NOTICE_DURATION_MS);
  };

  const capabilities = computed(() =>
    deriveCapabilities(state.value, { processingAvailable: deps.processingAvailable }),
  );

  const view = computed(() =>
    toPanelView({
      state: state.value,
      capabilities: capabilities.value,
      page: page.value,
      ui: ui.value,
      history: historyEntries.value,
    }),
  );

  const composer = (): ComposerRef | null => sessionComposer(store.getState(), page.value);

  /** Panelde düzenlenmiş metin, kaynak yeniden alınırken sessizce silinmez. */
  const reloadSource = async (kind: SourceReloadKind, confirmReplace: boolean) => {
    if (capabilities.value.sourceEdited && !confirmReplace) {
      patchUi({ pendingReplace: kind });
      return;
    }
    patchUi({ pendingReplace: null });
    const result = await actions.loadSource(kind, composer());
    if (result === 'nothing-selected') {
      showNotice({ kind: 'error', code: 'SELECTION_INVALID' });
    }
  };

  const handlers = {
    close: () => panel.close(),
    operationChange: panel.changeOperation,
    sourceChange: (text: string) => store.dispatch({ type: 'form-changed', changes: { sourceText: text } }),
    instructionChange: (text: string) =>
      store.dispatch({ type: 'form-changed', changes: { instruction: text } }),
    reloadSource,
    cancelReload: () => patchUi({ pendingReplace: null }),
    languageChange: (targetLanguage: TargetLanguage) =>
      store.dispatch({ type: 'form-changed', changes: { targetLanguage } }),
    toneChange: (tone: Tone) => store.dispatch({ type: 'form-changed', changes: { tone } }),
    useConversationChange: panel.setUseConversation,
    contextSelectionChange: actions.setMessageIncluded,
    contextTextChange: actions.setMessageText,
    blockInclude: (messageKey: string, blockIndex: number) =>
      actions.includeBlock({ messageKey, blockIndex }),
    replyTargetChange: actions.setReplyTarget,
    refreshContext: () => void actions.readThread(),
    prepare: () => void actions.prepare(),
    /** Karttaki yanıt talimatını kaydeder ve yanıtı hazırlar. */
    /** Karttaki dil satırı: dili kaydeder ve çeviriyi hazırlar. */
    translateTo: (targetLanguage: TargetLanguage) => {
      store.dispatch({ type: 'form-changed', changes: { operation: 'translate', targetLanguage } });
      void actions.prepare();
    },
    /** Hazır sonucu hazır bir yönde değiştirir (ör. tablo yap, kısalt). */
    refine: (kind: RefinementKind) => void actions.prepare({ refinement: REFINEMENT_INSTRUCTIONS[kind] }),
    /** Hazır sonucu kullanıcının yazdığı yönde değiştirir. */
    refineCustom: (instruction: string) => {
      if (instruction.trim() !== '') void actions.prepare({ refinement: instruction });
    },
    submitInstruction: (text: string) => {
      store.dispatch({ type: 'form-changed', changes: { instruction: text } });
      void actions.prepare();
    },
    expandToPanel: () => panel.expandToPanel(),
    previewChange: (text: string) => store.dispatch({ type: 'preview-edited', text }),
    apply: () => void applier.apply(),
    undo: async () => {
      await applier.undo();
      if (store.getState().lastChange === null && store.getState().phase.status !== 'error') {
        showNotice({ kind: 'success', message: 'undone' });
      }
    },
    copy: async () => {
      const result = await applier.copy();
      showNotice(
        result.ok ? { kind: 'success', message: 'copied' } : { kind: 'error', code: result.error.code },
      );
    },
    bindTarget: async (mode: 'replace-existing-reply' | 'use-open-composer') => {
      const target = ui.value.replyReplaceComposer ?? composer();
      if (target === null) {
        return;
      }
      const result = await applier.bindComposer(target, mode === 'replace-existing-reply');
      if (result.status === 'needs-replace-confirmation') {
        patchUi({ replyReplaceComposer: result.composer });
      } else {
        patchUi({ replyReplaceComposer: null });
        if (result.status === 'failed') {
          showNotice({ kind: 'error', code: result.error.code });
        }
      }
    },
    retry: () => {
      const phase = store.getState().phase;
      const retryGeneration = phase.status === 'error' && phase.error.code.startsWith('AI_');
      store.dispatch({ type: 'error-dismissed' });
      if (retryGeneration) void actions.prepare();
      else void actions.readThread();
    },
    dismiss: () => store.dispatch({ type: 'error-dismissed' }),
  };

  return {
    view,
    handlers,
    limits: { source: ACTION_LIMITS.maxSourceLength, instruction: ACTION_LIMITS.maxInstructionLength },
  };
}
