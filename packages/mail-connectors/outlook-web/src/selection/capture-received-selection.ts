import {
  appError,
  err,
  ok,
  type AppError,
  type ReceivedMessageSelection,
  type Result,
  type ThreadRef,
} from '@email-writer/contracts';

import { messageBodies, type LocatedThread } from '../discovery/locate-thread';
import type { IdentityRegistry } from '../identity/identity-registry';
import { extractTextBlocks } from '../reading/extract-text-blocks';
import { messageContainerOf } from '../reading/read-thread';

function bodyContaining(bodies: readonly HTMLElement[], node: Node): HTMLElement | null {
  return bodies.find((body) => body.contains(node)) ?? null;
}

/**
 * Salt okunur gelen mesajdaki seçimi, ait olduğu mesajın kimliğiyle verir.
 * Bu seçim o mesaja yazma hakkı oluşturmaz. Arama kutusu veya sayfanın başka
 * bir bölümündeki seçim kaynak kabul edilmez.
 */
export function captureReceivedSelection(
  document: Document,
  thread: LocatedThread,
  ref: ThreadRef,
  registry: IdentityRegistry,
): Result<ReceivedMessageSelection | null, AppError> {
  const selection = document.getSelection();
  if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) {
    return ok(null);
  }
  const range = selection.getRangeAt(0);
  const bodies = messageBodies(thread.root);
  const startBody = bodyContaining(bodies, range.startContainer);
  const endBody = bodyContaining(bodies, range.endContainer);
  if (startBody === null && endBody === null) {
    return ok(null);
  }
  if (startBody === null || startBody !== endBody) {
    // Seçim iki mesaja veya mesaj dışına taşıyor.
    return err(appError('SELECTION_INVALID', { field: 'source' }));
  }

  const text = extractTextBlocks(range.cloneContents())
    .blocks.map((block) => block.text)
    .join('\n\n');
  if (text.trim() === '') {
    return ok(null);
  }
  return ok({
    threadRef: ref,
    messageKey: registry.keyFor(messageContainerOf(startBody), 'msg'),
    text,
  });
}
