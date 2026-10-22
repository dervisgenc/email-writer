import {
  appError,
  err,
  isSameScope,
  ok,
  type AppError,
  type ApplyOutcome,
  type ApplyRequest,
  type ComposerRef,
  type ComposerSnapshot,
  type DraftSelection,
  type MailEvent,
  type Result,
  type UndoOutcome,
} from '@writehand/contracts';

import { composerFingerprint, readComposerAnatomy } from './composer-anatomy';
import type { ElementRole } from './extract-text-blocks';
import type { IdentityRegistry } from './identity';
import { observeEditor } from './observe-editor';
import { captureDraftSelection } from './selection/capture-selection';
import { createSelectionRegistry } from './selection/selection-registry';
import { applyText, type WriteDependencies } from './writing/apply-text';
import type { ComposerHandle } from './writing/composer-handle';
import type { EditorWriter } from './writing/editor-writer';
import { undoChange } from './writing/undo-change';
import { createUndoStore } from './writing/undo-store';

/** A draft editor the connector found on the page. */
export interface FoundComposer {
  readonly editor: HTMLElement;
  /** Reply evidence: the editor quotes earlier mail or was opened under a conversation. */
  readonly isReply: boolean;
  /** The conversation the draft belongs to, when the connector can prove it; otherwise `null`. */
  readonly threadKey: string | null;
}

export interface ComposerRegistryOptions {
  readonly document: Document;
  readonly registry: IdentityRegistry;
  readonly classify: (element: Element) => ElementRole;
  readonly ownUiSelector: string;
  readonly emit: (event: MailEvent) => void;
  /** Brings page discovery up to date before a draft is looked up. */
  readonly flush: () => void;
  /**
   * Called after each settled batch of changes inside a draft that is not bound to a
   * conversation yet. The mail app may fill in the reply quote after the editor opened, so
   * the connector can look for reply evidence again.
   */
  readonly onUnboundEditorSettled?: (editor: HTMLElement) => void;
  readonly createId: () => string;
  readonly now: () => Date;
  readonly writer: EditorWriter;
  /** Waits for the editor's next regular re-render after a write. */
  readonly settle: () => Promise<void>;
}

/**
 * The drafts on the page and every operation on them: reading, selection, controlled writes
 * and undo. It is the same for every mail service whose drafts are `contenteditable`
 * editors; a connector only finds the editors and tells which conversation they belong to.
 */
export interface ComposerRegistry {
  /** Reconciles the tracked drafts with the editors found now; emits added, removed and rebound events. */
  sync(found: readonly FoundComposer[]): void;
  refs(): ComposerRef[];
  editors(): readonly { readonly ref: ComposerRef; readonly editor: HTMLElement }[];
  /** Whether a node lies inside a tracked editor; page observation ignores those changes. */
  contains(node: Node): boolean;
  /** Drops every draft and its selection, undo and write records (account switch, disposal). */
  clear(notify: boolean): void;
  readComposer(ref: ComposerRef): Promise<Result<ComposerSnapshot, AppError>>;
  captureDraftSelection(ref: ComposerRef): Promise<Result<DraftSelection | null, AppError>>;
  applyText(request: ApplyRequest): Promise<ApplyOutcome>;
  undoChange(undoId: string): Promise<UndoOutcome>;
}

/** Composer record; its conversation binding may become known later while the editor stays the same. */
interface TrackedComposer extends ComposerHandle {
  readonly binding: { ref: ComposerRef; isReply: boolean };
}

export function createComposerRegistry(options: ComposerRegistryOptions): ComposerRegistry {
  const { document, registry, classify, ownUiSelector, emit } = options;
  const selections = createSelectionRegistry();
  const undo = createUndoStore();
  const attempts: WriteDependencies['attempts'] = new Map();
  const composers = new Map<string, TrackedComposer>();

  const remove = (key: string, notify: boolean) => {
    const handle = composers.get(key);
    if (handle === undefined) {
      return;
    }
    handle.tracker.dispose();
    composers.delete(key);
    selections.forgetComposer(key);
    undo.forgetComposer(key);
    if (notify) {
      emit({ type: 'composer-removed', ref: handle.ref });
    }
  };

  const add = ({ editor, isReply, threadKey }: FoundComposer) => {
    const binding: TrackedComposer['binding'] = {
      ref: { scope: registry.scope(), composerKey: registry.keyFor(editor, 'composer'), threadKey },
      isReply,
    };
    const tracker = observeEditor(editor, {
      document,
      fingerprint: (element) => composerFingerprint(element, classify),
      isOwnUi: (node) =>
        (node instanceof Element ? node : node.parentElement)?.closest(ownUiSelector) != null,
      onRevision: (revision) => {
        // Once the editor changes, earlier selection records are no longer valid.
        selections.forgetComposer(binding.ref.composerKey);
        emit({ type: 'composer-changed', ref: binding.ref, revision });
      },
      onSettled: () => {
        if (binding.ref.threadKey === null) {
          options.onUnboundEditorSettled?.(editor);
        }
      },
    });
    const handle: TrackedComposer = {
      get ref() {
        return binding.ref;
      },
      binding,
      editor,
      tracker,
      readAnatomy: () => readComposerAnatomy(editor, { classify, isReply: binding.isReply }),
    };
    composers.set(binding.ref.composerKey, handle);
    emit({ type: 'composer-added', ref: binding.ref });
  };

  const find = (ref: ComposerRef): ComposerHandle | null => {
    options.flush();
    if (!isSameScope(ref.scope, registry.scope())) {
      return null;
    }
    const handle = composers.get(ref.composerKey);
    return handle !== undefined && handle.editor.isConnected ? handle : null;
  };

  const writeDependencies: WriteDependencies = {
    document,
    scope: () => registry.scope(),
    findComposer: find,
    selections,
    undo,
    writer: options.writer,
    createId: options.createId,
    settle: options.settle,
    attempts,
  };

  return {
    sync(found) {
      const foundKeys = new Set(found.map(({ editor }) => registry.keyFor(editor, 'composer')));
      for (const [key, handle] of composers) {
        if (!foundKeys.has(key) || !handle.editor.isConnected) {
          remove(key, true);
        }
      }
      for (const composer of found) {
        const key = registry.keyFor(composer.editor, 'composer');
        const tracked = composers.get(key);
        if (tracked !== undefined) {
          tracked.binding.isReply = composer.isReply;
          if (tracked.ref.threadKey === null && composer.threadKey !== null) {
            // The draft's conversation became known later (e.g. the mail app filled in the
            // quote after opening the editor). The editor is the same: its revision, selection
            // and undo records are kept, and work in progress stays valid.
            const previous = tracked.ref;
            tracked.binding.ref = { ...previous, threadKey: composer.threadKey };
            emit({ type: 'composer-rebound', previous, ref: tracked.ref });
          } else if (tracked.ref.threadKey !== composer.threadKey) {
            // A draft that moves to another conversation or loses its conversation counts as new.
            remove(key, true);
          }
        }
        if (!composers.has(key)) {
          add(composer);
        }
      }
    },

    refs: () => [...composers.values()].map((handle) => handle.ref),

    editors: () => [...composers.values()].map(({ ref, editor }) => ({ ref, editor })),

    contains(node) {
      for (const handle of composers.values()) {
        if (handle.editor.contains(node)) {
          return true;
        }
      }
      return false;
    },

    clear(notify) {
      for (const key of [...composers.keys()]) {
        remove(key, notify);
      }
      selections.clear();
      undo.clear();
      attempts.clear();
    },

    async readComposer(ref) {
      const handle = find(ref);
      if (handle === null) {
        return err(appError('TARGET_MISSING', { field: 'target' }));
      }
      const revision = handle.tracker.sync();
      const anatomy = handle.readAnatomy();
      return ok({
        ref: handle.ref,
        revision,
        capturedAt: options.now().toISOString(),
        editableText: anatomy.editableText,
        canReplaceBody: anatomy.canReplaceBody,
        canReplaceSelection: anatomy.editableSegments.length > 0,
        canInsertIntoEmptyBody: anatomy.canInsertIntoEmptyBody,
        containsRichContent: anatomy.containsRichContent,
      });
    },

    async captureDraftSelection(ref) {
      // The live selection is read synchronously, before the first await.
      const handle = find(ref);
      if (handle === null) {
        return err(appError('TARGET_MISSING', { field: 'target' }));
      }
      return captureDraftSelection(document, handle, selections, options.createId);
    },

    applyText: (request) => applyText(request, writeDependencies),

    undoChange: (undoId) => undoChange(undoId, writeDependencies),
  };
}
