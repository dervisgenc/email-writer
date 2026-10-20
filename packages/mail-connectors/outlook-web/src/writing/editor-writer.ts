/**
 * The single narrow interface for inserting plain text into an editor. Which
 * method is used does not leak outside this file; on an unsupported editor,
 * experimental methods are not tried one after another.
 */
export interface EditorWriter {
  readonly id: string;
  /**
   * Replaces the contents of `range` with `text` as a single edit; empty text
   * deletes the range. Returning `true` is no proof of success: the caller
   * verifies the result by reading the editor again.
   */
  replaceRange(editor: HTMLElement, range: Range, text: string): boolean;
  /**
   * Replaces the contents of `range` with rich content as a single edit. The HTML
   * is generated and escaped by the extension itself. The result is again verified
   * by reading it back.
   */
  insertHtml(editor: HTMLElement, range: Range, html: string): boolean;
}

function selectRange(document: Document, editor: HTMLElement, range: Range): boolean {
  const selection = document.getSelection();
  if (selection === null) {
    return false;
  }
  editor.focus({ preventScroll: true });
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

/**
 * First approach: select the target range and write with
 * `execCommand('insertText')`. The API is deprecated, but it keeps the editor's
 * own input events and undo history, so in some editors it is still the only
 * reliable path. An Outlook Web / browser combination does not count as
 * supported until verified on a real account (see docs/DEVELOPMENT.md).
 */
export function createExecCommandWriter(document: Document): EditorWriter {
  return {
    id: 'exec-command-insert-text',
    replaceRange(editor, range, text) {
      if (!selectRange(document, editor, range)) {
        return false;
      }
      if (text.length === 0) {
        return range.collapsed || document.execCommand('delete', false);
      }
      return document.execCommand('insertText', false, text);
    },
    insertHtml(editor, range, html) {
      // `insertHTML` also keeps the editor's input events and undo history.
      return selectRange(document, editor, range) && document.execCommand('insertHTML', false, html);
    },
  };
}

/**
 * Alternative approach: on a synthetic `paste` event, Outlook's editor
 * (RoosterJS) cancels the browser's paste, runs its own paste logic, records its
 * own undo entry and reports the content change. `execCommand('insertText')`,
 * by contrast, only invalidates the editor's cache.
 *
 * In Firefox, a `DataTransfer` created in the content script may be
 * inaccessible to page code (Xray boundary); this method is not used there until
 * verified. The two methods are never tried one after the other: verification
 * on a real account decides which one is used.
 */
export function createPasteEventWriter(document: Document): EditorWriter {
  return {
    id: 'synthetic-paste-event',
    replaceRange(editor, range, text) {
      if (!selectRange(document, editor, range)) {
        return false;
      }
      if (text.length === 0) {
        return range.collapsed || document.execCommand('delete', false);
      }
      return dispatchPaste(editor, { 'text/plain': text });
    },
    insertHtml(editor, range, html) {
      return selectRange(document, editor, range) && dispatchPaste(editor, { 'text/html': html });
    },
  };
}

function dispatchPaste(editor: HTMLElement, items: Record<string, string>): boolean {
  const data = new DataTransfer();
  for (const [type, value] of Object.entries(items)) {
    data.setData(type, value);
  }
  const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
  editor.dispatchEvent(event);
  // If the editor handled the event, it cancels the browser's default paste.
  return event.defaultPrevented;
}
