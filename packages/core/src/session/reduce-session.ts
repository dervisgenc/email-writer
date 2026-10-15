import {
  appError,
  isSameComposer,
  isSameThread,
  type AppError,
  type ApplyOutcome,
  type ApplyTarget,
  type ComposerRef,
  type ContextSnapshot,
  type MailEvent,
  type PreparedAction,
  type Result,
  type ThreadSnapshot,
  type UndoOutcome,
} from '@email-writer/contracts';

import { validatePreviewCandidate } from '../actions/validate-preview';
import { effectiveApplyTarget } from '../editing/derive-apply-target';
import {
  createSession,
  restingPhase,
  type SessionForm,
  type SessionState,
  type SourceBinding,
  type StaleReason,
} from './session-state';

export type SessionEvent =
  | { readonly type: 'read-started'; readonly operationId: string; readonly subject: 'thread' | 'source' }
  | { readonly type: 'read-cancelled'; readonly operationId: string }
  | { readonly type: 'read-failed'; readonly operationId: string; readonly error: AppError }
  | {
      readonly type: 'thread-read';
      readonly operationId: string;
      readonly snapshot: ThreadSnapshot;
      readonly context: Result<ContextSnapshot, AppError>;
    }
  | {
      /** Kullanıcı konuşmada başka bir mesajı açtı; arka planda okunan yeni içerik. */
      readonly type: 'thread-refreshed';
      readonly snapshot: ThreadSnapshot;
      readonly context: Result<ContextSnapshot, AppError>;
    }
  | { readonly type: 'context-built'; readonly context: Result<ContextSnapshot, AppError> }
  | {
      readonly type: 'source-loaded';
      readonly operationId: string | null;
      readonly text: string;
      readonly binding: SourceBinding;
    }
  | { readonly type: 'form-changed'; readonly changes: Partial<SessionForm> }
  | { readonly type: 'action-prepared'; readonly action: PreparedAction }
  | { readonly type: 'action-rejected'; readonly errors: readonly AppError[] }
  | { readonly type: 'result-received'; readonly candidate: unknown }
  | { readonly type: 'processing-failed'; readonly requestId: string; readonly error: AppError }
  | { readonly type: 'preview-edited'; readonly text: string }
  | { readonly type: 'target-bound'; readonly target: ApplyTarget }
  | { readonly type: 'apply-started'; readonly operationId: string; readonly applyOperationId: string }
  | {
      readonly type: 'apply-finished';
      readonly operationId: string;
      readonly applyOperationId: string;
      readonly outcome: ApplyOutcome;
    }
  | { readonly type: 'undo-started'; readonly operationId: string }
  | { readonly type: 'undo-finished'; readonly operationId: string; readonly outcome: UndoOutcome }
  | { readonly type: 'mail-event'; readonly event: MailEvent }
  | { readonly type: 'error-dismissed' };

function isPendingRead(state: SessionState, operationId: string): boolean {
  return state.phase.status === 'reading' && state.phase.operationId === operationId;
}

function isPendingWrite(state: SessionState, operationId: string, kind: 'apply' | 'undo'): boolean {
  return (
    state.phase.status === 'applying' && state.phase.operationId === operationId && state.phase.kind === kind
  );
}

function rest(state: SessionState): SessionState {
  return { ...state, phase: restingPhase(state) };
}

function withContext(state: SessionState, context: Result<ContextSnapshot, AppError>): SessionState {
  return {
    ...state,
    context: context.ok ? context.value : null,
    contextError: context.ok ? null : context.error,
  };
}

function hasFormChanges(form: SessionForm, changes: Partial<SessionForm>): boolean {
  return (Object.keys(changes) as (keyof SessionForm)[]).some((key) => form[key] !== changes[key]);
}

/** Hedef veya kaynak kaydının bağlı olduğu editör. */
function trackedComposer(state: SessionState): ComposerRef | null {
  const target = effectiveApplyTarget(state);
  if (target !== null) {
    return target.composerRef;
  }
  const { binding } = state;
  return binding.kind === 'draft' || binding.kind === 'draft-selection' ? binding.composerRef : null;
}

function markStale(state: SessionState, reason: StaleReason): SessionState {
  return { ...state, staleReason: reason };
}

function staleReasonForWriteError(error: AppError): StaleReason | null {
  switch (error.code) {
    case 'TARGET_CHANGED':
      return 'composer-changed';
    case 'TARGET_MISSING':
      return 'composer-removed';
    case 'SELECTION_INVALID':
      return 'selection-invalid';
    case 'THREAD_CHANGED':
      return 'thread-changed';
    default:
      return null;
  }
}

function reduceMailEvent(state: SessionState, event: MailEvent): SessionState {
  switch (event.type) {
    case 'account-changed':
      // Eski hesabın içerikleri ve devam eden işlemleri temizlenir.
      return createSession({
        sessionId: state.sessionId,
        thread: null,
        operation: state.form.operation,
        defaults: { targetLanguage: state.form.targetLanguage, tone: state.form.tone },
        staleReason: 'account-changed',
      });

    case 'active-thread-changed':
      if (state.thread === null) {
        return state;
      }
      if (event.current === null || !isSameThread(state.thread, event.current)) {
        return markStale(state, 'thread-changed');
      }
      // Kullanıcı çalışmanın konuşmasına geri döndü; çalışma yeniden geçerlidir.
      return state.staleReason === 'thread-changed' ? { ...state, staleReason: null } : state;

    case 'thread-content-changed':
      if (
        state.thread !== null &&
        state.threadSnapshot !== null &&
        isSameThread(state.thread, event.threadRef)
      ) {
        return { ...state, contextStale: true };
      }
      return state;

    case 'composer-removed': {
      const composer = trackedComposer(state);
      if (composer !== null && isSameComposer(composer, event.ref)) {
        return markStale(state, 'composer-removed');
      }
      return state;
    }

    case 'composer-changed': {
      const composer = trackedComposer(state);
      if (composer === null || !isSameComposer(composer, event.ref)) {
        return state;
      }
      const next = { ...state, targetComposerRevision: event.revision };
      if (state.phase.status === 'applying') {
        // Eklentinin kendi yazması; sonuç `apply-finished` ile işlenir.
        return next;
      }
      const expected = effectiveApplyTarget(state)?.expectedRevision ?? null;
      const isOwnWrite = state.lastChange?.composerRevisionAfter === event.revision;
      if (event.revision !== expected && !isOwnWrite && state.staleReason === null) {
        return markStale(next, 'composer-changed');
      }
      return next;
    }

    case 'composer-added':
    case 'page-state-changed':
      return state;
  }
}

/**
 * Oturum olaylarını saf biçimde uygular. Kimliği tutmayan veya iptal edilmiş
 * işlemlere ait geç olaylar durumu değiştirmez.
 */
export function reduceSession(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case 'read-started':
      if (state.phase.status === 'reading' || state.phase.status === 'applying') {
        return state;
      }
      return {
        ...state,
        phase: { status: 'reading', operationId: event.operationId, subject: event.subject },
      };

    case 'read-cancelled':
      return isPendingRead(state, event.operationId) ? rest(state) : state;

    case 'read-failed':
      return isPendingRead(state, event.operationId)
        ? { ...state, phase: { status: 'error', error: event.error } }
        : state;

    case 'thread-read': {
      if (!isPendingRead(state, event.operationId)) {
        return state;
      }
      if (state.thread === null || !isSameThread(state.thread, event.snapshot.ref)) {
        // Okuma sırasında konuşma değişti: yarım bağlam atılır, girdi korunur.
        return { ...state, phase: { status: 'error', error: appError('THREAD_CHANGED') } };
      }
      const next = withContext(
        {
          ...state,
          threadSnapshot: event.snapshot,
          contextStale: false,
          formRevision: state.formRevision + 1,
        },
        event.context,
      );
      return rest(next);
    }

    case 'thread-refreshed': {
      // Bağlam yalnızca kullanılıyorsa ve kullanıcı bir sonuç üzerinde
      // çalışmıyorsa sessizce yenilenir. Önizleme varken bağlam değişirse
      // önizleme eskirdi; o durumda "bağlam eskidi" uyarısı (contextStale) kalır.
      const isIdle = state.phase.status === 'idle' || state.phase.status === 'editing';
      if (
        !isIdle ||
        state.threadSnapshot === null ||
        state.thread === null ||
        !isSameThread(state.thread, event.snapshot.ref)
      ) {
        return state;
      }
      return rest(
        withContext(
          {
            ...state,
            threadSnapshot: event.snapshot,
            contextStale: false,
            formRevision: state.formRevision + 1,
          },
          event.context,
        ),
      );
    }

    case 'context-built':
      return withContext({ ...state, formRevision: state.formRevision + 1 }, event.context);

    case 'source-loaded': {
      if (event.operationId !== null && !isPendingRead(state, event.operationId)) {
        return state;
      }
      if (state.phase.status === 'applying') {
        return state;
      }
      const revision =
        event.binding.kind === 'draft' || event.binding.kind === 'draft-selection'
          ? event.binding.composerRevision
          : null;
      return rest({
        ...state,
        form: { ...state.form, sourceText: event.text },
        formRevision: state.formRevision + 1,
        binding: event.binding,
        explicitTarget: null,
        targetComposerRevision: revision,
        staleReason: state.staleReason === 'thread-changed' ? state.staleReason : null,
        fieldErrors: [],
      });
    }

    case 'form-changed': {
      if (state.phase.status === 'applying' || !hasFormChanges(state.form, event.changes)) {
        return state;
      }
      // Form değişikliği hazırlanmış işlemi ve önizlemeyi eskitir; geç gelen
      // sonuç form sürümü tutmayacağı için kabul edilmez.
      return rest({
        ...state,
        form: { ...state.form, ...event.changes },
        formRevision: state.formRevision + 1,
        fieldErrors: [],
      });
    }

    case 'action-prepared':
      if (
        event.action.sessionId !== state.sessionId ||
        event.action.formRevision !== state.formRevision ||
        state.phase.status === 'reading' ||
        state.phase.status === 'applying'
      ) {
        return state;
      }
      return {
        ...state,
        action: event.action,
        fieldErrors: [],
        phase: { status: 'prepared', requestId: event.action.requestId },
      };

    case 'action-rejected':
      return rest({ ...state, fieldErrors: event.errors });

    case 'result-received': {
      const { phase, action } = state;
      if (
        phase.status !== 'prepared' ||
        action === null ||
        phase.requestId !== action.requestId ||
        action.formRevision !== state.formRevision
      ) {
        return state;
      }
      const decision = validatePreviewCandidate(event.candidate, action);
      if (decision.status === 'ignored') {
        return state;
      }
      if (decision.status === 'rejected') {
        return { ...state, phase: { status: 'error', error: decision.error } };
      }
      const { candidate } = decision;
      return {
        ...state,
        preview: {
          requestId: candidate.requestId,
          formRevision: candidate.formRevision,
          text: candidate.text,
          previewRevision: 1,
          sample: candidate.sample,
        },
        phase: { status: 'preview' },
      };
    }

    case 'processing-failed':
      if (state.phase.status !== 'prepared' || state.phase.requestId !== event.requestId) {
        return state;
      }
      return { ...state, phase: { status: 'error', error: event.error } };

    case 'preview-edited':
      if (state.preview === null || state.phase.status === 'applying' || state.preview.text === event.text) {
        return state;
      }
      // Önizlemeyi düzenlemek yeni bir üretim değildir; yalnızca önizleme sürümü artar.
      return rest({
        ...state,
        preview: {
          ...state.preview,
          text: event.text,
          previewRevision: state.preview.previewRevision + 1,
        },
      });

    case 'target-bound':
      if (state.binding.kind === 'received-message' || state.phase.status === 'applying') {
        return state;
      }
      return {
        ...state,
        explicitTarget: event.target,
        targetComposerRevision: event.target.expectedRevision,
        staleReason: null,
      };

    case 'apply-started':
      if (state.phase.status !== 'preview') {
        return state;
      }
      return {
        ...state,
        phase: { status: 'applying', operationId: event.operationId, kind: 'apply' },
      };

    case 'apply-finished': {
      if (!isPendingWrite(state, event.operationId, 'apply') || state.preview === null) {
        return state;
      }
      const target = effectiveApplyTarget(state);
      const { outcome } = event;
      if (outcome.status === 'rejected') {
        const reason = staleReasonForWriteError(outcome.error);
        return {
          ...state,
          staleReason: reason ?? state.staleReason,
          phase: { status: 'error', error: outcome.error },
        };
      }
      if (target === null) {
        return { ...state, phase: { status: 'error', error: appError('TARGET_MISSING') } };
      }
      const base = {
        applyOperationId: event.applyOperationId,
        requestId: state.preview.requestId,
        previewRevision: state.preview.previewRevision,
        composerRef: target.composerRef,
      };
      if (outcome.status === 'uncertain') {
        // Aynı işlem otomatik tekrarlanmaz; önizleme korunur.
        return {
          ...state,
          lastChange: { ...base, outcome: 'uncertain', undoId: null, composerRevisionAfter: null },
          phase: { status: 'error', error: outcome.error },
        };
      }
      return {
        ...state,
        lastChange: {
          ...base,
          outcome: 'applied',
          undoId: outcome.undoId,
          composerRevisionAfter: outcome.composerRevision,
        },
        targetComposerRevision: outcome.composerRevision,
        phase: { status: 'applied' },
      };
    }

    case 'undo-started':
      if (state.phase.status === 'reading' || state.phase.status === 'applying') {
        return state;
      }
      return {
        ...state,
        phase: { status: 'applying', operationId: event.operationId, kind: 'undo' },
      };

    case 'undo-finished': {
      if (!isPendingWrite(state, event.operationId, 'undo')) {
        return state;
      }
      const { outcome } = event;
      if (outcome.status === 'undone') {
        return rest({ ...state, lastChange: null, targetComposerRevision: outcome.composerRevision });
      }
      return {
        ...state,
        lastChange: state.lastChange === null ? null : { ...state.lastChange, undoId: null },
        phase: { status: 'error', error: outcome.error },
      };
    }

    case 'mail-event':
      return reduceMailEvent(state, event.event);

    case 'error-dismissed':
      return state.phase.status === 'error' ? rest(state) : state;
  }
}
