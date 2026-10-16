import { z } from 'zod';

import type { CellAlign, ChartSpec, EmailBlock, EmailDocument, Inline } from './document';

const ESCAPABLE = new Set(['\\', '*', '_', '[', ']', '(', ')', '|', '#', '-', '`']);
const SAFE_URL = /^(?:https?:\/\/[^\s<>"]+|mailto:[^\s<>"]+)$/i;
const FENCE = /^\s*```\s*([\w-]*)\s*$/;
const LIST_ITEM = /^\s*(?:([-*•])|(\d{1,3})[.)])\s+(.*)$/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
const RULE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const MAX_TABLE_COLUMNS = 12;

export const chartSpecSchema = z.object({
  type: z.literal('bar').optional(),
  title: z.string().trim().max(120).optional(),
  unit: z.string().trim().max(20).optional(),
  data: z
    .array(z.object({ label: z.string().trim().min(1).max(60), value: z.number().finite() }))
    .min(1)
    .max(20),
});

const isWordChar = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}]/u.test(char);
const isSpace = (char: string | undefined) => char === undefined || /\s/u.test(char);

/** Vurgu işaretinin kapanışını arar; kapanış boşlukla başlamamalı ve kelime içinde olmamalıdır. */
function findClosing(source: string, from: number, marker: string): number {
  for (let index = from; index <= source.length - marker.length; index++) {
    if (source[index] === '\\') {
      index++;
      continue;
    }
    if (!source.startsWith(marker, index)) continue;
    // Tek işaret ararken çift işaretin parçası atlanır.
    if (marker.length === 1 && (source[index + 1] === marker || source[index - 1] === marker)) continue;
    if (isSpace(source[index - 1])) continue;
    if (marker[0] === '_' && isWordChar(source[index + marker.length])) continue;
    return index;
  }
  return -1;
}

function canOpen(source: string, index: number, marker: string): boolean {
  if (isSpace(source[index + marker.length])) return false;
  // Alt çizgi kelime içinde (ör. dosya_adi) vurgu açmaz.
  return !(marker[0] === '_' && isWordChar(source[index - 1]));
}

export function parseInline(source: string): Inline[] {
  const result: Inline[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer !== '') {
      result.push({ type: 'text', text: buffer });
      buffer = '';
    }
  };
  let index = 0;
  while (index < source.length) {
    const char = source[index]!;
    if (char === '\\' && ESCAPABLE.has(source[index + 1] ?? '')) {
      buffer += source[index + 1];
      index += 2;
      continue;
    }
    if (char === '*' || char === '_') {
      const marker = source[index + 1] === char ? char + char : char;
      if (canOpen(source, index, marker)) {
        const close = findClosing(source, index + marker.length, marker);
        if (close > index + marker.length) {
          flush();
          result.push({
            type: marker.length === 2 ? 'strong' : 'em',
            children: parseInline(source.slice(index + marker.length, close)),
          });
          index = close + marker.length;
          continue;
        }
      }
    }
    if (char === '[') {
      const match = /^\[([^\]\n]+)\]\(([^)\s]+)\)/.exec(source.slice(index));
      if (match !== null && SAFE_URL.test(match[2]!)) {
        flush();
        result.push({ type: 'link', href: match[2]!, children: parseInline(match[1]!) });
        index += match[0].length;
        continue;
      }
    }
    buffer += char;
    index++;
  }
  flush();
  return result;
}

function splitCells(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  for (let index = 0; index < line.length; index++) {
    const char = line[index]!;
    if (char === '\\' && line[index + 1] === '|') {
      current += '\\|';
      index++;
    } else if (char === '|') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  const trimmed = line.trim();
  if (trimmed.startsWith('|')) cells.shift();
  if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) cells.pop();
  return cells.map((cell) => cell.trim());
}

function alignOf(cell: string): CellAlign {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  return left && right ? 'center' : right ? 'right' : left ? 'left' : null;
}

function parseChart(body: string): ChartSpec | null {
  try {
    const parsed = chartSpecSchema.safeParse(JSON.parse(body));
    if (!parsed.success) return null;
    const { title, unit, data } = parsed.data;
    return { title: title || null, unit: unit || null, data };
  } catch {
    return null;
  }
}

const isTableStart = (lines: readonly string[], index: number) =>
  lines[index]!.includes('|') && index + 1 < lines.length && TABLE_SEPARATOR.test(lines[index + 1]!);

function startsBlock(lines: readonly string[], index: number): boolean {
  const line = lines[index]!;
  return (
    FENCE.test(line) ||
    LIST_ITEM.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    isTableStart(lines, index)
  );
}

/**
 * E-posta için sınırlı Markdown: paragraflar (satır sonları korunur), kalın,
 * italik, bağlantı, madde ve numaralı liste, tablo ve ```chart grafik bloğu.
 * Başlıklar kalın satıra, tanınmayan kod blokları düz paragrafa dönüşür.
 */
export function parseEmailMarkdown(markdown: string): EmailDocument {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: EmailBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]!;
    if (line.trim() === '') {
      index++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence !== null) {
      const body: string[] = [];
      index++;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index]!)) body.push(lines[index++]!);
      index++;
      const chart = fence[1] === 'chart' ? parseChart(body.join('\n')) : null;
      if (chart !== null) blocks.push({ type: 'chart', chart });
      else if (body.some((text) => text.trim() !== ''))
        blocks.push({
          type: 'paragraph',
          lines: body.filter((text) => text.trim() !== '').map((text) => [{ type: 'text', text }]),
        });
      continue;
    }
    if (isTableStart(lines, index)) {
      const header = splitCells(line).slice(0, MAX_TABLE_COLUMNS);
      const align = splitCells(lines[index + 1]!)
        .slice(0, header.length)
        .map(alignOf);
      index += 2;
      const rows: Inline[][][] = [];
      while (index < lines.length && lines[index]!.includes('|') && lines[index]!.trim() !== '') {
        const cells = splitCells(lines[index++]!);
        rows.push(header.map((_, column) => parseInline(cells[column] ?? '')));
      }
      blocks.push({
        type: 'table',
        align: header.map((_, column) => align[column] ?? null),
        header: header.map(parseInline),
        rows,
      });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item !== null) {
      const ordered = item[2] !== undefined;
      const start = ordered ? Number(item[2]) : 1;
      const items: string[] = [];
      while (index < lines.length) {
        const current = LIST_ITEM.exec(lines[index]!);
        if (current !== null && (current[2] !== undefined) === ordered) {
          items.push(current[3]!);
          index++;
        } else if (
          current === null &&
          items.length > 0 &&
          /^\s{2,}\S/.test(lines[index]!) &&
          !startsBlock(lines, index)
        ) {
          // Girintili devam satırı önceki maddeye eklenir.
          items[items.length - 1] += `\n${lines[index]!.trim()}`;
          index++;
        } else break;
      }
      blocks.push({
        type: 'list',
        ordered,
        start,
        items: items.map((text) =>
          text
            .split('\n')
            .flatMap((part, i) => [...(i > 0 ? [{ type: 'break' as const }] : []), ...parseInline(part)]),
        ),
      });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading !== null) {
      blocks.push({ type: 'paragraph', lines: [[{ type: 'strong', children: parseInline(heading[1]!) }]] });
      index++;
      continue;
    }
    if (RULE.test(line)) {
      index++;
      continue;
    }
    const paragraph: Inline[][] = [];
    while (
      index < lines.length &&
      lines[index]!.trim() !== '' &&
      (paragraph.length === 0 || !startsBlock(lines, index))
    ) {
      paragraph.push(parseInline(lines[index]!.trimEnd()));
      index++;
    }
    blocks.push({ type: 'paragraph', lines: paragraph });
  }
  return { blocks };
}
