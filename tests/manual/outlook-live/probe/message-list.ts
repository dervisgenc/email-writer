import { maskIdentifier, maskText } from './mask-text';

/**
 * Conversation rows in the message list. The list is not part of conversation
 * reading (the connector does not read it), so the selector lives here, only in
 * the inspection tool, and is updated as the real structure is observed.
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
