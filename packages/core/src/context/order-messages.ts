import type { ContextOrdering, MessageSnapshot } from '@writehand/contracts';

function parseReliableTime(sentAt: string | null): number | null {
  if (sentAt === null) {
    return null;
  }
  const time = Date.parse(sentAt);
  return Number.isNaN(time) ? null : time;
}

function compareDisplayOrder(a: MessageSnapshot, b: MessageSnapshot): number {
  return a.displayOrder - b.displayOrder || a.messageKey.localeCompare(b.messageKey);
}

/**
 * Orders messages from oldest to newest if every message has a reliable date. If even one
 * date is missing, the reliable on-screen order is kept; no synthetic dates are assigned.
 */
export function orderMessages(messages: readonly MessageSnapshot[]): {
  ordered: MessageSnapshot[];
  ordering: ContextOrdering;
} {
  const times = new Map<MessageSnapshot, number>();
  for (const message of messages) {
    const time = parseReliableTime(message.sentAt);
    if (time === null) {
      return { ordered: [...messages].sort(compareDisplayOrder), ordering: 'display-order' };
    }
    times.set(message, time);
  }

  const ordered = [...messages].sort(
    (a, b) => (times.get(a) ?? 0) - (times.get(b) ?? 0) || compareDisplayOrder(a, b),
  );
  return { ordered, ordering: 'sent-at' };
}
