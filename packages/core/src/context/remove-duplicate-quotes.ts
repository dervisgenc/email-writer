import type { MessageSnapshot } from '@email-writer/contracts';

import { toComparisonLines } from './normalize-text';

/** Bir alıntı bölümünün başındaki yanıt başlığı için izin verilen en fazla satır. */
const MAX_HEADER_LINES = 8;
const MAX_HEADER_LINE_LENGTH = 1_000;
const MAX_ATTRIBUTION_LENGTH = 300;

/**
 * Yanıt başlığı satırları dile bağlı kelimelere değil, biçime göre tanınır:
 * "Kimden: …", "From: …", "De : …" gibi kısa etiketler, "… wrote:" gibi
 * iki nokta üst üste ile biten atıf satırları ve ayırıcı çizgiler.
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
 * Bir mesajın alıntılanmış olabileceği satır dizileri: bütün bloklar, alıntısız
 * hali ve yalnızca gövde blokları. Outlook önceki mesajı imzasıyla veya kendi
 * alıntısıyla birlikte alıntılayabilir.
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
 * Bir alıntı bloğu, ancak içeriğinin tamamı "[yanıt başlığı] + [bağlamdaki
 * başka bir mesajın tam metni]" bölümlerinden oluşuyorsa tekrar sayılır.
 * Eşleşmeyen tek bir satır bile varsa blok korunur; belirsiz içerik silinmez.
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
