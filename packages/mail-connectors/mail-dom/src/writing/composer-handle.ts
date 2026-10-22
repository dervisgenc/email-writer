import type { ComposerRef } from '@writehand/contracts';

import type { ComposerAnatomy } from '../composer-anatomy';
import type { EditorTracker } from '../observe-editor';

/** Connector-internal record used to access a live editor. */
export interface ComposerHandle {
  readonly ref: ComposerRef;
  readonly editor: HTMLElement;
  readonly tracker: EditorTracker;
  /** Reads the editor's current structure on demand. */
  readAnatomy(): ComposerAnatomy;
}

export function isEditorWritable(editor: HTMLElement): boolean {
  if (!editor.isConnected || editor.getAttribute('contenteditable') === 'false') {
    return false;
  }
  if (editor.closest('[aria-disabled="true"], [inert]') !== null) {
    return false;
  }
  if (typeof editor.checkVisibility === 'function') {
    return editor.checkVisibility({ visibilityProperty: true });
  }
  return true;
}

/**
 * Are the signature and earlier mail preserved? They must stay the same or only
 * gain content at the end: the mail app may add the quote to the draft late (e.g.
 * after the first edit). The extension's content goes before the protected
 * region; if the start of that region changes (e.g. the last line merged into
 * the signature), the result cannot be verified.
 */
export function isProtectedIntact(before: string, current: string): boolean {
  const original = comparableText(before);
  const now = comparableText(current);
  return now === original || original === '' || now.startsWith(`${original} `);
}

/** For post-write verification; ignores whitespace differences the editor introduces. */
export function comparableText(text: string): string {
  return text.normalize('NFC').replace(/\s+/gu, ' ').trim();
}
