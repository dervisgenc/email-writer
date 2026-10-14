import type { ApplyTarget, Operation } from '@email-writer/contracts';

import type { SessionState, SourceBinding } from '../session/session-state';

/**
 * Kaynak kaydından güvenli yazma hedefini türetir. Panelde yazılmış metin veya
 * gelen mesaj, açık taslağın üzerine otomatik yazma yetkisi vermez. Yanıt
 * hazırlamada dolu bir taslağı değiştirmek ayrıca açık onay ister.
 */
export function deriveApplyTarget(binding: SourceBinding, operation: Operation): ApplyTarget | null {
  switch (binding.kind) {
    case 'draft-selection':
      return {
        mode: 'replace-selection',
        composerRef: binding.composerRef,
        expectedRevision: binding.composerRevision,
        selectionId: binding.selectionId,
      };
    case 'draft': {
      const isEmpty = binding.loadedText.trim().length === 0;
      if (isEmpty && binding.canInsertIntoEmptyBody) {
        return {
          mode: 'insert-empty',
          composerRef: binding.composerRef,
          expectedRevision: binding.composerRevision,
        };
      }
      if (!isEmpty && binding.canReplaceBody && operation !== 'reply') {
        return {
          mode: 'replace-body',
          composerRef: binding.composerRef,
          expectedRevision: binding.composerRevision,
        };
      }
      return null;
    }
    case 'panel':
    case 'received-message':
      return null;
  }
}

/** Yazmada kullanılacak güncel hedef. Tek sahibi oturumdur. */
export function effectiveApplyTarget(state: SessionState): ApplyTarget | null {
  if (state.binding.kind === 'received-message') {
    return null;
  }
  return state.explicitTarget ?? deriveApplyTarget(state.binding, state.form.operation);
}
