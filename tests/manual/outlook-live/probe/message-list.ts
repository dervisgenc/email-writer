import { maskIdentifier, maskText } from './mask-text';

/**
 * İleti listesindeki konuşma satırları. Liste, konuşma okumanın parçası
 * değildir (bağlantı modülü listeyi okumaz); bu yüzden seçici burada,
 * yalnızca inceleme aracında durur ve gerçek yapı görüldükçe güncellenir.
 */
export const DEFAULT_ROW_SELECTOR = '[role="listbox"] [role="option"]';

export interface RowReport {
  readonly index: number;
  readonly selected: boolean;
  readonly conversationId: string | null;
  readonly shape: string;
}

export function conversationRows(document: Document, selector = DEFAULT_ROW_SELECTOR): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(selector));
}

export function describeRows(document: Document, selector = DEFAULT_ROW_SELECTOR): RowReport[] {
  return conversationRows(document, selector).map((row, index) => {
    const conversationId = row.getAttribute('data-convid');
    return {
      index,
      selected: row.getAttribute('aria-selected') === 'true',
      conversationId: conversationId === null ? null : maskIdentifier(conversationId),
      shape: maskText(row.innerText.replace(/\s+/g, ' ').trim(), 60),
    };
  });
}
