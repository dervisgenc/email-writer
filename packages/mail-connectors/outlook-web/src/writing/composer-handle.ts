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

/**
 * İmza ve önceki yazışma korunmuş mu? Aynı kalmalı ya da yalnızca sonuna içerik
 * eklenmiş olmalıdır: Outlook alıntıyı taslağa geç (ör. ilk düzenlemeden sonra)
 * ekleyebilir. Eklentinin yazdığı içerik korunan bölgenin önüne girer; korunan
 * bölgenin başı değişirse (ör. son satır imzaya birleşti) sonuç doğrulanamaz.
 */
export function isProtectedIntact(before: string, current: string): boolean {
  const original = comparableText(before);
  const now = comparableText(current);
  return now === original || original === '' || now.startsWith(`${original} `);
}

/** Yazma sonrası doğrulamada, editörün eklediği boşluk farklarını yok sayar. */
export function comparableText(text: string): string {
  return text.normalize('NFC').replace(/\s+/gu, ' ').trim();
}
