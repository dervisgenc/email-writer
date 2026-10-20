import { messageBodies } from './locate-thread';
import { closest, queryAll, queryFirst } from './selectors';

export interface LocatedComposer {
  readonly editor: HTMLElement;
  /** Is this a reply draft opened under a conversation in the reading pane? */
  readonly isReply: boolean;
}

function isEditable(element: HTMLElement): boolean {
  if (element.getAttribute('contenteditable') !== 'true') {
    return false;
  }
  // The test DOM does not implement `isContentEditable`; browsers get the extra check.
  return element.isContentEditable !== false;
}

function isVisible(element: HTMLElement): boolean {
  return typeof element.checkVisibility === 'function' ? element.checkVisibility() : true;
}

/**
 * Finds the visible draft editors. `role="textbox"` alone is not enough: the
 * search box, people picker and the extension's own UI are filtered out. There
 * is no "pick the first editor on the page" behavior; each editor is returned.
 */
export function locateComposers(document: Document, ownUiSelector: string): LocatedComposer[] {
  const pane = queryFirst(document, 'readingPane');
  const paneHasConversation = pane !== null && messageBodies(pane).length > 0;

  const candidates = queryAll(document, 'composeEditor').filter(
    (editor) =>
      closest(editor, 'composeExclusions') === null &&
      editor.closest(ownUiSelector) === null &&
      isEditable(editor) &&
      isVisible(editor),
  );
  const outermost = candidates.filter(
    (editor) => !candidates.some((other) => other !== editor && other.contains(editor)),
  );

  // Reply evidence: the editor quotes earlier mail or was opened under a conversation.
  // Outlook opens new messages in the same inline region, so the region alone is not enough.
  return outermost.map((editor) => ({
    editor,
    isReply: queryFirst(editor, 'quoteStart') !== null || (paneHasConversation && pane.contains(editor)),
  }));
}

/** Account hint: accessible name or text. Used only to derive an opaque scope. */
export function readAccountHint(document: Document): string | null {
  const element = queryFirst(document, 'accountHint');
  if (element === null) {
    return null;
  }
  return element.getAttribute('aria-label') ?? element.textContent ?? null;
}
