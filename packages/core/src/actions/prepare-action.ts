import { err, ok, type AppError, type PreparedAction, type Result } from '@email-writer/contracts';

import type { Clock, IdGenerator } from '../dependencies';
import { deepFreeze } from '../immutability';
import { validateAction, type ActionDraft } from './validate-action';

export interface PrepareActionInput {
  readonly sessionId: string;
  readonly formRevision: number;
  readonly draft: ActionDraft;
}

export interface PrepareActionDependencies {
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/**
 * Girdiyi doğrular ve değişmez bir işlem kaydı üretir. UI metni üretmez,
 * DOM okumaz, depolamaya yazmaz. O işlemde kullanılmayan alanlar (düzeltmede
 * hedef dil, çeviride ton ve talimat) kayda etki etmez.
 */
export function prepareAction(
  input: PrepareActionInput,
  dependencies: PrepareActionDependencies,
): Result<PreparedAction, readonly AppError[]> {
  const { draft } = input;
  const errors = validateAction(draft);
  if (errors.length > 0) {
    return err(errors);
  }

  const isReply = draft.operation === 'reply';
  // Gelen mesajın çevirisi salt okunurdur; taslak hedefi atanmaz.
  const target = draft.source.origin === 'received-message' ? null : draft.target;

  return ok(
    deepFreeze({
      requestId: dependencies.ids.next(),
      sessionId: input.sessionId,
      formRevision: input.formRevision,
      operation: draft.operation,
      source: { origin: draft.source.origin, text: draft.source.text },
      instruction: isReply ? draft.instruction : '',
      targetLanguage: draft.operation === 'revise' ? null : draft.targetLanguage,
      tone: draft.operation === 'translate' ? 'neutral' : draft.tone,
      context: draft.context,
      target,
      createdAt: dependencies.clock.now(),
    }),
  );
}
