import type { MailConnector, ThreadSnapshot } from '@email-writer/contracts';
import { EMPTY_HISTORY, recordSnapshot, type HistoryEntry, type MessageHistory } from '@email-writer/core';

/** Okunan mesaj geçmişine erişim; bağlam oluşturma ve görünüm bu arayüzü kullanır. */
export interface MessageHistoryStore {
  entries(): readonly HistoryEntry[];
  /** Kullanıcının istediği bir okumayı geçmişe ekler (dinleyicilere bildirilmez). */
  record(snapshot: ThreadSnapshot): void;
  /** Kullanıcı yeni bir mesaj açtığında arka planda yapılan okumaları bildirir. */
  subscribe(listener: (snapshot: ThreadSnapshot) => void): () => void;
}

export interface MessageHistoryController extends MessageHistoryStore {
  dispose(): void;
}

export interface MessageHistoryDependencies {
  readonly connector: MailConnector;
  /** Eklenti bu sitede kapalıysa hiçbir mesaj okunmaz. */
  readonly isEnabled: () => boolean;
  readonly debounceMs?: number;
  readonly readTimeoutMs?: number;
}

/**
 * Kullanıcının açtığı mesajları sayfa oturumu boyunca bellekte biriktirir.
 * Okuma bölmesi yalnızca seçili mesajı gösterdiğinde, aynı konuşmanın daha
 * önce açılan mesajlarına başka yoldan ulaşılamaz. Geçmiş kalıcı saklanmaz,
 * hiçbir yere gönderilmez ve hesap değişince silinir; mesaj açmak işlem
 * başlatmaz.
 */
export function createMessageHistory(deps: MessageHistoryDependencies): MessageHistoryController {
  const { connector } = deps;
  const debounceMs = deps.debounceMs ?? 400;
  const readTimeoutMs = deps.readTimeoutMs ?? 3_000;
  const listeners = new Set<(snapshot: ThreadSnapshot) => void>();
  let history: MessageHistory = EMPTY_HISTORY;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: AbortController | null = null;

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pending?.abort();
    pending = null;
  };

  const capture = async () => {
    timer = null;
    const thread = connector.getPageState().activeThread;
    if (thread === null || !deps.isEnabled()) {
      return;
    }
    pending?.abort();
    const abort = new AbortController();
    pending = abort;
    const timeout = setTimeout(() => abort.abort(), readTimeoutMs);
    const result = await connector.readThread(thread, abort.signal);
    clearTimeout(timeout);
    if (pending === abort) {
      pending = null;
    }
    if (!result.ok || abort.signal.aborted) {
      return;
    }
    history = recordSnapshot(history, result.value);
    for (const listener of listeners) {
      listener(result.value);
    }
  };

  const schedule = () => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => void capture(), debounceMs);
  };

  const unsubscribe = connector.subscribe((event) => {
    switch (event.type) {
      case 'account-changed':
        // Eski hesabın mesajları yeni hesabın bağlamına hiçbir koşulda taşınmaz.
        cancel();
        history = EMPTY_HISTORY;
        break;
      case 'active-thread-changed':
        if (event.current !== null) {
          schedule();
        }
        break;
      case 'thread-content-changed':
        schedule();
        break;
      default:
        break;
    }
  });
  if (connector.getPageState().activeThread !== null) {
    schedule();
  }

  return {
    entries: () => history.entries,
    record(snapshot) {
      history = recordSnapshot(history, snapshot);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      unsubscribe();
      cancel();
      listeners.clear();
      history = EMPTY_HISTORY;
    },
  };
}
