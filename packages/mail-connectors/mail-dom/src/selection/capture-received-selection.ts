import {
  appError,
  err,
  ok,
  type AppError,
  type ReceivedMessageSelection,
  type Result,
  type ThreadRef,
} from '@writehand/contracts';

import { extractTextBlocks } from '../extract-text-blocks';

export interface ReceivedSelectionSources {
  readonly ref: ThreadRef;
  /** Bodies of the messages shown in the open conversation. */
  readonly bodies: readonly HTMLElement[];
  /** The key of the message a body belongs to, as `readThread` reports it. */
  readonly messageKeyOf: (body: HTMLElement) => string;
}

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
  sources: ReceivedSelectionSources,
): Result<ReceivedMessageSelection | null, AppError> {
  const selection = document.getSelection();
  if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) {
    return ok(null);
  }
  const range = selection.getRangeAt(0);
  const startBody = bodyContaining(sources.bodies, range.startContainer);
  const endBody = bodyContaining(sources.bodies, range.endContainer);
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
  return ok({ threadRef: sources.ref, messageKey: sources.messageKeyOf(startBody), text });
}
