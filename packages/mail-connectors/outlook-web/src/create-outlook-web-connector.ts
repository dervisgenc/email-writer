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
} from '@email-writer/contracts';

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
  /** Eklentinin kendi arayüz köklerini seçen CSS seçicisi; okumadan ve gözlemden dışlanır. */
  readonly ownUiSelector: string;
  /** SPA gezinmesi bildirimi (ör. WXT `wxt:locationchange`). */
  readonly subscribeLocation?: (listener: () => void) => () => void;
  readonly createId?: () => string;
  readonly now?: () => Date;
  readonly writer?: EditorWriter;
  /** Yazmadan sonra editörün bir sonraki normal yeniden çizimini bekler. */
  readonly settle?: () => Promise<void>;
  readonly waitLimitMs?: number;
}

export interface SelectorReportEntry {
  readonly key: SelectorKey;
  readonly status: SelectorStatus;
  /** Yalnızca eşleşme sayısı; içerik taşımaz. */
  readonly matches: number;
}

export interface OutlookWebConnection {
  readonly connector: MailConnector;
  locateLauncherAnchors(): readonly OutlookLauncherAnchor[];
  /** Gerçek sayfada seçici doğrulaması için içeriksiz tanı raporu. */
  selectorReport(): readonly SelectorReportEntry[];
  /** Outlook'un o anki tema renkleri; eklenti arayüzü bunlarla uyumlu görünür. */
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

/** Mesaj gövdelerinin sayısı ve metin uzunluğu; okuma yapmadan değişikliği fark etmek için. */
function threadSignature(thread: LocatedThread): string {
  const bodies = messageBodies(thread.root);
  const length = bodies.reduce((total, body) => total + (body.textContent?.length ?? 0), 0);
  return `${bodies.length}:${queryAll(thread.root, 'collapsedMessage').length}:${length}`;
}

/**
 * Outlook Web için `MailConnector`. Outlook'un dahili JavaScript durumuna,
 * belgelenmemiş ağ uçlarına veya oturum çerezlerine bağlanmaz; yalnızca
 * sayfanın görünen yapısıyla çalışır.
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
  const composers = new Map<string, ComposerHandle>();
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
    const ref: ComposerRef = {
      scope: registry.scope(),
      composerKey: registry.keyFor(editor, 'composer'),
      threadKey: isReply ? (threadRef?.threadKey ?? null) : null,
    };
    const tracker = observeEditor(editor, {
      document,
      fingerprint: (element) => composerFingerprint(element, classify),
      isOwnUi: (node) =>
        (node instanceof Element ? node : node.parentElement)?.closest(ownUiSelector) != null,
      onRevision: (revision) => {
        // Editör değişince eski seçim kayıtları geçersiz olur.
        selections.forgetComposer(ref.composerKey);
        emit({ type: 'composer-changed', ref, revision });
        // Editörün içi sayfa gözleminin dışındadır. Outlook yanıt alıntısını editörü
        // açtıktan sonra doldurur; "yeni ileti" sayılan taslak yanıta dönüşmüş olabilir.
        if (!isReply && queryFirst(editor, 'quoteStart') !== null) {
          observer.request();
        }
      },
    });
    const handle: ComposerHandle = {
      ref,
      editor,
      tracker,
      readAnatomy: () => readComposerAnatomy(editor, { classify, isReply }),
    };
    composers.set(ref.composerKey, handle);
    emit({ type: 'composer-added', ref });
  };

  const refresh = () => {
    if (disposed) {
      return;
    }
    if (registry.updateAccountHint(readAccountHint(document))) {
      // Hesap kapsamı değişti: eski kapsamın editör, seçim ve geri alma kayıtları
      // temizlenir. Önceden bir kapsam yayımlandıysa bu bir hesap değişimidir.
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
      if (composers.get(key)?.ref.threadKey !== threadKey) {
        // Taslağın hangi konuşmaya ait olduğu sonradan anlaşıldı (ör. Outlook
        // alıntıyı editörü açtıktan sonra doldurdu); kayıt yenilenir.
        removeComposer(key, true);
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
  // Yükleme sürerken "desteklenmiyor" kararını verebilmek için tek seferlik kontrol.
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
      // Canlı seçim, ilk beklemeden önce eşzamanlı olarak okunur.
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
      // Bölme yanıt taslağını gösterirken konuşma düğmesi gösterilmez; taslak araç çubuğu yeterlidir.
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
