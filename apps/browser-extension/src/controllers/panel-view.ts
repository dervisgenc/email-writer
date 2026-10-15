import {
  isInstructionOperation,
  isSameComposer,
  isSameScope,
  isSameThread,
  type ComposerRef,
  type ErrorCode,
  type ErrorField,
  type MessageSnapshot,
  type PageState,
} from '@email-writer/contracts';
import {
  describeContext,
  isRelatedEntry,
  normalizeContextText,
  type HistoryEntry,
  type SessionCapabilities,
  type SessionState,
  type StaleReason,
} from '@email-writer/core';
import type {
  ApplyView,
  ContextMessageView,
  ContextView,
  PanelView,
  SourceReloadKind,
  StatusView,
  TargetView,
} from '@email-writer/ui';

const PREVIEW_LENGTH = 160;
const RETRYABLE: readonly ErrorCode[] = [
  'READ_TIMEOUT',
  'PAGE_NOT_READY',
  'THREAD_CHANGED',
  'AI_NETWORK',
  'AI_UNAVAILABLE',
  'AI_RESPONSE_INCOMPLETE',
];

const STALE_NOTICES: Record<StaleReason, ErrorCode> = {
  'composer-changed': 'TARGET_CHANGED',
  'composer-removed': 'TARGET_MISSING',
  'selection-invalid': 'SELECTION_INVALID',
  'thread-changed': 'THREAD_CHANGED',
  'account-changed': 'ACCOUNT_CHANGED',
};

/** Panel köprüsünün tuttuğu, iş kuralı olmayan geçici arayüz durumu. */
export interface TransientUiState {
  readonly pendingReplace: SourceReloadKind | null;
  readonly replyReplaceComposer: ComposerRef | null;
  readonly notice:
    | { readonly kind: 'success'; readonly message: 'copied' | 'undone' }
    | { readonly kind: 'error'; readonly code: ErrorCode }
    | null;
}

export interface PanelViewInput {
  readonly state: SessionState;
  readonly capabilities: SessionCapabilities;
  readonly page: PageState;
  readonly ui: TransientUiState;
  /** Sayfa oturumunda okunan mesajlar. */
  readonly history: readonly HistoryEntry[];
}

function shorten(text: string): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  return singleLine.length > PREVIEW_LENGTH ? `${singleLine.slice(0, PREVIEW_LENGTH)}…` : singleLine;
}

/** Oturumun çalışabileceği taslak: kaynak veya hedef kaydı, yoksa konuşmanın tek açık taslağı. */
export function sessionComposer(state: SessionState, page: PageState): ComposerRef | null {
  const { binding } = state;
  if (binding.kind === 'draft' || binding.kind === 'draft-selection') {
    return binding.composerRef;
  }
  if (state.explicitTarget !== null) {
    return state.explicitTarget.composerRef;
  }
  const thread = state.thread;
  const candidates = page.composers.filter((composer) =>
    thread === null
      ? composer.threadKey === null
      : composer.threadKey !== null &&
        isSameThread(thread, { scope: composer.scope, threadKey: composer.threadKey }),
  );
  // Birden fazla aday varsa kullanıcı taslağın yanındaki düğmeyle seçer; ilk editör seçilmez.
  return candidates.length === 1 ? (candidates[0] ?? null) : null;
}

function targetView(state: SessionState, capabilities: SessionCapabilities): TargetView {
  if (state.binding.kind === 'received-message') {
    return { kind: 'received-message' };
  }
  const target = capabilities.applyTarget;
  return target === null
    ? { kind: 'none' }
    : { kind: 'composer', isReply: target.composerRef.threadKey !== null };
}

function messageText(message: MessageSnapshot): string {
  return normalizeContextText(message.blocks.map((block) => block.text).join('\n\n'));
}

interface ListedMessage {
  readonly message: MessageSnapshot;
  readonly subject: string | null;
  readonly group: ContextMessageView['group'];
  readonly order: number;
}

/**
 * Bağlam denetleyicisinde listelenecek mesajlar: açık konuşmanın son okuması
 * ve oturumda okunan diğer mesajlar (aynı hesap). Açık konuşma grubunda
 * okunma sırası, diğer grupta en son okunan önce gelir.
 */
function listedMessages(state: SessionState, history: readonly HistoryEntry[]): ListedMessage[] {
  const snapshot = state.threadSnapshot;
  if (snapshot === null) {
    return [];
  }
  const historyOrder = new Map(history.map((entry) => [entry.message.messageKey, entry.order]));
  const afterHistory = Math.max(-1, ...historyOrder.values()) + 1;
  const current = new Set(snapshot.messages.map((message) => message.messageKey));
  const listed: ListedMessage[] = [
    ...snapshot.messages.map((message) => ({
      message,
      subject: snapshot.subject,
      group: 'current' as const,
      order: historyOrder.get(message.messageKey) ?? afterHistory + message.displayOrder,
    })),
    ...history
      .filter(
        (entry) =>
          !current.has(entry.message.messageKey) && isSameScope(entry.threadRef.scope, snapshot.ref.scope),
      )
      .map((entry) => ({
        message: entry.message,
        subject: entry.subject,
        group: isRelatedEntry(entry, snapshot.ref, snapshot.subject)
          ? ('current' as const)
          : ('other' as const),
        order: entry.order,
      })),
  ];
  return listed.sort((a, b) =>
    a.group === b.group
      ? a.group === 'current'
        ? a.order - b.order
        : b.order - a.order
      : a.group === 'current'
        ? -1
        : 1,
  );
}

function contextView(
  state: SessionState,
  capabilities: SessionCapabilities,
  history: readonly HistoryEntry[],
  fieldError: ErrorCode | null,
): ContextView {
  const { threadSnapshot: snapshot, context, phase } = state;
  const isReading = phase.status === 'reading' && phase.subject === 'thread';
  const status: ContextView['status'] = isReading
    ? 'reading'
    : snapshot === null
      ? 'not-loaded'
      : state.contextStale
        ? 'stale'
        : state.contextError !== null
          ? 'error'
          : 'ready';

  const included = new Map(context?.messages.map((message) => [message.messageKey, message]) ?? []);
  const edits = new Map(state.form.contextEdits.map((edit) => [edit.messageKey, edit.text]));
  const isReply = state.form.operation === 'reply';
  const needsReplyTarget = isReply && snapshot !== null && snapshot.activeMessageKey === null;
  const replyTargetKey = snapshot?.activeMessageKey ?? state.form.replyTargetKey;
  const messages: ContextMessageView[] = listedMessages(state, history).map(({ message, subject, group }) => {
    const inContext = included.get(message.messageKey);
    const edited = edits.get(message.messageKey);
    const text =
      inContext?.text ?? (edited === undefined ? messageText(message) : normalizeContextText(edited).trim());
    return {
      messageKey: message.messageKey,
      senderLabel: message.senderLabel,
      sentAtText: message.sentAtText,
      subject,
      group,
      preview: shorten(text),
      text,
      included: inContext !== undefined,
      edited: edited !== undefined,
      locked: isReply && message.messageKey === replyTargetKey,
      isReplyTarget: message.messageKey === replyTargetKey,
      omittedBlocks: (context?.omissions ?? []).flatMap((omission) => {
        const block =
          omission.messageKey === message.messageKey && omission.blockIndex !== undefined
            ? message.blocks[omission.blockIndex]
            : undefined;
        return block !== undefined && (block.kind === 'signature' || block.kind === 'quote')
          ? [{ blockIndex: omission.blockIndex ?? 0, kind: block.kind, text: shorten(block.text) }]
          : [];
      }),
    };
  });

  return {
    status,
    required: capabilities.usesContext,
    needsReplyTarget,
    notices: context === null ? [] : describeContext(context),
    messages,
    errorCode: state.contextError?.code ?? fieldError,
  };
}

function statusView(state: SessionState, ui: TransientUiState): StatusView {
  const { phase } = state;
  switch (phase.status) {
    case 'reading':
      return { kind: 'busy', activity: 'reading' };
    case 'prepared':
      return { kind: 'busy', activity: 'preparing' };
    case 'applying':
      return { kind: 'busy', activity: phase.kind === 'undo' ? 'undoing' : 'applying' };
    case 'error':
      return { kind: 'error', code: phase.error.code, canRetry: RETRYABLE.includes(phase.error.code) };
    case 'applied':
      return { kind: 'success', message: 'applied' };
    default:
      break;
  }
  if (ui.notice !== null) {
    return ui.notice.kind === 'success'
      ? { kind: 'success', message: ui.notice.message }
      : { kind: 'error', code: ui.notice.code, canRetry: false };
  }
  const unassigned = state.fieldErrors.find((error) => error.field === undefined);
  return unassigned === undefined ? { kind: 'none' } : { kind: 'info', code: unassigned.code };
}

function applyView(input: PanelViewInput, composer: ComposerRef | null): ApplyView {
  const { state, capabilities, ui } = input;
  const { binding } = state;
  // Talimattan yazılan metin (yanıt veya yeni e-posta) dolu taslağın yerine ancak onayla geçer.
  const isReply = isInstructionOperation(state.form.operation);
  const draftNeedsConfirmation =
    binding.kind === 'draft' &&
    isReply &&
    state.explicitTarget === null &&
    binding.loadedText.trim() !== '' &&
    binding.canReplaceBody;

  return {
    mode: capabilities.applyTarget?.mode ?? null,
    canApply: !capabilities.isBusy && capabilities.applyBlocker === null,
    blocker: capabilities.applyBlocker?.code ?? null,
    canCopy: capabilities.canCopy,
    canUndo: capabilities.canUndo,
    isApplying: state.phase.status === 'applying',
    canReplaceExistingReply:
      draftNeedsConfirmation ||
      (ui.replyReplaceComposer !== null &&
        composer !== null &&
        isSameComposer(ui.replyReplaceComposer, composer)),
    canUseOpenComposer:
      isReply &&
      capabilities.applyTarget === null &&
      binding.kind === 'panel' &&
      composer !== null &&
      ui.replyReplaceComposer === null,
  };
}

/**
 * Kullanıcı başka bir işleme geçtiyse eski işlemin eskimiş sonucu gösterilmez
 * (ör. karttaki düzeltme sonucu, yanıt hazırlarken panelde kalmaz). Aynı
 * işlemin eskimiş sonucu ise "kaynak değişti" uyarısıyla kopyalanabilir kalır.
 */
function isOtherOperationsPreview(state: SessionState, capabilities: SessionCapabilities): boolean {
  return (
    capabilities.previewIsStale && state.action !== null && state.action.operation !== state.form.operation
  );
}

/**
 * Oturum durumundan panelin görünüm verisini üretir. Saf bir fonksiyondur;
 * düğmelerin etkinliği yeniden hesaplanmaz, yetenekler `core`dan gelir.
 */
export function toPanelView(input: PanelViewInput): PanelView {
  const { state, capabilities, page, ui, history } = input;
  const { form, binding, phase } = state;
  const composer = sessionComposer(state, page);
  const fieldErrors: Partial<Record<ErrorField, ErrorCode>> = {};
  for (const error of state.fieldErrors) {
    if (error.field !== undefined && fieldErrors[error.field] === undefined) {
      fieldErrors[error.field] = error.code;
    }
  }

  return {
    operation: form.operation,
    // Yanıt taslağı veya konuşma varsa konuşmaya yanıt; yeni iletide veya hiçbirinde yeni e-posta.
    writeOperation:
      composer !== null
        ? composer.threadKey === null
          ? 'compose'
          : 'reply'
        : state.thread === null
          ? 'compose'
          : 'reply',
    target: targetView(state, capabilities),
    source: {
      origin: binding.kind,
      text: form.sourceText,
      instruction: form.instruction,
      edited: capabilities.sourceEdited,
      pendingReplace: ui.pendingReplace,
      canLoadDraft: composer !== null,
      canLoadSelection: composer !== null && !isInstructionOperation(form.operation),
      canLoadReceivedSelection: state.thread !== null && form.operation === 'translate',
      isReading: phase.status === 'reading',
    },
    options: {
      targetLanguage: form.targetLanguage,
      tone: form.tone,
      showTargetLanguage: form.operation !== 'revise',
      showTone: form.operation !== 'translate',
      useConversation: form.useConversation,
      showUseConversation: !isInstructionOperation(form.operation) && state.thread !== null,
    },
    context: contextView(state, capabilities, history, fieldErrors.context ?? null),
    fieldErrors,
    prepare: {
      canPrepare: !capabilities.isBusy && capabilities.prepareBlocker === null,
      blocker: capabilities.prepareBlocker?.code ?? null,
      isPreparing: phase.status === 'prepared',
    },
    preview:
      state.preview === null || isOtherOperationsPreview(state, capabilities)
        ? null
        : {
            text: state.preview.text,
            sample: state.preview.sample,
            stale: capabilities.previewIsStale,
            unchanged: state.preview.text === form.sourceText,
          },
    apply: applyView(input, composer),
    status: statusView(state, ui),
    staleNotice: state.staleReason === null ? null : STALE_NOTICES[state.staleReason],
  };
}
