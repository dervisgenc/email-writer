export type { Clock, IdGenerator } from './dependencies';
export { deepFreeze } from './immutability';

export { buildContext } from './context/build-context';
export type { BuildContextDependencies, BuildContextInput } from './context/build-context';
export { DEFAULT_CONTEXT_POLICY } from './context/context-policy';
export type { ContextPolicy } from './context/context-policy';
export { describeContext } from './context/describe-context';
export { normalizeContextText } from './context/normalize-text';
export { withMessageEdit, withMessageInclusion } from './context/context-selection';
export {
  EMPTY_HISTORY,
  HISTORY_LIMIT,
  isRelatedEntry,
  normalizeSubject,
  recordSnapshot,
} from './context/message-history';
export type { HistoryEntry, MessageHistory } from './context/message-history';

export { ACTION_LIMITS } from './actions/action-limits';
export { prepareAction } from './actions/prepare-action';
export type { PrepareActionDependencies, PrepareActionInput } from './actions/prepare-action';
export { validateAction } from './actions/validate-action';
export type { ActionDraft } from './actions/validate-action';
export { validatePreviewCandidate } from './actions/validate-preview';
export type { PreviewDecision } from './actions/validate-preview';

export { createSession, isPreviewCurrent, isSessionBusy, restingPhase } from './session/session-state';
export type {
  AppliedChange,
  CreateSessionOptions,
  SessionForm,
  SessionPhase,
  SessionPreview,
  SessionState,
  SessionStatus,
  SourceBinding,
  StaleReason,
} from './session/session-state';
export { reduceSession } from './session/reduce-session';
export type { SessionEvent } from './session/reduce-session';
export { deriveCapabilities, usesConversationContext } from './session/session-capabilities';
export type { CapabilityOptions, SessionCapabilities } from './session/session-capabilities';

export { deriveApplyTarget, effectiveApplyTarget } from './editing/derive-apply-target';
export { applyOperationIdFor, validateApply } from './editing/validate-apply';
export { validateUndo } from './editing/validate-undo';
