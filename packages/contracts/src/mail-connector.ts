import type { ApplyTarget } from './actions';
import type { AppError } from './errors';
import type {
  ComposerRef,
  ComposerSnapshot,
  DraftSelection,
  MailScope,
  ReceivedMessageSelection,
  ThreadRef,
  ThreadSnapshot,
} from './mail';
import type { AbortSignalLike, Result } from './result';

export type PageSupport = 'waiting' | 'ready' | 'unsupported';

/** Overall page state. Carries no message bodies. */
export interface PageState {
  readonly support: PageSupport;
  readonly scope: MailScope | null;
  readonly activeThread: ThreadRef | null;
  readonly composers: readonly ComposerRef[];
}

export type MailEvent =
  | { readonly type: 'page-state-changed'; readonly state: PageState }
  | { readonly type: 'account-changed' }
  | {
      readonly type: 'active-thread-changed';
      readonly previous: ThreadRef | null;
      readonly current: ThreadRef | null;
    }
  | { readonly type: 'thread-content-changed'; readonly threadRef: ThreadRef }
  | { readonly type: 'composer-added'; readonly ref: ComposerRef }
  | { readonly type: 'composer-removed'; readonly ref: ComposerRef }
  | {
      /**
       * The conversation an existing editor belongs to became known later (e.g. Outlook
       * linked the reply to the conversation late). The editor, its revision and its
       * records stay the same; only the identity record is refreshed.
       */
      readonly type: 'composer-rebound';
      readonly previous: ComposerRef;
      readonly ref: ComposerRef;
    }
  | {
      readonly type: 'composer-changed';
      readonly ref: ComposerRef;
      readonly revision: number;
    };

export interface ApplyRequest {
  /** A second write with the same ID is never performed. */
  readonly applyOperationId: string;
  readonly target: ApplyTarget;
  readonly text: string;
  /**
   * Formatted content (lists, tables, charts). Given only when writing to the whole draft
   * or to an empty draft; `text` is the plain-text equivalent of the same content.
   * `visibleText` is the text the editor is expected to read back after the write.
   */
  readonly rich?: { readonly html: string; readonly visibleText: string };
}

export type ApplyOutcome =
  | {
      readonly status: 'applied';
      readonly composerRevision: number;
      /** `null` when the changed range could not be bounded exactly; undo is not offered. */
      readonly undoId: string | null;
    }
  | { readonly status: 'rejected'; readonly error: AppError }
  | { readonly status: 'uncertain'; readonly error: AppError };

export type UndoOutcome =
  | { readonly status: 'undone'; readonly composerRevision: number }
  | { readonly status: 'rejected'; readonly error: AppError }
  | { readonly status: 'uncertain'; readonly error: AppError };

/**
 * Common connector interface that every email environment (Outlook Web, Gmail Web,
 * Outlook desktop) implements. The app never passes selectors to a connector; it asks
 * for meaningful operations. Reads and writes are async because some environments
 * (e.g. Office.js) offer only async access.
 */
export interface MailConnector {
  readonly providerId: string;

  /** Support state, active conversation and references to the visible drafts. */
  getPageState(): PageState;

  /** Reads only the accessible content of the requested conversation. */
  readThread(ref: ThreadRef, signal: AbortSignalLike): Promise<Result<ThreadSnapshot, AppError>>;

  readComposer(ref: ComposerRef): Promise<Result<ComposerSnapshot, AppError>>;

  /**
   * Implementations must read the live selection synchronously, before the first `await`;
   * otherwise the selection can be lost once focus moves to the panel.
   */
  captureDraftSelection(ref: ComposerRef): Promise<Result<DraftSelection | null, AppError>>;

  readSelectedMessageText(ref: ThreadRef): Promise<Result<ReceivedMessageSelection | null, AppError>>;

  /** Returns an unsubscribe function. */
  subscribe(listener: (event: MailEvent) => void): () => void;

  /** Revalidates the target right before writing to the DOM and writes only once. */
  applyText(request: ApplyRequest): Promise<ApplyOutcome>;

  /** Undoes only the latest extension change, and only while its conditions still hold. */
  undoChange(undoId: string): Promise<UndoOutcome>;

  /** Clears observers, selection and undo records, and DOM references. */
  dispose(): void;
}
