import { isEditableElement, isVisibleElement, outermostElements } from '@writehand/mail-dom';

import { closest, MISSING_ID_VALUES, queryAll, queryFirst, REPLY_FORM_INPUTS } from './selectors';

export interface LocatedComposer {
  readonly editor: HTMLElement;
  /** The draft's container (compose window or inline reply); `null` if it was not found. */
  readonly container: HTMLElement | null;
  /** Reply evidence: the draft quotes earlier mail, is marked as a reply, or is an inline reply. */
  readonly isReply: boolean;
  /** Gmail keeps the reply's quote trimmed behind a toggle, outside the editor. */
  readonly quoteOutsideEditor: boolean;
  /** Gmail's id of the conversation the draft replies to, from its hidden form; `null` if none. */
  readonly threadId: string | null;
  /** Gmail's id of the message the draft replies to, from its hidden form; `null` if none. */
  readonly repliedMessageId: string | null;
}

/** A hidden input of the draft's form, or `null` while Gmail has not filled it in. */
function formValue(container: Element | null, name: string): string | null {
  const value = container?.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value.trim() ?? '';
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
    const repliedMessageId = formValue(container, REPLY_FORM_INPUTS.repliedMessageId);
    const quoted = queryFirst(editor, 'quoteStart') !== null;
    const trimmed = container !== null && queryFirst(container, 'trimmedContentToggle') !== null;
    const marked =
      repliedMessageId !== null || (container !== null && queryFirst(container, 'replyMarker') !== null);
    const inline = closest(editor, 'message') !== null;
    const isReply = quoted || trimmed || marked || inline;
    return {
      editor,
      container,
      isReply,
      quoteOutsideEditor: trimmed && !quoted,
      // A reply opened from the message list is not inside any open conversation; its form says
      // which conversation it belongs to.
      threadId: isReply
        ? (formValue(container, REPLY_FORM_INPUTS.legacyThreadId) ??
          formValue(container, REPLY_FORM_INPUTS.threadId))
        : null,
      repliedMessageId,
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
