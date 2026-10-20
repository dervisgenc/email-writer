import {
  appError,
  err,
  isSameScope,
  ok,
  type ComposerRef,
  type MailConnector,
  type MailEvent,
  type PageState,
  type PageTheme,
  type ThreadRef,
} from '@writehand/contracts';

import { detectPage, DEFAULT_WAIT_LIMIT_MS } from './discovery/detect-page';
import { locateComposers, readAccountHint } from './discovery/locate-composers';
import { messageBodies, type LocatedThread } from './discovery/locate-thread';
import { readPageTheme } from './discovery/read-page-theme';
import { createActiveThreadTracker } from './discovery/track-active-thread';
import {
  OUTLOOK_SELECTORS,
  queryAll,
  queryFirst,
  SELECTOR_KEYS,
  type SelectorKey,
  type SelectorStatus,
} from './discovery/selectors';
import { createIdentityRegistry, OUTLOOK_PROVIDER_ID } from './identity/identity-registry';
import { locateLauncherAnchors, type OutlookLauncherAnchor } from './mounting/locate-launcher-anchors';
import { observeEditor } from './observation/observe-editor';
import { observePage } from './observation/observe-page';
import { composerFingerprint, readComposerAnatomy } from './reading/composer-anatomy';
import { createOutlookClassifier } from './reading/outlook-classifier';
import { readThread } from './reading/read-thread';
import { captureDraftSelection } from './selection/capture-selection';
import { captureReceivedSelection } from './selection/capture-received-selection';
import { createSelectionRegistry } from './selection/selection-registry';
import { applyText, type WriteDependencies } from './writing/apply-text';
import type { ComposerHandle } from './writing/composer-handle';
import { createExecCommandWriter, type EditorWriter } from './writing/editor-writer';
import { undoChange } from './writing/undo-change';
import { createUndoStore } from './writing/undo-store';

export interface OutlookWebOptions {
  readonly document: Document;
  /** CSS selector for the extension's own UI roots; excluded from reading and observation. */
  readonly ownUiSelector: string;
  /** SPA navigation notification (e.g. WXT `wxt:locationchange`). */
  readonly subscribeLocation?: (listener: () => void) => () => void;
  readonly createId?: () => string;
  readonly now?: () => Date;
  readonly writer?: EditorWriter;
  /** Waits for the editor's next regular re-render after a write. */
  readonly settle?: () => Promise<void>;
  readonly waitLimitMs?: number;
}

export interface SelectorReportEntry {
  readonly key: SelectorKey;
  readonly status: SelectorStatus;
  /** Match count only; carries no content. */
  readonly matches: number;
}

export interface OutlookWebConnection {
  readonly connector: MailConnector;
  locateLauncherAnchors(): readonly OutlookLauncherAnchor[];
  /** Content-free diagnostic report for verifying selectors on the live page. */
  selectorReport(): readonly SelectorReportEntry[];
  /** Outlook's current theme colors, so the extension UI can match them. */
  readTheme(): PageTheme | null;
}

const SETTLE_MS = 250;

function samePageState(a: PageState, b: PageState): boolean {
  return (
    a.support === b.support &&
    a.scope?.accountScopeId === b.scope?.accountScopeId &&
    a.activeThread?.threadKey === b.activeThread?.threadKey &&
    a.composers.length === b.composers.length &&
    a.composers.every(
      (composer, index) =>
        composer.composerKey === b.composers[index]?.composerKey &&
        composer.threadKey === b.composers[index]?.threadKey,
    )
  );
}

/** Message body count and text length; detects changes without reading the thread. */
function threadSignature(thread: LocatedThread): string {
  const bodies = messageBodies(thread.root);
  const length = bodies.reduce((total, body) => total + (body.textContent?.length ?? 0), 0);
  return `${bodies.length}:${queryAll(thread.root, 'collapsedMessage').length}:${length}`;
}

/** Composer record; its thread binding may become known later while the editor stays the same. */
interface TrackedComposer extends ComposerHandle {
  readonly binding: { ref: ComposerRef; isReply: boolean };
}

/**
 * `MailConnector` for Outlook Web. It does not touch Outlook's internal
 * JavaScript state, undocumented network endpoints or session cookies; it
 * works only with the visible structure of the page.
 */
export function createOutlookWebConnector(options: OutlookWebOptions): OutlookWebConnection {
  const { document, ownUiSelector } = options;
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());
  const startedAt = now().getTime();
  const classify = createOutlookClassifier(ownUiSelector);
  const registry = createIdentityRegistry(createId);
  const threads = createActiveThreadTracker(document, registry);
  const selections = createSelectionRegistry();
  const undo = createUndoStore();
  const attempts: WriteDependencies['attempts'] = new Map();
  const composers = new Map<string, TrackedComposer>();
  const listeners = new Set<(event: MailEvent) => void>();

  let thread: LocatedThread | null = null;
  let threadRef: ThreadRef | null = null;
  let threadRevision = 1;
  let signature = '';
  let pageState: PageState = { support: 'waiting', scope: null, activeThread: null, composers: [] };
  let disposed = false;

  const emit = (event: MailEvent) => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  const removeComposer = (key: string, notify: boolean) => {
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

  const addComposer = (editor: HTMLElement, isReply: boolean) => {
    const binding: TrackedComposer['binding'] = {
      ref: {
        scope: registry.scope(),
        composerKey: registry.keyFor(editor, 'composer'),
        threadKey: isReply ? (threadRef?.threadKey ?? null) : null,
      },
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
        // The editor's contents are outside the page observer. Outlook fills in the reply
        // quote after opening the editor (the revision does not change), so a draft counted
        // as a new message may have turned into a reply.
        if (!binding.isReply && queryFirst(editor, 'quoteStart') !== null) {
          observer.request();
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

  const refresh = () => {
    if (disposed) {
      return;
    }
    if (registry.updateAccountHint(readAccountHint(document))) {
      // The account scope changed: drop the old scope's composer, selection and undo
      // records. If a scope had already been published, this is an account switch.
      const hadScope = pageState.scope !== null;
      for (const key of [...composers.keys()]) {
        removeComposer(key, hadScope);
      }
      selections.clear();
      undo.clear();
      attempts.clear();
      thread = null;
      threadRef = null;
      threads.reset();
      if (hadScope) {
        emit({ type: 'account-changed' });
      }
    }

    const support = detectPage(
      document,
      now().getTime() - startedAt,
      options.waitLimitMs ?? DEFAULT_WAIT_LIMIT_MS,
    );
    const located = support === 'ready' ? threads.locate() : null;
    const previousRef = threadRef;
    const nextRef = located === null ? null : { scope: registry.scope(), threadKey: located.key };
    thread = located;

    if (previousRef?.threadKey !== nextRef?.threadKey) {
      threadRef = nextRef;
      threadRevision = 1;
      signature = located === null ? '' : threadSignature(located);
      emit({ type: 'active-thread-changed', previous: previousRef, current: nextRef });
    } else if (located !== null && nextRef !== null) {
      const nextSignature = threadSignature(located);
      if (nextSignature !== signature) {
        signature = nextSignature;
        threadRevision += 1;
        emit({ type: 'thread-content-changed', threadRef: nextRef });
      }
    }

    const found = support === 'ready' ? locateComposers(document, ownUiSelector) : [];
    const foundKeys = new Set(found.map(({ editor }) => registry.keyFor(editor, 'composer')));
    for (const [key, handle] of composers) {
      if (!foundKeys.has(key) || !handle.editor.isConnected) {
        removeComposer(key, true);
      }
    }
    for (const { editor, isReply } of found) {
      const key = registry.keyFor(editor, 'composer');
      const threadKey = isReply ? (threadRef?.threadKey ?? null) : null;
      const tracked = composers.get(key);
      if (tracked !== undefined) {
        tracked.binding.isReply = isReply;
        if (tracked.ref.threadKey === null && threadKey !== null) {
          // The draft's thread became known later (e.g. Outlook filled in the quote
          // after opening the editor). The editor is the same: its revision, selection
          // and undo records are kept, and work in progress stays valid.
          const previous = tracked.ref;
          tracked.binding.ref = { ...previous, threadKey };
          emit({ type: 'composer-rebound', previous, ref: tracked.ref });
        } else if (tracked.ref.threadKey !== threadKey) {
          // A draft that moves to another thread or loses its thread counts as a new record.
          removeComposer(key, true);
        }
      }
      if (!composers.has(key)) {
        addComposer(editor, isReply);
      }
    }

    const nextState: PageState = {
      support,
      scope: support === 'ready' ? registry.scope() : null,
      activeThread: threadRef,
      composers: [...composers.values()].map((handle) => handle.ref),
    };
    if (!samePageState(pageState, nextState)) {
      pageState = nextState;
      emit({ type: 'page-state-changed', state: pageState });
    }
  };

  const isInsideTrackedEditor = (node: Node) => {
    for (const handle of composers.values()) {
      if (handle.editor.contains(node)) {
        return true;
      }
    }
    return false;
  };
  const observer = observePage({
    document,
    onChange: refresh,
    isIgnored: (node) => {
      const element = node instanceof Element ? node : node.parentElement;
      return element?.closest(ownUiSelector) != null || isInsideTrackedEditor(node);
    },
    ...(options.subscribeLocation ? { subscribeLocation: options.subscribeLocation } : {}),
  });
  // One-off check so the page can be declared unsupported while it is still loading.
  const waitTimer = setTimeout(refresh, (options.waitLimitMs ?? DEFAULT_WAIT_LIMIT_MS) + 50);
  refresh();

  const findComposer = (ref: ComposerRef): ComposerHandle | null => {
    observer.flush();
    if (!isSameScope(ref.scope, registry.scope())) {
      return null;
    }
    const handle = composers.get(ref.composerKey);
    return handle !== undefined && handle.editor.isConnected ? handle : null;
  };

  const writeDependencies: WriteDependencies = {
    document,
    scope: () => registry.scope(),
    findComposer,
    selections,
    undo,
    writer: options.writer ?? createExecCommandWriter(document),
    createId,
    settle: options.settle ?? (() => new Promise((resolve) => setTimeout(resolve, SETTLE_MS))),
    attempts,
  };

  const connector: MailConnector = {
    providerId: OUTLOOK_PROVIDER_ID,

    getPageState() {
      observer.flush();
      return pageState;
    },

    async readThread(ref, signal) {
      observer.flush();
      return readThread(ref, signal, {
        registry,
        classify,
        currentThread: () => {
          observer.flush();
          return thread;
        },
        threadRevision: () => threadRevision,
        now: () => now().toISOString(),
        yieldToBrowser: () => new Promise((resolve) => setTimeout(resolve, 0)),
      });
    },

    async readComposer(ref) {
      const handle = findComposer(ref);
      if (handle === null) {
        return err(appError('TARGET_MISSING', { field: 'target' }));
      }
      const revision = handle.tracker.sync();
      const anatomy = handle.readAnatomy();
      return ok({
        ref: handle.ref,
        revision,
        capturedAt: now().toISOString(),
        editableText: anatomy.editableText,
        canReplaceBody: anatomy.canReplaceBody,
        canReplaceSelection: anatomy.editableSegments.length > 0,
        canInsertIntoEmptyBody: anatomy.canInsertIntoEmptyBody,
        containsRichContent: anatomy.containsRichContent,
      });
    },

    async captureDraftSelection(ref) {
      // The live selection is read synchronously, before the first await.
      const handle = findComposer(ref);
      if (handle === null) {
        return err(appError('TARGET_MISSING', { field: 'target' }));
      }
      return captureDraftSelection(document, handle, selections, createId);
    },

    async readSelectedMessageText(ref) {
      observer.flush();
      if (thread === null || threadRef === null || threadRef.threadKey !== ref.threadKey) {
        return err(appError('THREAD_CHANGED'));
      }
      return captureReceivedSelection(document, thread, ref, registry);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    applyText(request) {
      return applyText(request, writeDependencies);
    },

    undoChange(undoId) {
      return undoChange(undoId, writeDependencies);
    },

    dispose() {
      disposed = true;
      clearTimeout(waitTimer);
      observer.dispose();
      for (const key of [...composers.keys()]) {
        removeComposer(key, false);
      }
      selections.clear();
      undo.clear();
      attempts.clear();
      registry.clear();
      listeners.clear();
    },
  };

  return {
    connector,
    locateLauncherAnchors() {
      observer.flush();
      if (pageState.support !== 'ready') {
        return [];
      }
      // No thread button while the reading pane shows a reply draft; the draft toolbar is enough.
      const shownThread = thread !== null && thread.replyView === undefined ? thread : null;
      return locateLauncherAnchors({
        thread:
          shownThread !== null && threadRef !== null ? { ref: threadRef, root: shownThread.root } : null,
        composers: [...composers.values()].map(({ ref, editor }) => ({ ref, editor })),
      });
    },
    readTheme: () => readPageTheme(document),
    selectorReport() {
      return SELECTOR_KEYS.map((key) => ({
        key,
        status: OUTLOOK_SELECTORS[key].status,
        matches: queryAll(document, key).length,
      }));
    },
  };
}
