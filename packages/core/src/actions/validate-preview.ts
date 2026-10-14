import {
  appError,
  previewCandidateSchema,
  type AppError,
  type PreparedAction,
  type PreviewCandidate,
} from '@email-writer/contracts';

import { ACTION_LIMITS } from './action-limits';

export type PreviewDecision =
  | { readonly status: 'accepted'; readonly candidate: PreviewCandidate }
  /** Başka veya eski bir işleme ait; sessizce yok sayılır. */
  | { readonly status: 'ignored' }
  | { readonly status: 'rejected'; readonly error: AppError };

/**
 * Gelen sonucun güncel işleme ait olduğunu ve boyutunun uygun olduğunu
 * doğrular. Kimlikleri tutmayan sonuç önizlemeye alınmaz; HTML olarak
 * yorumlanmaz, yalnızca düz metin kabul edilir.
 */
export function validatePreviewCandidate(
  input: unknown,
  currentAction: PreparedAction | null,
): PreviewDecision {
  const parsed = previewCandidateSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'rejected', error: appError('RESULT_INVALID', { field: 'preview' }) };
  }
  const candidate = parsed.data;

  if (
    currentAction === null ||
    candidate.requestId !== currentAction.requestId ||
    candidate.sessionId !== currentAction.sessionId ||
    candidate.formRevision !== currentAction.formRevision
  ) {
    return { status: 'ignored' };
  }

  if (candidate.text.trim().length === 0) {
    return { status: 'rejected', error: appError('RESULT_INVALID', { field: 'preview' }) };
  }
  if (candidate.text.length > ACTION_LIMITS.maxPreviewLength) {
    return {
      status: 'rejected',
      error: appError('RESULT_INVALID', {
        field: 'preview',
        details: { limit: ACTION_LIMITS.maxPreviewLength, length: candidate.text.length },
      }),
    };
  }
  return { status: 'accepted', candidate };
}
