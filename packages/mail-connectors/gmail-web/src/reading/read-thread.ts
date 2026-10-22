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
} from '@writehand/contracts';
import { extractTextBlocks, labelText, type ElementRole, type IdentityRegistry } from '@writehand/mail-dom';

import { collapsedMessages, messageBodies, type LocatedThread } from '../discovery/locate-thread';
import { queryFirst } from '../discovery/selectors';
import { messageContainerOf, messageKeyOf, readMessageHeader } from './message-header';

/** Initial read budget; not a measured product limit. */
export const READ_LIMITS = Object.freeze({ maxMessages: 100, maxTextLength: 250_000 });

export interface ReadThreadDependencies {
  readonly registry: IdentityRegistry;
  readonly classify: (element: Element) => ElementRole;
  readonly currentThread: () => LocatedThread | null;
  readonly threadRevision: () => number;
  readonly now: () => string;
  /** Yields to the browser to split a long walk into chunks. */
  readonly yieldToBrowser: () => Promise<void>;
}

/**
 * The message being replied to, only when it is certain: a single expanded message. Gmail shows
 * no machine-readable date, so with several expanded messages the user picks.
 */
function activeMessageKey(messages: readonly MessageSnapshot[]): string | null {
  return messages.length === 1 ? (messages[0]?.messageKey ?? null) : null;
}

/**
 * Reads only the expanded messages of the requested conversation. Collapsed messages do not
 * count as read; the extension does not expand them, press "show trimmed content", scroll or
 * open attachments. If the conversation changes mid-read, the partial result is discarded.
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
      // A message cut short by the limit is not passed on as if it were complete.
      skippedByLimit += 1;
      continue;
    }
    budget -= extraction.blocks.reduce((total, block) => total + block.text.length, 0);
    const header = readMessageHeader(container, body);
    messages.push({
      messageKey: messageKeyOf(container, deps.registry),
      senderLabel: header.senderLabel,
      sentAt: null,
      sentAtText: header.sentAtText,
      displayOrder: index,
      blocks: extraction.blocks.map(({ kind, certainty, text }) => ({ kind, certainty, text })),
    });
  }

  if (!isCurrent()) {
    return err(appError('THREAD_CHANGED'));
  }

  const collapsed = collapsedMessages(located.root);
  const reasons: CoverageReason[] = ['unverified-history'];
  if (collapsed > 0) {
    reasons.push('collapsed-messages');
  }
  if (skippedByLimit > 0) {
    reasons.push('read-limit');
  }
  const knownUnreadable = collapsed + skippedByLimit;

  return ok({
    ref,
    revision: deps.threadRevision(),
    capturedAt: deps.now(),
    subject: labelText(queryFirst(located.root, 'threadSubject')),
    activeMessageKey: activeMessageKey(messages),
    messages,
    coverage: {
      source: 'visible-dom',
      status: 'partial',
      readableMessageCount: messages.length,
      knownUnreadableMessageCount: knownUnreadable > 0 ? knownUnreadable : null,
      reasons,
    },
  });
}
