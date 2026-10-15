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
import { queryAll, queryFirst } from '../discovery/selectors';
import type { IdentityRegistry } from '../identity/identity-registry';
import { extractTextBlocks, type ElementRole } from './extract-text-blocks';
import { labelText, messageContainerOf, messageKeyOf, readMessageHeader } from './message-header';

/** Başlangıç okuma bütçesi; ölçülmüş ürün sınırı değildir. */
export const READ_LIMITS = Object.freeze({ maxMessages: 100, maxTextLength: 250_000 });

export interface ReadThreadDependencies {
  readonly registry: IdentityRegistry;
  readonly classify: (element: Element) => ElementRole;
  readonly currentThread: () => LocatedThread | null;
  readonly threadRevision: () => number;
  readonly now: () => string;
  /** Uzun gezintiyi parçalara bölmek için tarayıcıya söz verir. */
  readonly yieldToBrowser: () => Promise<void>;
}

/**
 * Aktif mesaj yalnızca güvenle belirlenebiliyorsa döner: tek açık mesaj.
 * Outlook makinece okunur tarih vermediği için birden fazla açık mesajda
 * en yenisi tahmin edilmez; kullanıcı seçer.
 */
function activeMessageKey(messages: readonly MessageSnapshot[]): string | null {
  return messages.length === 1 ? (messages[0]?.messageKey ?? null) : null;
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
    const container = messageContainerOf(body, located.root);
    const extraction = extractTextBlocks(body, { classify: deps.classify, maxLength: budget });
    if (extraction.truncated) {
      // Sınır nedeniyle tamamı okunamayan mesaj, tamamlanmış gibi verilmez.
      skippedByLimit += 1;
      continue;
    }
    budget -= extraction.blocks.reduce((total, block) => total + block.text.length, 0);
    const header = readMessageHeader(container, body);
    messages.push({
      messageKey: messageKeyOf(container, deps.registry),
      senderLabel: header.senderLabel,
      // Outlook yalnızca biçimlendirilmiş tarih gösteriyor; makinece okunur tarih yok.
      sentAt: null,
      sentAtText: header.sentAtText,
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
    subject:
      located.replyView === undefined
        ? labelText(queryFirst(located.root, 'subject'))
        : located.replyView.subject,
    // Bölme yanıt taslağını gösteriyorsa yanıtlanan mesaj, gösterilirken kaydedilen mesajdır.
    activeMessageKey: activeMessageKey(messages) ?? located.replyView?.replyingTo ?? null,
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
