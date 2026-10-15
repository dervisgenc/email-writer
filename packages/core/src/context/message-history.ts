import {
  isSameScope,
  type MessageSnapshot,
  type ThreadRef,
  type ThreadSnapshot,
} from '@email-writer/contracts';

/**
 * Sayfa oturumu boyunca okunan bir mesaj. Okuma bölmesi yalnızca seçili
 * mesajı gösterdiğinde, aynı konuşmanın önceki mesajlarına başka yoldan
 * ulaşılamaz. Geçmiş yalnızca bellekte tutulur; kalıcı saklanmaz ve hesap
 * değişince silinir.
 */
export interface HistoryEntry {
  readonly threadRef: ThreadRef;
  readonly subject: string | null;
  readonly message: MessageSnapshot;
  /** İlk okunma sırası; farklı okumalardaki mesajları sıralamak için. */
  readonly order: number;
}

export interface MessageHistory {
  readonly entries: readonly HistoryEntry[];
  readonly nextOrder: number;
}

export const EMPTY_HISTORY: MessageHistory = Object.freeze({ entries: [], nextOrder: 0 });

/** Bellekte tutulan en fazla mesaj; başlangıç kararıdır, ölçülmüş sınır değildir. */
export const HISTORY_LIMIT = 40;

/**
 * Bir konuşma okumasını geçmişe ekler. Aynı mesaj yeniden okunursa içeriği
 * güncellenir ve ilk okunma sırası korunur. Sınır aşılırsa en eski mesajlar çıkar.
 */
export function recordSnapshot(
  history: MessageHistory,
  snapshot: ThreadSnapshot,
  limit = HISTORY_LIMIT,
): MessageHistory {
  const byKey = new Map(history.entries.map((entry) => [entry.message.messageKey, entry]));
  let nextOrder = history.nextOrder;
  for (const message of [...snapshot.messages].sort((a, b) => a.displayOrder - b.displayOrder)) {
    const order = byKey.get(message.messageKey)?.order ?? nextOrder++;
    byKey.set(message.messageKey, { threadRef: snapshot.ref, subject: snapshot.subject, message, order });
  }
  const entries = [...byKey.values()].sort((a, b) => a.order - b.order).slice(-limit);
  return { entries, nextOrder };
}

/**
 * Yanıt ve iletme önekleri (yaygın dillerde); sondaki ":" zorunludur. Türkçe
 * "İLT" ayrıca yazılır: büyük noktalı İ, büyük/küçük harf eşlemesinde "i" olmaz.
 */
const REPLY_PREFIX =
  /^\s*(?:re|fw|fwd|aw|wg|sv|vs|tr|rv|ynt|yanıt|ilt|İlt|antw|res|enc)\s*(?:\[\d+\])?\s*:\s*/iu;

/**
 * Konuyu karşılaştırma için sadeleştirir: "RE: FW: Teklif" ile "Teklif" aynı
 * konudur. Boş konu `null` olur; boş konular birbirine bağlanmaz.
 */
export function normalizeSubject(subject: string | null): string | null {
  if (subject === null) {
    return null;
  }
  let value = subject.trim();
  for (let previous = ''; previous !== value;) {
    previous = value;
    value = value.replace(REPLY_PREFIX, '');
  }
  const normalized = value.replace(/\s+/g, ' ').trim().toLowerCase();
  return normalized === '' ? null : normalized;
}

/**
 * Geçmişteki bir mesaj açık konuşmayla ilişkili mi: aynı konuşmadan veya
 * aynı konudan. İlişkili mesajlar varsayılan olarak bağlama girer; başka
 * hesabın mesajı hiçbir zaman ilişkili sayılmaz.
 */
export function isRelatedEntry(entry: HistoryEntry, thread: ThreadRef, subject: string | null): boolean {
  if (!isSameScope(entry.threadRef.scope, thread.scope)) {
    return false;
  }
  if (entry.threadRef.threadKey === thread.threadKey) {
    return true;
  }
  const normalized = normalizeSubject(subject);
  return normalized !== null && normalizeSubject(entry.subject) === normalized;
}
