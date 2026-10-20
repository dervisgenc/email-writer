import type { MessageSnapshot } from '@writehand/contracts';

import { toComparisonLines } from './normalize-text';

/** Maximum number of lines allowed for the reply header at the start of a quoted section. */
const MAX_HEADER_LINES = 8;
const MAX_HEADER_LINE_LENGTH = 1_000;
const MAX_ATTRIBUTION_LENGTH = 300;

/**
 * Reply header lines are recognized by shape, not by language-specific words: short labels
 * such as "Kimden: …", "From: …", "De : …", attribution lines ending in a colon such as
 * "… wrote:", and separator lines.
 */
function isHeaderLine(line: string): boolean {
  if (line.length > MAX_HEADER_LINE_LENGTH) {
    return false;
  }
  if (/^[-_=—–*~ ]{3,}$/u.test(line) || /^-{2,}[^-].*[^-]-{2,}$/u.test(line)) {
    return true;
  }
  if (/^[\p{L}][\p{L}\p{M} .'-]{0,40}:(\s|$)/u.test(line)) {
    return true;
  }
  return line.length <= MAX_ATTRIBUTION_LENGTH && line.endsWith(':');
}

/**
 * Line sequences a message may have been quoted as: all blocks, without its quotes, and
 * body blocks only. Outlook may quote the previous message with its signature or with its
 * own quote.
 */
export function quotableLineSequences(message: MessageSnapshot): string[][] {
  const variants = [
    message.blocks,
    message.blocks.filter((block) => block.kind !== 'quote'),
    message.blocks.filter((block) => block.kind === 'body' || block.kind === 'unknown'),
  ];
  const sequences: string[][] = [];
  const seen = new Set<string>();

  for (const blocks of variants) {
    const lines = toComparisonLines(blocks.map((block) => block.text).join('\n'));
    const key = lines.join('\n');
    if (lines.length > 0 && !seen.has(key)) {
      seen.add(key);
      sequences.push(lines);
    }
  }
  return sequences;
}

function matchesAt(lines: readonly string[], position: number, sequence: readonly string[]): boolean {
  if (position + sequence.length > lines.length) {
    return false;
  }
  return sequence.every((line, offset) => lines[position + offset] === line);
}

/**
 * A quote block counts as a duplicate only if its entire content consists of
 * "[reply header] + [full text of another message in the context]" sections. If even one
 * line does not match, the block is kept; uncertain content is never removed.
 */
export function isDuplicateQuote(
  quoteText: string,
  candidateSequences: readonly (readonly string[])[],
): boolean {
  const lines = toComparisonLines(quoteText);
  const sequences = candidateSequences.filter((sequence) => sequence.length > 0);
  if (lines.length === 0 || sequences.length === 0) {
    return false;
  }

  const memo = new Map<number, boolean>();

  const canParseFrom = (position: number): boolean => {
    if (position === lines.length) {
      return true;
    }
    const cached = memo.get(position);
    if (cached !== undefined) {
      return cached;
    }

    let parsed = false;
    for (let headerCount = 0; headerCount <= MAX_HEADER_LINES && !parsed; headerCount += 1) {
      const header = lines.slice(position, position + headerCount);
      if (header.length < headerCount || !header.every(isHeaderLine)) {
        break;
      }
      const bodyStart = position + headerCount;
      parsed = sequences.some(
        (sequence) => matchesAt(lines, bodyStart, sequence) && canParseFrom(bodyStart + sequence.length),
      );
    }

    memo.set(position, parsed);
    return parsed;
  };

  return canParseFrom(0);
}
