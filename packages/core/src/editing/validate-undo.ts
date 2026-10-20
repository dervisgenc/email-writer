import { appError, err, ok, type AppError, type Result } from '@writehand/contracts';

import type { SessionState } from '../session/session-state';

/**
 * "Undo last apply" targets only the extension's last verified write. If the user edited
 * the draft in between, undo is disabled so that what they wrote afterwards is not lost.
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
