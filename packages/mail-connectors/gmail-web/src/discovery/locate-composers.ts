import { isEditableElement, isVisibleElement, outermostElements } from '@writehand/mail-dom';

import { closest, MISSING_ID_VALUES, queryAll, queryFirst } from './selectors';

export interface LocatedComposer {
  readonly editor: HTMLElement;
  /** Reply evidence: the draft quotes earlier mail, is marked as a reply, or is an inline reply. */
  readonly isReply: boolean;
  /** Gmail keeps the reply's quote trimmed behind a toggle, outside the editor. */
  readonly quoteOutsideEditor: boolean;
}

/** The id of the replied-to message Gmail keeps in a reply's hidden form (InboxSDK). */
function repliedMessageId(container: Element): string | null {
  const value = container.querySelector<HTMLInputElement>('input[name="rm"]')?.value.trim() ?? '';
  return MISSING_ID_VALUES.includes(value) ? null : value;
}

/**
 * Finds the visible draft editors: inline replies in a conversation, compose windows and the
 * full-screen compose. Search and recipient fields, editables inside a message or quote and the
 * extension's own UI are filtered out; each editor is returned, never "the first editor on the
 * page".
 */
export function locateComposers(document: Document, ownUiSelector: string): LocatedComposer[] {
  const candidates = queryAll(document, 'composeEditor').filter(
    (editor) =>
      closest(editor, 'composeExclusions') === null &&
      editor.closest(ownUiSelector) === null &&
      isEditableElement(editor) &&
      isVisibleElement(editor),
  );
  return outermostElements(candidates).map((editor) => {
    const container = closest(editor, 'composeContainer');
    const quoted = queryFirst(editor, 'quoteStart') !== null;
    const trimmed = container !== null && queryFirst(container, 'trimmedContentToggle') !== null;
    const marked =
      container !== null &&
      (repliedMessageId(container) !== null || queryFirst(container, 'replyMarker') !== null);
    const inline = closest(editor, 'message') !== null;
    return {
      editor,
      isReply: quoted || trimmed || marked || inline,
      quoteOutsideEditor: trimmed && !quoted,
    };
  });
}

/**
 * Account hint, used only to derive an opaque scope: the account's place in the URL
 * (`/mail/u/1/`, or `/mail/b/<id>/` for a delegated mailbox). Gmail opens another account in a
 * new page, and the place stays the same for the lifetime of a page, so the scope does too.
 * The page title also names the account's address, but it changes while the page loads and is
 * not used.
 */
export function readAccountHint(document: Document): string | null {
  const path = document.location?.pathname ?? '';
  const slot = /\/mail\/((?:u|b)\/[^/]+)/.exec(path)?.[1];
  return slot ?? (path.includes('/mail/') ? 'default' : null);
}
