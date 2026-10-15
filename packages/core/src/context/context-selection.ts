import type { ContextEdit, ContextSelection } from '@email-writer/contracts';

/**
 * Bağlam denetleyicisinde bir mesajı ekler veya çıkarır. Seçim varsayılan
 * kurala göre istisna olarak tutulur; aynı mesaj hem eklenen hem çıkarılan
 * listesinde bulunmaz.
 */
export function withMessageInclusion(
  selection: ContextSelection,
  messageKey: string,
  included: boolean,
): ContextSelection {
  const without = (keys: readonly string[]) => keys.filter((key) => key !== messageKey);
  return included
    ? { included: [...without(selection.included), messageKey], excluded: without(selection.excluded) }
    : { included: without(selection.included), excluded: [...without(selection.excluded), messageKey] };
}

/**
 * Bir mesajın bağlamdaki metnini düzenler; `null` düzenlemeyi kaldırır ve
 * orijinal metne döner. Orijinal mesaj ve e-posta değişmez.
 */
export function withMessageEdit(
  edits: readonly ContextEdit[],
  messageKey: string,
  text: string | null,
): readonly ContextEdit[] {
  const others = edits.filter((edit) => edit.messageKey !== messageKey);
  return text === null ? others : [...others, { messageKey, text }];
}
