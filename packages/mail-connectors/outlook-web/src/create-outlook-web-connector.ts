import {
  appError,
  err,
  type MailConnector,
  type MailEvent,
  type PageState,
  type PageTheme,
  type ThreadRef,
} from '@writehand/contracts';
import {
  createComposerRegistry,
  createExecCommandWriter,
  createIdentityRegistry,
  captureReceivedSelection,
  locateLauncherAnchors,
  observePage,
  type EditorWriter,
  type MailLauncherAnchor,
} from '@writehand/mail-dom';

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
import { messageContainerOf, messageKeyOf } from './reading/message-header';
import { createOutlookClassifier } from './reading/outlook-classifier';
import { readThread } from './reading/read-thread';

export const OUTLOOK_PROVIDER_ID = 'outlook-web';

/** Attributes whose changes may select another conversation or change an editor's editability. */
const WATCHED_ATTRIBUTES = ['aria-selected', 'aria-expanded', 'data-convid', 'contenteditable'];

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
  locateLauncherAnchors(): readonly MailLauncherAnchor[];
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
  const registry = createIdentityRegistry(OUTLOOK_PROVIDER_ID, createId);
  const threads = createActiveThreadTracker(document, registry, ownUiSelector);
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

  const composers = createComposerRegistry({
    document,
    registry,
    classify,
    ownUiSelector,
    emit,
    flush: () => observer.flush(),
    // The editor's contents are outside the page observer. Outlook fills in the reply
    // quote after opening the editor (the revision does not change), so a draft counted
    // as a new message may have turned into a reply.
    onUnboundEditorSettled: (editor) => {
      if (queryFirst(editor, 'quoteStart') !== null) {
        observer.request();
      }
    },
    createId,
    now,
    writer: options.writer ?? createExecCommandWriter(document),
    settle: options.settle ?? (() => new Promise((resolve) => setTimeout(resolve, SETTLE_MS))),
  });

  const refresh = () => {
    if (disposed) {
      return;
    }
    if (registry.updateAccountHint(readAccountHint(document))) {
      // The account scope changed: drop the old scope's composer, selection and undo
      // records. If a scope had already been published, this is an account switch.
      const hadScope = pageState.scope !== null;
      composers.clear(hadScope);
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
    composers.sync(
      found.map(({ editor, isReply }) => ({
        editor,
        isReply,
        threadKey: isReply && thread?.root.contains(editor) ? (threadRef?.threadKey ?? null) : null,
      })),
    );

    const nextState: PageState = {
      support,
      scope: support === 'ready' ? registry.scope() : null,
      activeThread: threadRef,
      composers: composers.refs(),
    };
    if (!samePageState(pageState, nextState)) {
      pageState = nextState;
      emit({ type: 'page-state-changed', state: pageState });
    }
  };

  const observer = observePage({
    document,
    onChange: refresh,
    attributes: WATCHED_ATTRIBUTES,
    isIgnored: (node) => {
      const element = node instanceof Element ? node : node.parentElement;
      return element?.closest(ownUiSelector) != null || composers.contains(node);
    },
    ...(options.subscribeLocation ? { subscribeLocation: options.subscribeLocation } : {}),
  });
  // One-off check so the page can be declared unsupported while it is still loading.
  const waitTimer = setTimeout(refresh, (options.waitLimitMs ?? DEFAULT_WAIT_LIMIT_MS) + 50);
  refresh();

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

    readComposer: (ref) => composers.readComposer(ref),

    captureDraftSelection: (ref) => composers.captureDraftSelection(ref),

    async readSelectedMessageText(ref) {
      observer.flush();
      if (thread === null || threadRef === null || threadRef.threadKey !== ref.threadKey) {
        return err(appError('THREAD_CHANGED'));
      }
      const root = thread.root;
      return captureReceivedSelection(document, {
        ref: threadRef,
        bodies: messageBodies(root),
        messageKeyOf: (body) => messageKeyOf(messageContainerOf(body, root), registry),
      });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    applyText: (request) => composers.applyText(request),

    undoChange: (undoId) => composers.undoChange(undoId),

    dispose() {
      disposed = true;
      clearTimeout(waitTimer);
      observer.dispose();
      composers.clear(false);
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
        composers: composers.editors(),
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
