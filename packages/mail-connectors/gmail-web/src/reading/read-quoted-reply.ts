import {
  appError,
  err,
  ok,
  type AbortSignalLike,
  type AppError,
  type MessageSnapshot,
  type Result,
  type ThreadRef,
  type ThreadSnapshot,
} from '@writehand/contracts';
import { extractTextBlocks, type ElementRole } from '@writehand/mail-dom';

import { queryFirst } from '../discovery/selectors';
import { READ_LIMITS } from './read-thread';

/** A reply draft that names its conversation but is not inside the open conversation. */
export interface QuotedReply {
  readonly editor: HTMLElement;
  readonly container: HTMLElement | null;
  /** The replied-to message's key, the same as when its conversation is open. */
  readonly messageKey: string | null;
}

export interface ReadQuotedReplyDependencies {
  readonly classify: (element: Element) => ElementRole;
  /** The reply as it is on the page now; `null` once it is gone. */
  readonly currentReply: () => QuotedReply | null;
  readonly threadRevision: () => number;
  readonly now: () => string;
  readonly wait: (ms: number) => Promise<void>;
  /** How long to wait for Gmail to load the trimmed quote after its toggle is pressed. */
  readonly quoteWaitMs: number;
}

const QUOTE_POLL_MS = 100;

const hasQuote = (reply: QuotedReply) => queryFirst(reply.editor, 'quoteStart') !== null;

/**
 * A reply opened from the message list, without opening the email: the conversation is not on
 * the page, and Gmail keeps the replied-to message trimmed behind the draft's "•••" toggle and
 * loads it only when the toggle is pressed. Reading this reply's context is what the user asked
 * for, so the toggle is pressed, as the user would; Gmail keeps that quote in the reply either
 * way. Only the recognized quote crosses the context boundary; the user's text and signature do
 * not. The quoted chain stays one context item with unknown sender and date: localized
 * "On …, … wrote:" lines are not reliable message or identity delimiters.
 */
export async function readQuotedReply(
  ref: ThreadRef,
  signal: AbortSignalLike,
  deps: ReadQuotedReplyDependencies,
): Promise<Result<ThreadSnapshot, AppError>> {
  let reply = deps.currentReply();
  if (reply === null) {
    return err(appError('THREAD_CHANGED'));
  }
  const toggle = reply.container === null ? null : queryFirst(reply.container, 'trimmedContentToggle');
  if (!hasQuote(reply) && toggle !== null) {
    toggle.click();
    for (let waited = 0; waited < deps.quoteWaitMs && !hasQuote(reply); waited += QUOTE_POLL_MS) {
      await deps.wait(QUOTE_POLL_MS);
      if (signal.aborted) return err(appError('READ_CANCELLED'));
      reply = deps.currentReply();
      if (reply === null) return err(appError('THREAD_CHANGED'));
    }
  }
  if (signal.aborted) {
    return err(appError('READ_CANCELLED'));
  }

  const extraction = extractTextBlocks(reply.editor, {
    classify: deps.classify,
    maxLength: READ_LIMITS.maxTextLength,
  });
  const blocks = extraction.truncated
    ? []
    : extraction.blocks
        .filter((block) => block.kind === 'quote' && block.text.trim() !== '')
        .map(({ text }) => ({ kind: 'unknown' as const, certainty: 'uncertain' as const, text }));
  const messages: MessageSnapshot[] =
    blocks.length > 0 && reply.messageKey !== null
      ? [
          {
            messageKey: reply.messageKey,
            senderLabel: null,
            sentAt: null,
            sentAtText: null,
            displayOrder: 0,
            blocks,
          },
        ]
      : [];
  // Gmail did not load the quote: the replied-to message is known to exist but was not read.
  const unread = messages.length === 0 ? 1 : 0;

  return ok({
    ref,
    revision: deps.threadRevision(),
    capturedAt: deps.now(),
    // The reply's own subject ("Re: …"); context grouping ignores the prefix.
    subject:
      reply.container
        ?.querySelector<HTMLInputElement>('input[name="subject"]')
        ?.value.replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200) || null,
    activeMessageKey: messages[0]?.messageKey ?? null,
    messages,
    coverage: {
      source: 'visible-dom',
      status: 'partial',
      readableMessageCount: messages.length,
      knownUnreadableMessageCount: unread > 0 ? unread : null,
      reasons: unread > 0 ? ['unverified-history', 'collapsed-messages'] : ['unverified-history'],
    },
  });
}
