import type { ComposerRef } from '@email-writer/contracts';

import type { EditorTracker } from '../observation/observe-editor';
import type { ComposerAnatomy } from '../reading/composer-anatomy';

/** Bağlantı modülünün içinde, canlı bir editöre erişmek için kullanılan kayıt. */
export interface ComposerHandle {
  readonly ref: ComposerRef;
  readonly editor: HTMLElement;
  readonly tracker: EditorTracker;
  /** Editörün güncel yapısını anlık olarak okur. */
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

/** Yazma sonrası doğrulamada, editörün eklediği boşluk farklarını yok sayar. */
export function comparableText(text: string): string {
  return text.normalize('NFC').replace(/\s+/gu, ' ').trim();
}
