import type { ContextSelection, ContextSnapshot, ThreadSnapshot } from '@email-writer/contracts';

/**
 * "Konuşmayı yeniden oku" sonrasında eski elle seçim yalnızca aynı güvenilir
 * mesaj kimlikleri yeni snapshot'ta hâlâ bulunuyorsa korunur.
 */
export function retainContextSelection(
  selection: ContextSelection,
  snapshot: ThreadSnapshot,
): ContextSelection {
  if (selection.mode === 'automatic') {
    return selection;
  }
  const available = new Set(snapshot.messages.map((message) => message.messageKey));
  return {
    mode: 'manual',
    messageKeys: selection.messageKeys.filter((key) => available.has(key)),
  };
}

/**
 * Bağlam denetleyicisinde bir mesajın seçimini değiştirir. Otomatik seçimden
 * ilk elle değişiklikte, o anda bağlamda bulunan mesajlar başlangıç kabul edilir.
 */
export function withMessageInclusion(
  selection: ContextSelection,
  currentContext: ContextSnapshot | null,
  messageKey: string,
  included: boolean,
): ContextSelection {
  const base =
    selection.mode === 'manual'
      ? selection.messageKeys
      : (currentContext?.messages.map((message) => message.messageKey) ?? []);
  const keys = new Set(base);
  if (included) {
    keys.add(messageKey);
  } else {
    keys.delete(messageKey);
  }
  return { mode: 'manual', messageKeys: [...keys] };
}
