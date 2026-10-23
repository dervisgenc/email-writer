import {
  appError,
  err,
  isSameScope,
  type MailConnector,
  type MailEvent,
  type PageState,
  type PageTheme,
  type ThreadRef,
} from '@writehand/contracts';
import {
  captureReceivedSelection,
  createComposerRegistry,
  createExecCommandWriter,
  createIdentityRegistry,
  locateLauncherAnchors,
  observePage,
  type EditorWriter,
  type MailLauncherAnchor,
} from '@writehand/mail-dom';

import { DEFAULT_WAIT_LIMIT_MS, detectPage } from './discovery/detect-page';
import { locateComposers, readAccountHint, type LocatedComposer } from './discovery/locate-composers';
import {
  locateThread,
  messageBodies,
  subjectRowActions,
  threadKeyForId,
  threadSignature,
  type LocatedThread,
} from './discovery/locate-thread';
import { readPageTheme } from './discovery/read-page-theme';
import {
  GMAIL_SELECTORS,
  queryAll,
  queryFirst,
  SELECTOR_KEYS,
  type SelectorKey,
  type SelectorStatus,
} from './discovery/selectors';
import { createGmailClassifier } from './reading/gmail-classifier';
import { messageContainerOf, messageKeyForId, messageKeyOf } from './reading/message-header';
import { readQuotedReply } from './reading/read-quoted-reply';
import { readThread } from './reading/read-thread';

export const GMAIL_PROVIDER_ID = 'gmail-web';

/**
 * Attributes whose changes may expand a message or change an editor's editability. Class
 * changes are not watched: Gmail changes classes on every hover, and expanding a message adds
 * its body to the DOM, which the observer sees anyway.
 */
const WATCHED_ATTRIBUTES = ['aria-expanded', 'contenteditable'];

const SETTLE_MS = 250;
/** How long to wait for Gmail to load a reply's trimmed quote. */
const QUOTE_WAIT_MS = 2_000;

export interface GmailWebOptions {
  readonly document: Document;
  /** CSS selector for the extension's own UI roots; excluded from reading and observation. */
  readonly ownUiSelector: string;
  /** SPA navigation notification (e.g. WXT `wxt:locationchange`); Gmail routes with the URL hash. */
  readonly subscribeLocation?: (listener: () => void) => () => void;
  readonly createId?: () => string;
  readonly now?: () => Date;
  readonly writer?: EditorWriter;
  /** Waits for the editor's next regular re-render after a write. */
  readonly settle?: () => Promise<void>;
  readonly waitLimitMs?: number;
  /** How long to wait for Gmail to load a reply's trimmed quote after its toggle is pressed. */
  readonly quoteWaitMs?: number;
}

export interface SelectorReportEntry {
  readonly key: SelectorKey;
  readonly status: SelectorStatus;
  /** Match count only; carries no content. */
  readonly matches: number;
}

export interface GmailWebConnection {
  readonly connector: MailConnector;
  locateLauncherAnchors(): readonly MailLauncherAnchor[];
  /** Content-free diagnostic report for verifying selectors on the live page. */
  selectorReport(): readonly SelectorReportEntry[];
  /** Gmail's current theme, so the extension UI can match it. */
  readTheme(): PageTheme | null;
}

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

/**
 * `MailConnector` for Gmail on the web. Like the Outlook connector, it works only with the
 * visible structure of the page: it does not touch Gmail's JavaScript state, its internal
 * network requests or session cookies.
 */
export function createGmailWebConnector(options: GmailWebOptions): GmailWebConnection {
  const { document, ownUiSelector } = options;
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());
  const startedAt = now().getTime();
  const classify = createGmailClassifier(ownUiSelector);
  const registry = createIdentityRegistry(GMAIL_PROVIDER_ID, createId);
  const listeners = new Set<(event: MailEvent) => void>();

  let thread: LocatedThread | null = null;
  let threadRef: ThreadRef | null = null;
  let threadRevision = 1;
  let signature = '';
  let pageState: PageState = { support: 'waiting', scope: null, activeThread: null, composers: [] };
  /** Replies opened from the message list, by the key of the conversation their form names. */
  let quotedReplies = new Map<string, LocatedComposer>();
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
    // A popped-out reply may get its quote after the editor opened; look again.
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
      // Gmail loads another account in a new page, so this is rare; the records are dropped anyway.
      const hadScope = pageState.scope !== null;
      composers.clear(hadScope);
      thread = null;
      threadRef = null;
      if (hadScope) {
        emit({ type: 'account-changed' });
      }
    }

    const support = detectPage(
      document,
      now().getTime() - startedAt,
      options.waitLimitMs ?? DEFAULT_WAIT_LIMIT_MS,
    );
    const located = support === 'ready' ? locateThread(document, registry) : null;
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
    const replies = new Map<string, LocatedComposer>();
    composers.sync(
      found.map((composer) => {
        const { editor, isReply, quoteOutsideEditor } = composer;
        // An inline reply inside the open conversation belongs to it; any other reply belongs to
        // the conversation its hidden form names (a reply opened from the message list).
        const inOpenThread = isReply && thread !== null && thread.root.contains(editor);
        const threadKey = inOpenThread
          ? (threadRef?.threadKey ?? null)
          : composer.threadId !== null
            ? threadKeyForId(composer.threadId)
            : null;
        if (!inOpenThread && threadKey !== null && threadKey !== threadRef?.threadKey) {
          replies.set(threadKey, composer);
        }
        return { editor, isReply, quoteOutsideEditor, threadKey };
      }),
    );
    quotedReplies = replies;

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
    providerId: GMAIL_PROVIDER_ID,

    getPageState() {
      observer.flush();
      return pageState;
    },

    async readThread(ref, signal) {
      observer.flush();
      // A reply opened from the message list: its conversation is not on the page, only its quote.
      if (quotedReplies.has(ref.threadKey) && isSameScope(ref.scope, registry.scope())) {
        return readQuotedReply(ref, signal, {
          classify,
          currentReply: () => {
            observer.flush();
            const reply = quotedReplies.get(ref.threadKey);
            return reply === undefined || !reply.editor.isConnected
              ? null
              : {
                  editor: reply.editor,
                  container: reply.container,
                  messageKey:
                    reply.repliedMessageId === null ? null : messageKeyForId(reply.repliedMessageId),
                };
          },
          threadRevision: () => 1,
          now: () => now().toISOString(),
          wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
          quoteWaitMs: options.quoteWaitMs ?? QUOTE_WAIT_MS,
        });
      }
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
      quotedReplies = new Map();
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
      return locateLauncherAnchors({
        thread:
          thread !== null && threadRef !== null
            ? { ref: threadRef, root: thread.anchor, obstacles: subjectRowActions(thread) }
            : null,
        composers: composers.editors(),
      });
    },
    readTheme: () => readPageTheme(document),
    selectorReport() {
      return SELECTOR_KEYS.map((key) => ({
        key,
        status: GMAIL_SELECTORS[key].status,
        matches: queryAll(document, key).length,
      }));
    },
  };
}
