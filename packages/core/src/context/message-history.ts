import { isSameScope, type MessageSnapshot, type ThreadRef, type ThreadSnapshot } from '@writehand/contracts';

/**
 * A message read during the page session. When the reading pane shows only the selected
 * message, there is no other way to reach earlier messages of the same conversation. The
 * history lives in memory only; it is never persisted and is cleared when the account
 * changes.
 */
export interface HistoryEntry {
  readonly threadRef: ThreadRef;
  readonly subject: string | null;
  readonly message: MessageSnapshot;
  /** First-read order, used to order messages from different reads. */
  readonly order: number;
}

export interface MessageHistory {
  readonly entries: readonly HistoryEntry[];
  readonly nextOrder: number;
}

export const EMPTY_HISTORY: MessageHistory = Object.freeze({ entries: [], nextOrder: 0 });

/** Maximum number of messages kept in memory; a starting value, not a measured limit. */
export const HISTORY_LIMIT = 40;

/**
 * Adds a conversation read to the history. If a message is read again, its content is
 * updated and its first-read order is kept. Past the limit, the oldest messages drop out.
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
 * Reply and forward prefixes (in common languages); the trailing ":" is required. Turkish
 * "İLT" is listed separately because the dotted capital İ does not case-fold to "i".
 */
const REPLY_PREFIX =
  /^\s*(?:re|fw|fwd|aw|wg|sv|vs|tr|rv|ynt|yanıt|ilt|İlt|antw|res|enc)\s*(?:\[\d+\])?\s*:\s*/iu;

/**
 * Simplifies a subject for comparison: "RE: FW: Proposal" and "Proposal" are the same
 * subject. An empty subject becomes `null`; empty subjects are never linked to each other.
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
 * Whether a history message is related to the open conversation: from the same
 * conversation or with the same subject. Related messages join the context by default;
 * a message from another account is never considered related.
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
