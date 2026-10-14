import { appError, err, ok, type AppError, type Result } from '@email-writer/contracts';

import type { SessionState } from '../session/session-state';

/**
 * "Son uygulamayı geri al" yalnızca eklentinin son doğrulanmış yazmasını
 * hedefler. Kullanıcı araya yeni bir düzenleme yaptıysa geri alma kapanır;
 * böylece kullanıcının sonradan yazdıkları kaybolmaz.
 */
export function validateUndo(state: SessionState): Result<{ undoId: string }, AppError> {
  const change = state.lastChange;
  if (change === null || change.outcome !== 'applied' || change.undoId === null) {
    return err(appError('UNDO_INVALID'));
  }
  if (
    state.staleReason === 'composer-removed' ||
    state.staleReason === 'thread-changed' ||
    state.staleReason === 'account-changed'
  ) {
    return err(appError('UNDO_INVALID'));
  }
  if (state.targetComposerRevision !== change.composerRevisionAfter) {
    return err(appError('UNDO_INVALID'));
  }
  return ok({ undoId: change.undoId });
}
