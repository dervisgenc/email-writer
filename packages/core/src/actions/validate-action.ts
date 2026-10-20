import {
  appError,
  OPERATIONS,
  type AppError,
  type ApplyTarget,
  type ContextSnapshot,
  type TargetLanguage,
  type Operation,
  type SourceOrigin,
  type Tone,
} from '@writehand/contracts';

import { ACTION_LIMITS } from './action-limits';

/** Not-yet-validated action input from the panel or a quick button. */
export interface ActionDraft {
  readonly operation: Operation;
  readonly source: { readonly origin: SourceOrigin; readonly text: string };
  readonly instruction: string;
  readonly targetLanguage: TargetLanguage | null;
  readonly tone: Tone;
  readonly context: ContextSnapshot | null;
  readonly target: ApplyTarget | null;
}

function isBlank(text: string): boolean {
  // The blank check runs on a copy; the original text is not modified.
  return text.trim().length === 0;
}

function validateSourceText(draft: ActionDraft, errors: AppError[]): void {
  if (isBlank(draft.source.text)) {
    errors.push(appError('SOURCE_EMPTY', { field: 'source' }));
  } else if (draft.source.text.length > ACTION_LIMITS.maxSourceLength) {
    errors.push(
      appError('SOURCE_TOO_LARGE', {
        field: 'source',
        details: { limit: ACTION_LIMITS.maxSourceLength, length: draft.source.text.length },
      }),
    );
  }
}

function validateInstruction(draft: ActionDraft, errors: AppError[]): void {
  if (isBlank(draft.instruction)) {
    errors.push(appError('SOURCE_EMPTY', { field: 'instruction' }));
  } else if (draft.instruction.length > ACTION_LIMITS.maxInstructionLength) {
    errors.push(
      appError('SOURCE_TOO_LARGE', {
        field: 'instruction',
        details: { limit: ACTION_LIMITS.maxInstructionLength, length: draft.instruction.length },
      }),
    );
  }
}

/**
 * Quick buttons and the panel share the same rules. Returns all field errors together;
 * an empty list means the input is valid.
 */
export function validateAction(draft: ActionDraft): AppError[] {
  const errors: AppError[] = [];

  if (!OPERATIONS.includes(draft.operation)) {
    errors.push(appError('UNEXPECTED'));
    return errors;
  }

  switch (draft.operation) {
    case 'revise':
      validateSourceText(draft, errors);
      break;
    case 'translate':
      validateSourceText(draft, errors);
      if (draft.targetLanguage === null) {
        errors.push(appError('LANGUAGE_REQUIRED', { field: 'targetLanguage' }));
      }
      break;
    case 'compose':
      // New email: needs an instruction, which also sets the language; no conversation context is needed.
      validateInstruction(draft, errors);
      break;
    case 'reply':
      validateInstruction(draft, errors);
      if (draft.source.text.length > ACTION_LIMITS.maxSourceLength) {
        errors.push(
          appError('SOURCE_TOO_LARGE', {
            field: 'source',
            details: { limit: ACTION_LIMITS.maxSourceLength, length: draft.source.text.length },
          }),
        );
      }
      // The reply uses the language of the message being replied to; the instruction may ask for another.
      if (
        draft.context === null ||
        draft.context.activeMessageKey === null ||
        draft.context.messages.length === 0
      ) {
        errors.push(appError('CONTEXT_REQUIRED', { field: 'context' }));
      }
      break;
  }

  return errors;
}
