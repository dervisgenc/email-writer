import {
  appError,
  err,
  isSameScope,
  isSameThread,
  ok,
  type AppError,
  type BlockRef,
  type ContextEdit,
  type ContextMessage,
  type ContextOmission,
  type ContextSelection,
  type ContextSnapshot,
  type MessageSnapshot,
  type Result,
  type ThreadRef,
  type ThreadSnapshot,
} from '@writehand/contracts';

import type { Clock, IdGenerator } from '../dependencies';
import { deepFreeze } from '../immutability';
import { DEFAULT_CONTEXT_POLICY, type ContextPolicy } from './context-policy';
import { isRelatedEntry, type HistoryEntry } from './message-history';
import { normalizeContextText } from './normalize-text';
import { orderMessages } from './order-messages';
import { isDuplicateQuote, quotableLineSequences } from './remove-duplicate-quotes';

export interface BuildContextInput {
  /** The conversation the session is bound to. If the snapshot belongs to another scope, the action stops. */
  readonly expectedThread: ThreadRef;
  /** Latest read of the open conversation; the active message and coverage come from here. */
  readonly snapshot: ThreadSnapshot;
  /**
   * Messages read earlier in this page session. Those from the same conversation or with
   * the same subject join the context by default; others join only if the user adds them.
   * Messages from another account are never used.
   */
  readonly history?: readonly HistoryEntry[];
  readonly selection: ContextSelection;
  /** Automatically removed signature/quote blocks that the user brought back. */
  readonly includedBlocks: readonly BlockRef[];
  /** Message texts the user edited in the context panel. */
  readonly edits?: readonly ContextEdit[];
  /**
   * Reply target the user picked explicitly when the connector could not identify the
   * active message. The snapshot's own active message takes precedence if present.
   */
  readonly replyTargetKey?: string | null;
  readonly policy?: ContextPolicy;
}

export interface BuildContextDependencies {
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

const BLOCK_SEPARATOR = '\n\n';

/** A message that may join the context, and which conversation it came from. */
interface Candidate {
  readonly message: MessageSnapshot;
  readonly subject: string | null;
  readonly conversation: ContextMessage['conversation'];
}

interface RenderOptions {
  readonly reincluded: ReadonlySet<string>;
  readonly edits: ReadonlyMap<string, string>;
}

interface RenderedSet {
  readonly messages: ContextMessage[];
  readonly omissions: ContextOmission[];
  readonly totalLength: number;
}

function blockKey(messageKey: string, blockIndex: number): string {
  return `${messageKey}\u0000${blockIndex}`;
}

/**
 * Turns the selected set of messages into context text. Duplicate quotes are judged
 * against the other messages in the set, so the quote of a message left out is not
 * dropped as "already in context". Text the user edited is taken as is (normalized).
 */
function renderMessages(candidates: readonly Candidate[], options: RenderOptions): RenderedSet {
  const sequencesByMessage = new Map(
    candidates.map(({ message }) => [message.messageKey, quotableLineSequences(message)] as const),
  );
  const rendered: ContextMessage[] = [];
  const omissions: ContextOmission[] = [];
  let totalLength = 0;

  for (const { message, subject, conversation } of candidates) {
    const edited = options.edits.get(message.messageKey);
    let text: string;
    if (edited !== undefined) {
      text = normalizeContextText(edited).trim();
    } else {
      const otherSequences = candidates
        .filter(({ message: other }) => other.messageKey !== message.messageKey)
        .flatMap(({ message: other }) => sequencesByMessage.get(other.messageKey) ?? []);
      const kept: string[] = [];
      message.blocks.forEach((block, blockIndex) => {
        const isReincluded = options.reincluded.has(blockKey(message.messageKey, blockIndex));
        if (!isReincluded && block.certainty === 'certain') {
          if (block.kind === 'signature') {
            omissions.push({ messageKey: message.messageKey, blockIndex, reason: 'signature' });
            return;
          }
          if (block.kind === 'quote' && isDuplicateQuote(block.text, otherSequences)) {
            omissions.push({ messageKey: message.messageKey, blockIndex, reason: 'duplicate-quote' });
            return;
          }
        }
        const blockText = normalizeContextText(block.text);
        if (blockText.length > 0) {
          kept.push(blockText);
        }
      });
      text = kept.join(BLOCK_SEPARATOR);
    }

    totalLength += text.length;
    rendered.push({
      messageKey: message.messageKey,
      senderLabel: message.senderLabel,
      sentAt: message.sentAt,
      sentAtText: message.sentAtText,
      subject,
      conversation,
      edited: edited !== undefined,
      text,
    });
  }

  return { messages: rendered, omissions, totalLength };
}

function removeDuplicateMessages(messages: readonly MessageSnapshot[]): {
  unique: MessageSnapshot[];
  omissions: ContextOmission[];
} {
  const seen = new Set<string>();
  const unique: MessageSnapshot[] = [];
  const omissions: ContextOmission[] = [];
  for (const message of messages) {
    if (seen.has(message.messageKey)) {
      omissions.push({ messageKey: message.messageKey, reason: 'duplicate-message' });
    } else {
      seen.add(message.messageKey);
      unique.push(message);
    }
  }
  return { unique, omissions };
}

/**
 * Collects the open conversation's messages and the history messages into one list.
 * If a message appears in both, the current read wins. Order: first-read order from the
 * history, then the display order of current messages not yet in the history.
 */
function collectCandidates(
  snapshot: ThreadSnapshot,
  unique: readonly MessageSnapshot[],
  history: readonly HistoryEntry[],
): Candidate[] {
  const current = new Set(unique.map((message) => message.messageKey));
  const sameAccount = history.filter((entry) => isSameScope(entry.threadRef.scope, snapshot.ref.scope));
  const historyOrder = new Map(sameAccount.map((entry) => [entry.message.messageKey, entry.order]));
  const afterHistory = Math.max(-1, ...historyOrder.values()) + 1;

  const ranked = [
    ...unique.map((message) => ({
      rank: historyOrder.get(message.messageKey) ?? afterHistory + message.displayOrder,
      candidate: { message, subject: snapshot.subject, conversation: 'current' as const },
    })),
    ...sameAccount
      .filter((entry) => !current.has(entry.message.messageKey))
      .map((entry) => ({
        rank: entry.order,
        candidate: {
          message: entry.message,
          subject: entry.subject,
          conversation: isRelatedEntry(entry, snapshot.ref, snapshot.subject)
            ? ('current' as const)
            : ('other' as const),
        },
      })),
  ].sort((a, b) => a.rank - b.rank);

  // Display orders from different reads are not comparable; the merged order is renumbered.
  return ranked.map(({ candidate }, displayOrder) => ({
    ...candidate,
    message: { ...candidate.message, displayOrder },
  }));
}

/** Orders by synthetic or real dates; candidate metadata is kept. */
function orderCandidates(candidates: readonly Candidate[]) {
  const byMessage = new Map(candidates.map((candidate) => [candidate.message, candidate]));
  const { ordered, ordering } = orderMessages(candidates.map((candidate) => candidate.message));
  return {
    ordered: ordered.flatMap((message) => byMessage.get(message) ?? []),
    ordering,
  };
}

/** Puts the active message first, then older messages from nearest to farthest, then newer ones. */
function rankByProximity(ordered: readonly Candidate[], activeMessageKey: string | null): Candidate[] {
  const activeIndex = ordered.findIndex(({ message }) => message.messageKey === activeMessageKey);
  const anchor = activeIndex >= 0 ? activeIndex : ordered.length - 1;
  return [...ordered.slice(0, anchor + 1).reverse(), ...ordered.slice(anchor + 1)];
}

function tooLarge(details: Record<string, number>): AppError {
  return appError('CONTEXT_TOO_LARGE', { field: 'context', details });
}

/**
 * Applies the selection and enforces the limits. Messages the user explicitly added from
 * other conversations are never silently trimmed (an error is returned if they do not fit).
 * Default messages are taken by proximity to the active message, up to the limit.
 */
function selectCandidates(
  ordered: readonly Candidate[],
  input: { selection: ContextSelection; activeMessageKey: string | null; policy: ContextPolicy },
  options: RenderOptions,
): Result<{ included: Candidate[]; omissions: ContextOmission[] }, AppError> {
  const excluded = new Set(input.selection.excluded);
  const added = new Set(input.selection.included);
  const omissions: ContextOmission[] = [];
  const explicit: Candidate[] = [];
  const defaults: Candidate[] = [];

  for (const candidate of ordered) {
    const key = candidate.message.messageKey;
    if (excluded.has(key)) {
      if (candidate.conversation === 'current') {
        omissions.push({ messageKey: key, reason: 'user-excluded' });
      }
    } else if (candidate.conversation === 'current') {
      defaults.push(candidate);
    } else if (added.has(key)) {
      explicit.push(candidate);
    }
  }

  if (explicit.length === 0 && defaults.length === 0) {
    return err(appError('CONTEXT_REQUIRED', { field: 'context' }));
  }
  const { policy } = input;
  if (explicit.length > policy.maxMessages) {
    return err(tooLarge({ limit: policy.maxMessages, count: explicit.length }));
  }
  const explicitLength = renderMessages(explicit, options).totalLength;
  if (explicitLength > policy.maxTotalLength) {
    return err(tooLarge({ limit: policy.maxTotalLength, length: explicitLength }));
  }

  const included = [...explicit];
  const ranked = rankByProximity(defaults, input.activeMessageKey);
  for (const [index, candidate] of ranked.entries()) {
    if (included.length >= policy.maxMessages) {
      for (const rest of ranked.slice(index)) {
        omissions.push({ messageKey: rest.message.messageKey, reason: 'message-limit' });
      }
      break;
    }
    const { totalLength } = renderMessages([...included, candidate], options);
    if (totalLength > policy.maxTotalLength) {
      if (included.length === 0) {
        // The active message alone does not fit: never truncate it silently.
        return err(tooLarge({ limit: policy.maxTotalLength, length: totalLength }));
      }
      for (const rest of ranked.slice(index)) {
        omissions.push({ messageKey: rest.message.messageKey, reason: 'size-limit' });
      }
      break;
    }
    included.push(candidate);
  }

  return ok({ included, omissions });
}

/**
 * Builds an immutable context from the open conversation and related messages read in the
 * session, according to the selection and the policy. Makes no network requests and writes
 * no new sentences. IDs and the clock are injected, so the same input yields the same content.
 */
export function buildContext(
  input: BuildContextInput,
  dependencies: BuildContextDependencies,
): Result<ContextSnapshot, AppError> {
  const policy = input.policy ?? DEFAULT_CONTEXT_POLICY;
  const { snapshot } = input;

  if (!isSameThread(input.expectedThread, snapshot.ref)) {
    return err(appError('THREAD_CHANGED', { field: 'context' }));
  }

  const { unique, omissions: duplicateOmissions } = removeDuplicateMessages(snapshot.messages);
  const candidates = collectCandidates(snapshot, unique, input.history ?? []);
  if (candidates.length === 0) {
    return err(appError('CONTEXT_REQUIRED', { field: 'context' }));
  }

  const activeMessageKey = snapshot.activeMessageKey ?? input.replyTargetKey ?? null;
  const options: RenderOptions = {
    reincluded: new Set(input.includedBlocks.map((block) => blockKey(block.messageKey, block.blockIndex))),
    edits: new Map((input.edits ?? []).map((edit) => [edit.messageKey, edit.text])),
  };
  const selection = selectCandidates(
    orderCandidates(candidates).ordered,
    { selection: input.selection, activeMessageKey, policy },
    options,
  );
  if (!selection.ok) {
    return selection;
  }

  const { ordered, ordering } = orderCandidates(selection.value.included);
  const rendered = renderMessages(ordered, options);
  const includedKeys = new Set(ordered.map(({ message }) => message.messageKey));

  return ok(
    deepFreeze({
      contextId: dependencies.ids.next(),
      threadRef: snapshot.ref,
      threadRevision: snapshot.revision,
      activeMessageKey:
        activeMessageKey !== null && includedKeys.has(activeMessageKey) ? activeMessageKey : null,
      ordering,
      messages: rendered.messages,
      coverage: { ...snapshot.coverage, reasons: [...snapshot.coverage.reasons] },
      omissions: [...duplicateOmissions, ...selection.value.omissions, ...rendered.omissions],
      policyVersion: policy.version,
      createdAt: dependencies.clock.now(),
    }),
  );
}
