import {
  appError,
  err,
  isInstructionOperation,
  MAX_REFINEMENT_LENGTH,
  ok,
  type AppError,
  type PreparedAction,
  type Refinement,
  type Result,
} from '@writehand/contracts';

import type { Clock, IdGenerator } from '../dependencies';
import { deepFreeze } from '../immutability';
import { ACTION_LIMITS } from './action-limits';
import { validateAction, type ActionDraft } from './validate-action';

export interface PrepareActionInput {
  readonly sessionId: string;
  readonly formRevision: number;
  readonly draft: ActionDraft;
  /** Request to change a finished result; without it the task is prepared from scratch. */
  readonly refinement?: Refinement | null;
}

export interface PrepareActionDependencies {
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/**
 * Validates the input and produces an immutable action record. Builds no UI text, reads
 * no DOM and writes no storage. Fields the operation does not use (target language for
 * revision, tone and instruction for translation) do not affect the record.
 */
export function prepareAction(
  input: PrepareActionInput,
  dependencies: PrepareActionDependencies,
): Result<PreparedAction, readonly AppError[]> {
  const { draft } = input;
  const errors = validateAction(draft);
  const refinement = input.refinement ?? null;
  if (refinement !== null) {
    const instruction = refinement.instruction.trim();
    if (instruction === '' || instruction.length > MAX_REFINEMENT_LENGTH) {
      errors.push(appError('SOURCE_EMPTY', { field: 'instruction' }));
    }
    if (refinement.previous.trim() === '' || refinement.previous.length > ACTION_LIMITS.maxPreviewLength) {
      errors.push(appError('RESULT_INVALID', { field: 'preview' }));
    }
  }
  if (errors.length > 0) {
    return err(errors);
  }

  const usesInstruction = isInstructionOperation(draft.operation);
  // Translating a received message is read-only; no draft target is assigned.
  const target = draft.source.origin === 'received-message' ? null : draft.target;

  return ok(
    deepFreeze({
      requestId: dependencies.ids.next(),
      sessionId: input.sessionId,
      formRevision: input.formRevision,
      operation: draft.operation,
      source: { origin: draft.source.origin, text: draft.source.text },
      instruction: usesInstruction ? draft.instruction : '',
      // Only translation uses a target language; replies and new emails follow the language
      // of the conversation or the instruction.
      targetLanguage: draft.operation === 'translate' ? draft.targetLanguage : null,
      tone: draft.operation === 'translate' ? 'neutral' : draft.tone,
      context: draft.context,
      target,
      refinement:
        refinement === null
          ? null
          : { instruction: refinement.instruction.trim(), previous: refinement.previous },
      createdAt: dependencies.clock.now(),
    }),
  );
}
