/**
 * Format normalization for the context copy: unifies line endings and removes trailing
 * whitespace and consecutive blank lines. Letters, numbers, addresses and paragraph order
 * are left untouched.
 *
 * Never applied to draft selection indices; it is for the context copy only.
 */
export function normalizeContextText(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const result: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/[ \t\u00a0]+$/u, '');
    const previous = result[result.length - 1];
    if (line === '' && (previous === undefined || previous === '')) {
      continue;
    }
    result.push(line);
  }

  while (result[result.length - 1] === '') {
    result.pop();
  }

  return result.join('\n');
}

/**
 * Produces line keys for equality comparison only: normalizes the Unicode form, ignores
 * whitespace differences within lines and drops blank lines. The result is never applied
 * to the text.
 */
export function toComparisonLines(text: string): string[] {
  return normalizeContextText(text.normalize('NFC'))
    .split('\n')
    .map((line) => line.replace(/\s+/gu, ' ').trim())
    .filter((line) => line.length > 0);
}
