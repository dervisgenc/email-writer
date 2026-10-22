import type { ComposerRef } from '@writehand/contracts';

/**
 * Undo records stay in the connector's memory and are never written to storage.
 * Only the extension's last change is kept per draft.
 */
export interface UndoRecord {
  readonly undoId: string;
  readonly applyOperationId: string;
  readonly composerRef: ComposerRef;
  /** Editor revision after the apply; undo is only possible at this revision. */
  readonly revisionAfter: number;
  /** Start of the changed part within the editable text. */
  readonly start: number;
  /** Text in that part after the apply. */
  readonly insertedText: string;
  /** Text in that part before the apply (restored as plain text). */
  readonly previousText: string;
  readonly editableTextBefore: string;
  readonly protectedText: string;
}

export interface UndoStore {
  /** A new record replaces the previous record for the same draft. */
  save(record: UndoRecord): void;
  find(undoId: string): UndoRecord | null;
  remove(undoId: string): void;
  forgetComposer(composerKey: string): void;
  clear(): void;
}

export function createUndoStore(): UndoStore {
  const byComposer = new Map<string, UndoRecord>();

  return {
    save(record) {
      byComposer.set(record.composerRef.composerKey, record);
    },
    find(undoId) {
      for (const record of byComposer.values()) {
        if (record.undoId === undoId) {
          return record;
        }
      }
      return null;
    },
    remove(undoId) {
      for (const [key, record] of byComposer) {
        if (record.undoId === undoId) {
          byComposer.delete(key);
        }
      }
    },
    forgetComposer(composerKey) {
      byComposer.delete(composerKey);
    },
    clear() {
      byComposer.clear();
    },
  };
}
