import {
  appError,
  OPERATIONS,
  type AppError,
  type ApplyTarget,
  type ContextSnapshot,
  type LanguageCode,
  type Operation,
  type SourceOrigin,
  type Tone,
} from '@email-writer/contracts';

import { ACTION_LIMITS } from './action-limits';

/** Panelden veya hızlı düğmeden gelen, henüz doğrulanmamış işlem girdisi. */
export interface ActionDraft {
  readonly operation: Operation;
  readonly source: { readonly origin: SourceOrigin; readonly text: string };
  readonly instruction: string;
  readonly targetLanguage: LanguageCode | null;
  readonly tone: Tone;
  readonly context: ContextSnapshot | null;
  readonly target: ApplyTarget | null;
}

function isBlank(text: string): boolean {
  // Boşluk kontrolü kopya üzerinde yapılır; asıl metin değiştirilmez.
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
 * Hızlı düğmeler ve panel aynı kuralları kullanır. Bütün alan hatalarını
 * birlikte döndürür; boş liste girdinin geçerli olduğu anlamına gelir.
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
      if (draft.targetLanguage === null) {
        errors.push(appError('LANGUAGE_REQUIRED', { field: 'targetLanguage' }));
      }
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
