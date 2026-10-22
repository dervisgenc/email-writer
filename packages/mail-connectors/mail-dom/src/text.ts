const MAX_LABEL_LENGTH = 200;

/** Collapses the visible text to one line; `null` if empty. */
export function labelText(element: Element | null): string | null {
  const text = element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return text === '' ? null : text.slice(0, MAX_LABEL_LENGTH);
}

/**
 * Extracts the display name from sender text (`Jane Doe <jane.doe@example.com>`).
 * The address is not kept: bracketed and bare addresses are dropped, and if no
 * name is left the name counts as unknown.
 */
export function senderDisplayName(text: string): string | null {
  const name = text
    .replace(/<[^<>]*@[^<>]*>/g, ' ')
    .replace(/\S+@\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return name === '' ? null : name.slice(0, MAX_LABEL_LENGTH);
}
