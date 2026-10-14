import type { ComposerRef } from '@email-writer/contracts';

/**
 * Geri alma kaydı bağlantı modülünün belleğinde kalır; depolamaya yazılmaz.
 * Taslak başına yalnızca son eklenti değişikliği tutulur.
 */
export interface UndoRecord {
  readonly undoId: string;
  readonly applyOperationId: string;
  readonly composerRef: ComposerRef;
  /** Uygulamadan sonraki editör sürümü; geri alma ancak bu sürümde yapılır. */
  readonly revisionAfter: number;
  /** Değişen bölümün düzenlenebilir metindeki başlangıcı. */
  readonly start: number;
  /** Uygulamadan sonra o bölümde bulunan metin. */
  readonly insertedText: string;
  /** Uygulamadan önce o bölümde bulunan metin (düz metin olarak geri gelir). */
  readonly previousText: string;
  readonly editableTextBefore: string;
  readonly protectedText: string;
}

export interface UndoStore {
  /** Yeni kayıt aynı taslağın önceki kaydının yerini alır. */
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
