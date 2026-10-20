import {
  appError,
  err,
  ok,
  type AppError,
  type ReceivedMessageSelection,
  type Result,
  type ThreadRef,
} from '@writehand/contracts';

import { messageBodies, type LocatedThread } from '../discovery/locate-thread';
import type { IdentityRegistry } from '../identity/identity-registry';
import { extractTextBlocks } from '../reading/extract-text-blocks';
import { messageContainerOf, messageKeyOf } from '../reading/message-header';

function bodyContaining(bodies: readonly HTMLElement[], node: Node): HTMLElement | null {
  return bodies.find((body) => body.contains(node)) ?? null;
}

/**
 * Returns the selection in a read-only received message, with the key of the
 * message it belongs to. This selection grants no right to write to that
 * message. A selection in the search box or elsewhere on the page is not
 * accepted as a source.
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
    // The selection spans two messages or extends outside the message.
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
    messageKey: messageKeyOf(messageContainerOf(startBody, thread.root), registry),
    text,
  });
}
