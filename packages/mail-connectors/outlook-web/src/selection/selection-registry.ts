/**
 * Selection records kept in the connector's private memory. `DraftSelection`
 * only carries an id and offsets outward; validation uses these records.
 */
export interface SelectionRecord {
  readonly selectionId: string;
  readonly composerKey: string;
  readonly revision: number;
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export interface SelectionRegistry {
  register(record: SelectionRecord): void;
  get(selectionId: string): SelectionRecord | null;
  /** When an editor changes or is removed, its selections become invalid. */
  forgetComposer(composerKey: string): void;
  clear(): void;
}

/** Maximum selection records kept per editor; older records are dropped. */
const MAX_RECORDS_PER_COMPOSER = 5;

export function createSelectionRegistry(): SelectionRegistry {
  const records = new Map<string, SelectionRecord>();

  return {
    register(record) {
      records.set(record.selectionId, record);
      const forComposer = [...records.values()].filter((r) => r.composerKey === record.composerKey);
      for (const stale of forComposer.slice(0, Math.max(0, forComposer.length - MAX_RECORDS_PER_COMPOSER))) {
        records.delete(stale.selectionId);
      }
    },
    get(selectionId) {
      return records.get(selectionId) ?? null;
    },
    forgetComposer(composerKey) {
      for (const [id, record] of records) {
        if (record.composerKey === composerKey) {
          records.delete(id);
        }
      }
    },
    clear() {
      records.clear();
    },
  };
}
