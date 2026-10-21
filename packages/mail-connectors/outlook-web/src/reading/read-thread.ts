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

import { messageBodies, type LocatedThread } from '../discovery/locate-thread';
import { queryAll, queryFirst } from '../discovery/selectors';
import type { IdentityRegistry } from '../identity/identity-registry';
import { extractTextBlocks, type ElementRole } from './extract-text-blocks';
import { labelText, messageContainerOf, messageKeyOf, readMessageHeader } from './message-header';

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
 * Returns the active message only when it can be determined safely: a single
 * expanded message. Outlook exposes no machine-readable date, so with several
 * expanded messages the newest is not guessed; the user picks.
 */
function activeMessageKey(messages: readonly MessageSnapshot[]): string | null {
  return messages.length === 1 ? (messages[0]?.messageKey ?? null) : null;
}

/**
 * Reads only the accessible messages of the requested conversation. Collapsed
 * or unloaded messages do not count as read; the extension does not press "show
 * earlier messages", scroll the page or open attachments. If the conversation
 * changes mid-read, the partial result is discarded.
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

  const quoteEditor = located.replyView?.quoteEditor;
  const quoteKey = located.replyView?.replyingTo;
  if (quoteEditor !== undefined && quoteKey != null) {
    await deps.yieldToBrowser();
    if (signal.aborted) return err(appError('READ_CANCELLED'));
    if (!quoteEditor.isConnected || !isCurrent()) return err(appError('THREAD_CHANGED'));
    const extraction = extractTextBlocks(quoteEditor, { classify: deps.classify, maxLength: budget });
    if (extraction.truncated) {
      skippedByLimit += 1;
    } else {
      // Only the recognized quote crosses the context boundary. The user's draft and
      // signature are not conversation messages. Keep the quoted chain together:
      // localized From/Sent headers are not reliable message or identity delimiters.
      const blocks = extraction.blocks
        .filter((block) => block.kind === 'quote' && block.text.trim() !== '')
        .map(({ text }) => ({ kind: 'unknown' as const, certainty: 'uncertain' as const, text }));
      if (blocks.length > 0) {
        budget -= blocks.reduce((total, block) => total + block.text.length, 0);
        messages.push({
          messageKey: quoteKey,
          senderLabel: null,
          sentAt: null,
          sentAtText: null,
          displayOrder: 0,
          blocks,
        });
      }
    }
  }

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
      // Outlook only shows a formatted date; there is no machine-readable one.
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
    // If the pane shows a reply draft, the replied-to message is the one recorded while it was shown.
    activeMessageKey: activeMessageKey(messages) ?? located.replyView?.replyingTo ?? null,
    messages,
    coverage: {
      source: 'visible-dom',
      status: 'partial',
      readableMessageCount: messages.length,
      // If collapsed rows cannot be recognized, no count is made up.
      knownUnreadableMessageCount: knownUnreadable > 0 ? knownUnreadable : null,
      reasons,
    },
  });
}
