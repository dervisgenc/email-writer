import { appError, type AppError, type ApplyTarget } from '@email-writer/contracts';

import { effectiveApplyTarget } from '../editing/derive-apply-target';
import { validateApply } from '../editing/validate-apply';
import { validateUndo } from '../editing/validate-undo';
import { isPreviewCurrent, isSessionBusy, type SessionState } from './session-state';

/**
 * Düğmelerin etkinliği durumdan ve doğrulama kurallarından hesaplanır; ayrı
 * bir değişkende saklanmaz.
 */
export interface SessionCapabilities {
  readonly isBusy: boolean;
  readonly usesContext: boolean;
  readonly prepareBlocker: AppError | null;
  readonly applyTarget: ApplyTarget | null;
  readonly applyBlocker: AppError | null;
  readonly canUndo: boolean;
  readonly canCopy: boolean;
  readonly previewIsStale: boolean;
  readonly sourceEdited: boolean;
}

export interface CapabilityOptions {
  /** Metin işleme bağlantısı var mı? Normal derlemede bu aşamada yoktur. */
  readonly processingAvailable: boolean;
}

export function usesConversationContext(state: SessionState): boolean {
  return state.form.operation === 'reply' || state.form.useConversation;
}

function prepareBlocker(state: SessionState, options: CapabilityOptions): AppError | null {
  if (!options.processingAvailable) {
    return appError('PROCESSING_UNAVAILABLE');
  }
  if (usesConversationContext(state)) {
    if (state.contextStale) {
      return appError('CONTEXT_STALE', { field: 'context' });
    }
    if (state.contextError !== null) {
      return state.contextError;
    }
  }
  return null;
}

export function deriveCapabilities(state: SessionState, options: CapabilityOptions): SessionCapabilities {
  const isBusy = isSessionBusy(state);
  const apply = validateApply(state);
  const { binding } = state;

  return {
    isBusy,
    usesContext: usesConversationContext(state),
    prepareBlocker: isBusy ? null : prepareBlocker(state, options),
    applyTarget: effectiveApplyTarget(state),
    applyBlocker: apply.ok ? null : apply.error,
    canUndo: !isBusy && validateUndo(state).ok,
    canCopy: state.preview !== null && state.preview.text.trim().length > 0,
    previewIsStale: state.preview !== null && !isPreviewCurrent(state),
    sourceEdited: binding.kind !== 'panel' && binding.loadedText !== state.form.sourceText,
  };
}
