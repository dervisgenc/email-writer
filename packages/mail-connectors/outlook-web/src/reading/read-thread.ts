import {
  appError,
  err,
  isSameScope,
  ok,
  type AbortSignalLike,
  type AppError,
  type CoverageReason,
  type MessageSnapshot,
  type Result,
  type ThreadRef,
  type ThreadSnapshot,
} from '@email-writer/contracts';

import { messageBodies, type LocatedThread } from '../discovery/locate-thread';
import { closest, queryAll, queryFirst } from '../discovery/selectors';
import type { IdentityRegistry } from '../identity/identity-registry';
import { extractTextBlocks, type ElementRole } from './extract-text-blocks';

/** Başlangıç okuma bütçesi; ölçülmüş ürün sınırı değildir. */
export const READ_LIMITS = Object.freeze({ maxMessages: 100, maxTextLength: 250_000 });

const MAX_LABEL_LENGTH = 200;

export interface ReadThreadDependencies {
  readonly registry: IdentityRegistry;
  readonly classify: (element: Element) => ElementRole;
  readonly currentThread: () => LocatedThread | null;
  readonly threadRevision: () => number;
  readonly now: () => string;
  /** Uzun gezintiyi parçalara bölmek için tarayıcıya söz verir. */
  readonly yieldToBrowser: () => Promise<void>;
}

function visibleLabel(element: HTMLElement | null): string | null {
  const text = element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return text === '' ? null : text.slice(0, MAX_LABEL_LENGTH);
}

function reliableIso(element: HTMLElement | null): string | null {
  const value = element?.tagName === 'TIME' ? element.getAttribute('datetime') : null;
  if (value === null || value === undefined) {
    return null;
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/**
 * Bir mesajın kapsayıcısı; gövde ile başlık bilgisini birlikte içerir. Birden
 * fazla gövde içeren eşleşme kapsayıcı sayılmaz: aksi halde farklı mesajlar
 * aynı kimliği alıp tek mesaj gibi birleşebilirdi.
 */
export function messageContainerOf(body: HTMLElement): HTMLElement {
  const candidate = closest(body, 'messageContainer');
  if (candidate !== null && messageBodies(candidate).length === 1) {
    return candidate;
  }
  return body.parentElement ?? body;
}

/**
 * Aktif mesaj yalnızca güvenle belirlenebiliyorsa döner: tek açık mesaj veya
 * bütün tarihleri güvenilir mesajlardan en yenisi. Aksi halde kullanıcı seçer.
 */
function activeMessageKey(messages: readonly MessageSnapshot[]): string | null {
  if (messages.length === 1) {
    return messages[0]?.messageKey ?? null;
  }
  if (messages.length > 0 && messages.every((message) => message.sentAt !== null)) {
    return (
      [...messages].sort((a, b) => Date.parse(b.sentAt ?? '') - Date.parse(a.sentAt ?? ''))[0]?.messageKey ??
      null
    );
  }
  return null;
}

/**
 * Yalnızca istenen konuşmanın erişilebilir mesajlarını okur. Kapalı veya
 * yüklenmemiş mesaj okunmuş sayılmaz; eklenti "önceki mesajları göster"
 * düğmesine basmaz, sayfayı kaydırmaz, ek açmaz. Okuma sürerken konuşma
 * değişirse yarım sonuç kullanılmaz.
 */
export async function readThread(
  ref: ThreadRef,
  signal: AbortSignalLike,
  deps: ReadThreadDependencies,
): Promise<Result<ThreadSnapshot, AppError>> {
  const isCurrent = () => {
    const located = deps.currentThread();
    return located !== null && located.key === ref.threadKey && isSameScope(ref.scope, deps.registry.scope());
  };
  const located = deps.currentThread();
  if (located === null || !isCurrent()) {
    return err(appError('THREAD_CHANGED'));
  }

  const bodies = messageBodies(located.root);
  const readable = bodies.slice(-READ_LIMITS.maxMessages);
  let skippedByLimit = bodies.length - readable.length;
  let budget = READ_LIMITS.maxTextLength;
  const messages: MessageSnapshot[] = [];

  for (const [index, body] of readable.entries()) {
    await deps.yieldToBrowser();
    if (signal.aborted) {
      return err(appError('READ_CANCELLED'));
    }
    if (!body.isConnected) {
      return err(appError('THREAD_CHANGED'));
    }
    const container = messageContainerOf(body);
    const extraction = extractTextBlocks(body, { classify: deps.classify, maxLength: budget });
    if (extraction.truncated) {
      // Sınır nedeniyle tamamı okunamayan mesaj, tamamlanmış gibi verilmez.
      skippedByLimit += 1;
      continue;
    }
    budget -= extraction.blocks.reduce((total, block) => total + block.text.length, 0);
    const dateElement = queryFirst(container, 'messageDate');
    messages.push({
      messageKey: deps.registry.keyFor(container, 'msg'),
      senderLabel: visibleLabel(queryFirst(container, 'messageSender')),
      sentAt: reliableIso(dateElement),
      sentAtText: visibleLabel(dateElement),
      displayOrder: index,
      blocks: extraction.blocks.map(({ kind, certainty, text }) => ({ kind, certainty, text })),
    });
  }

  if (!isCurrent()) {
    return err(appError('THREAD_CHANGED'));
  }

  const collapsed = queryAll(located.root, 'collapsedMessage').filter(
    (row) => !bodies.some((body) => row.contains(body)),
  );
  const reasons: CoverageReason[] = ['unverified-history'];
  if (collapsed.length > 0) {
    reasons.push('collapsed-messages');
  }
  if (skippedByLimit > 0) {
    reasons.push('read-limit');
  }
  const knownUnreadable = collapsed.length + skippedByLimit;

  return ok({
    ref,
    revision: deps.threadRevision(),
    capturedAt: deps.now(),
    subject: visibleLabel(queryFirst(located.root, 'subject')),
    activeMessageKey: activeMessageKey(messages),
    messages,
    coverage: {
      source: 'visible-dom',
      status: 'partial',
      readableMessageCount: messages.length,
      // Kapalı satırlar tanınamıyorsa sayı uydurulmaz.
      knownUnreadableMessageCount: knownUnreadable > 0 ? knownUnreadable : null,
      reasons,
    },
  });
}
