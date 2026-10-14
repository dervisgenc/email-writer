import {
  appError,
  err,
  isSameThread,
  ok,
  type AppError,
  type BlockRef,
  type ContextMessage,
  type ContextOmission,
  type ContextSelection,
  type ContextSnapshot,
  type MessageSnapshot,
  type Result,
  type ThreadRef,
  type ThreadSnapshot,
} from '@email-writer/contracts';

import type { Clock, IdGenerator } from '../dependencies';
import { deepFreeze } from '../immutability';
import { DEFAULT_CONTEXT_POLICY, type ContextPolicy } from './context-policy';
import { normalizeContextText } from './normalize-text';
import { orderMessages } from './order-messages';
import { isDuplicateQuote, quotableLineSequences } from './remove-duplicate-quotes';

export interface BuildContextInput {
  /** Oturumun bağlı olduğu konuşma. Snapshot başka bir kapsama aitse işlem durur. */
  readonly expectedThread: ThreadRef;
  readonly snapshot: ThreadSnapshot;
  readonly selection: ContextSelection;
  /** Kullanıcının otomatik çıkarılan imza/alıntı bloklarından geri dahil ettikleri. */
  readonly includedBlocks: readonly BlockRef[];
  /**
   * Bağlantı modülü aktif mesajı tanıyamadığında kullanıcının açıkça seçtiği
   * yanıt hedefi. Snapshot'ın kendi aktif mesajı varsa o önceliklidir.
   */
  readonly replyTargetKey?: string | null;
  readonly policy?: ContextPolicy;
}

export interface BuildContextDependencies {
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

const BLOCK_SEPARATOR = '\n\n';

interface RenderedSet {
  readonly messages: ContextMessage[];
  readonly omissions: ContextOmission[];
  readonly totalLength: number;
}

function blockKey(messageKey: string, blockIndex: number): string {
  return `${messageKey}\u0000${blockIndex}`;
}

/**
 * Seçili mesaj kümesini bağlam metnine çevirir. Tekrar alıntı kararı kümedeki
 * diğer mesajlara göre verilir; böylece dışarıda kalan bir mesajın alıntısı
 * "zaten bağlamda" sayılıp silinmez.
 */
function renderMessages(messages: readonly MessageSnapshot[], reincluded: ReadonlySet<string>): RenderedSet {
  const sequencesByMessage = new Map(
    messages.map((message) => [message.messageKey, quotableLineSequences(message)] as const),
  );
  const rendered: ContextMessage[] = [];
  const omissions: ContextOmission[] = [];
  let totalLength = 0;

  for (const message of messages) {
    const otherSequences = messages
      .filter((other) => other.messageKey !== message.messageKey)
      .flatMap((other) => sequencesByMessage.get(other.messageKey) ?? []);
    const kept: string[] = [];

    message.blocks.forEach((block, blockIndex) => {
      const isReincluded = reincluded.has(blockKey(message.messageKey, blockIndex));
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
      const text = normalizeContextText(block.text);
      if (text.length > 0) {
        kept.push(text);
      }
    });

    const text = kept.join(BLOCK_SEPARATOR);
    totalLength += text.length;
    rendered.push({
      messageKey: message.messageKey,
      senderLabel: message.senderLabel,
      sentAt: message.sentAt,
      sentAtText: message.sentAtText,
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

/** Aktif mesajı en başa, ardından yakından uzağa önce eski sonra yeni mesajları koyar. */
function rankByProximity(ordered: readonly MessageSnapshot[], activeMessageKey: string | null) {
  const activeIndex = ordered.findIndex((message) => message.messageKey === activeMessageKey);
  const anchor = activeIndex >= 0 ? activeIndex : ordered.length - 1;
  return [...ordered.slice(0, anchor + 1).reverse(), ...ordered.slice(anchor + 1)];
}

function selectAutomatically(
  ranked: readonly MessageSnapshot[],
  policy: ContextPolicy,
  reincluded: ReadonlySet<string>,
): Result<{ included: MessageSnapshot[]; omissions: ContextOmission[] }, AppError> {
  const included: MessageSnapshot[] = [];
  const omissions: ContextOmission[] = [];

  for (const [index, message] of ranked.entries()) {
    if (included.length >= policy.maxMessages) {
      for (const rest of ranked.slice(index)) {
        omissions.push({ messageKey: rest.messageKey, reason: 'message-limit' });
      }
      break;
    }
    const trial = [...included, message];
    const { totalLength } = renderMessages(trial, reincluded);
    if (totalLength > policy.maxTotalLength) {
      if (included.length === 0) {
        // Aktif mesaj tek başına sığmıyor: sessizce kırpılmaz.
        return err(
          appError('CONTEXT_TOO_LARGE', {
            field: 'context',
            details: { limit: policy.maxTotalLength, length: totalLength },
          }),
        );
      }
      for (const rest of ranked.slice(index)) {
        omissions.push({ messageKey: rest.messageKey, reason: 'size-limit' });
      }
      break;
    }
    included.push(message);
  }

  return ok({ included, omissions });
}

function selectManually(
  ordered: readonly MessageSnapshot[],
  messageKeys: readonly string[],
  policy: ContextPolicy,
  reincluded: ReadonlySet<string>,
): Result<{ included: MessageSnapshot[]; omissions: ContextOmission[] }, AppError> {
  const chosen = new Set(messageKeys);
  const included = ordered.filter((message) => chosen.has(message.messageKey));
  const omissions: ContextOmission[] = ordered
    .filter((message) => !chosen.has(message.messageKey))
    .map((message) => ({ messageKey: message.messageKey, reason: 'user-excluded' as const }));

  if (included.length === 0) {
    return err(appError('CONTEXT_REQUIRED', { field: 'context' }));
  }
  // Kullanıcının açık seçimi habersizce daraltılmaz.
  if (included.length > policy.maxMessages) {
    return err(
      appError('CONTEXT_TOO_LARGE', {
        field: 'context',
        details: { limit: policy.maxMessages, count: included.length },
      }),
    );
  }
  const { totalLength } = renderMessages(included, reincluded);
  if (totalLength > policy.maxTotalLength) {
    return err(
      appError('CONTEXT_TOO_LARGE', {
        field: 'context',
        details: { limit: policy.maxTotalLength, length: totalLength },
      }),
    );
  }
  return ok({ included, omissions });
}

/**
 * Bir konuşma snapshot'ından, seçim ve politikaya göre değişmez bir bağlam
 * üretir. Ağ isteği yapmaz, yeni cümle üretmez. Kimlik ve saat dışarıdan
 * verildiği için aynı girdi aynı içerik sonucunu üretir.
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
  if (unique.length === 0) {
    return err(appError('CONTEXT_REQUIRED', { field: 'context' }));
  }

  const activeMessageKey = snapshot.activeMessageKey ?? input.replyTargetKey ?? null;
  const reincluded = new Set(
    input.includedBlocks.map((block) => blockKey(block.messageKey, block.blockIndex)),
  );
  const { ordered: chronological } = orderMessages(unique);
  const selection =
    input.selection.mode === 'manual'
      ? selectManually(chronological, input.selection.messageKeys, policy, reincluded)
      : selectAutomatically(rankByProximity(chronological, activeMessageKey), policy, reincluded);
  if (!selection.ok) {
    return selection;
  }

  const { ordered, ordering } = orderMessages(selection.value.included);
  const rendered = renderMessages(ordered, reincluded);
  const includedKeys = new Set(ordered.map((message) => message.messageKey));

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
