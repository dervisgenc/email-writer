/**
 * Masks text to show the shape of real email content without writing it to the
 * terminal: uppercase letter → X, other letters → x, digit → 0. Whitespace, line
 * breaks and punctuation are kept, so the shape of a greeting, signature or date
 * is visible but the content is not (see docs/DEVELOPMENT.md).
 */
export function maskText(value: string, maxLength = 80): string {
  const masked = value.replace(/\p{Lu}|\p{L}|\p{N}|\n/gu, (char) => {
    if (char === '\n') {
      return '⏎';
    }
    if (/\p{N}/u.test(char)) {
      return '0';
    }
    return /\p{Lu}/u.test(char) ? 'X' : 'x';
  });
  return masked.length > maxLength ? `${masked.slice(0, maxLength)}…(+${masked.length - maxLength})` : masked;
}

/**
 * Hides the numbers and long opaque parts (e.g. mailbox item IDs) of an ID value;
 * Outlook's fixed prefixes and suffixes stay visible.
 */
export function maskIdentifier(value: string): string {
  return value
    .split(/([_\-:.])/)
    .map((part) => (part.length >= 16 && /\d/.test(part) ? '<opaque>' : part.replace(/\d+/g, 'N')))
    .join('');
}
