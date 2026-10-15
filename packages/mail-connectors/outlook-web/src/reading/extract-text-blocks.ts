import type { TextBlockKind } from '@email-writer/contracts';

/**
 * Çıktı metnindeki `[start, end)` aralığının bir metin düğümündeki
 * `[nodeOffset, nodeOffset + (end - start))` aralığına bire bir karşılığı.
 * Eklenen satır sonları ve ayırıcılar hiçbir düğüme eşlenmez.
 */
export interface TextSegment {
  readonly node: Text;
  readonly nodeOffset: number;
  readonly start: number;
  readonly end: number;
}

export interface ExtractedBlock {
  readonly kind: TextBlockKind;
  readonly certainty: 'certain' | 'uncertain';
  readonly text: string;
  readonly segments: readonly TextSegment[];
}

/**
 * Bir elemanın metindeki rolü: `quote-start` sonrasındaki bütün içerik alıntı
 * sayılır; `signature` yalnızca elemanın kendi içeriğini kapsar; `exclude`
 * içeriği tamamen atlar.
 */
export type ElementRole = 'quote-start' | 'signature' | 'exclude' | null;

export interface ExtractOptions {
  readonly classify?: (element: Element) => ElementRole;
  /** Bu elemana ulaşıldığında gezinti durur (ör. editördeki imza sınırı). */
  readonly stopAt?: Element | null;
  /** İnceleme bütçesi (UTF-16 birimi). Aşılırsa `truncated` döner. */
  readonly maxLength?: number;
}

export interface ExtractionResult {
  readonly blocks: readonly ExtractedBlock[];
  readonly truncated: boolean;
}

const SKIPPED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'HEAD',
  'META',
  'LINK',
  'TITLE',
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'OPTION',
  'BUTTON',
  'FORM',
  'IMG',
  'PICTURE',
  'SVG',
  'CANVAS',
  'VIDEO',
  'AUDIO',
  'IFRAME',
  'OBJECT',
  'EMBED',
]);

const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TBODY',
  'THEAD',
  'TFOOT',
  'TR',
  'UL',
  'CENTER',
]);

const TABLE_CELL_SEPARATOR = ' | ';

/** İçindeki yalnızca-boşluk metin düğümleri görüntülenmeyen yapısal elemanlar. */
const STRUCTURAL_PARENTS = new Set(['TABLE', 'TBODY', 'THEAD', 'TFOOT', 'TR', 'UL', 'OL', 'DL']);

/**
 * Görünmeyen izleme ve önizleme metinleri genellikle satır içi stil ile
 * gizlenir. `checkVisibility` olmayan ortamlarda (ör. test DOM'u) bu kontrol
 * yedek olarak kullanılır.
 */
function isHidden(element: Element): boolean {
  if (element.hasAttribute('hidden')) {
    return true;
  }
  const style = element.getAttribute('style')?.toLowerCase().replace(/\s+/g, '') ?? '';
  if (
    style.includes('display:none') ||
    style.includes('visibility:hidden') ||
    style.includes('mso-hide:all')
  ) {
    return true;
  }
  if (typeof element.checkVisibility === 'function' && element.isConnected) {
    return !element.checkVisibility({ visibilityProperty: true });
  }
  return false;
}

/** Metnin sonundaki satır sonu sayısı (en fazla iki); satır sonları ayrı parçalarda olabilir. */
function trailingBreaks(parts: readonly string[]): number {
  let count = 0;
  for (let index = parts.length - 1; index >= 0 && count < 2; index -= 1) {
    const part = parts[index] ?? '';
    let position = part.length - 1;
    while (position >= 0 && part.charAt(position) === '\n' && count < 2) {
      count += 1;
      position -= 1;
    }
    if (position >= 0) {
      break;
    }
  }
  return count;
}

function isPreformatted(element: Element): boolean {
  return element.tagName === 'PRE' || /white-space:\s*pre/i.test(element.getAttribute('style') ?? '');
}

class BlockWriter {
  readonly blocks: { kind: TextBlockKind; parts: string[]; segments: TextSegment[]; length: number }[] = [];
  private pendingBreaks = 0;
  private totalLength = 0;
  truncated = false;

  constructor(private readonly maxLength: number) {}

  private current(kind: TextBlockKind) {
    const last = this.blocks[this.blocks.length - 1];
    if (last !== undefined && last.kind === kind) {
      return last;
    }
    const block = { kind, parts: [] as string[], segments: [] as TextSegment[], length: 0 };
    this.blocks.push(block);
    this.pendingBreaks = 0;
    return block;
  }

  private endsWithBreak(kind: TextBlockKind): boolean {
    const block = this.current(kind);
    const lastPart = block.parts[block.parts.length - 1];
    return block.length === 0 || lastPart === undefined || lastPart.endsWith('\n');
  }

  /** Şimdiye kadar yazılan karakter sayısı (yapay metin dahil). */
  get written(): number {
    return this.totalLength;
  }

  requestBreak(count = 1): void {
    this.pendingBreaks = Math.max(this.pendingBreaks, count);
  }

  /** Düğüme eşlenmeyen yapay metin (satır sonu, liste işareti, tablo ayırıcı). */
  writeSynthetic(kind: TextBlockKind, text: string): void {
    this.flushBreaks(kind);
    // Ayırıcı boşlukla başlıyorsa önceki boşlukla birleşip çift boşluk oluşturmaz.
    const value = text.startsWith(' ') && this.endsWithSpace(kind) ? text.slice(1) : text;
    this.append(kind, value, null, 0);
  }

  writeText(kind: TextBlockKind, node: Text, preformatted: boolean): void {
    const data = node.data;
    let index = 0;
    while (index < data.length && !this.truncated) {
      const char = data.charAt(index);
      if (!preformatted && /[ \t\n\r\f]/.test(char)) {
        // Art arda boşluklar tek boşluğa iner; satır başındaki boşluk atlanır.
        let runEnd = index + 1;
        while (runEnd < data.length && /[ \t\n\r\f]/.test(data.charAt(runEnd))) {
          runEnd += 1;
        }
        if (this.pendingBreaks === 0 && !this.endsWithBreak(kind) && !this.endsWithSpace(kind)) {
          this.append(kind, ' ', node, index);
        }
        index = runEnd;
        continue;
      }
      let runEnd = index + 1;
      while (runEnd < data.length && (preformatted || !/[ \t\n\r\f]/.test(data.charAt(runEnd)))) {
        runEnd += 1;
      }
      this.flushBreaks(kind);
      // Bölünemeyen boşluk, eşlemeyi bozmadan normal boşluğa çevrilir (bire bir).
      this.append(kind, data.slice(index, runEnd).replace(/\u00a0/g, ' '), node, index);
      index = runEnd;
    }
  }

  private endsWithSpace(kind: TextBlockKind): boolean {
    const block = this.current(kind);
    return block.parts[block.parts.length - 1]?.endsWith(' ') ?? false;
  }

  private flushBreaks(kind: TextBlockKind): void {
    if (this.pendingBreaks === 0) {
      return;
    }
    const breaks = this.pendingBreaks;
    this.pendingBreaks = 0;
    const block = this.current(kind);
    if (block.length === 0) {
      return;
    }
    const existing = trailingBreaks(block.parts);
    if (breaks > existing) {
      this.append(kind, '\n'.repeat(breaks - existing), null, 0);
    }
  }

  /**
   * Satır sonundan hemen önceki tek boşluk görünmez; metne alınmaz. Boşluk
   * dizileri her zaman ayrı bir `' '` parçası olarak yazıldığı için yalnızca o
   * parça ve eşlemesi geri alınır. Eşlenmeyen boşluktaki seçim noktası, seçim
   * eşlemesinde en yakın metne yaslanır.
   */
  private dropTrailingSpace(block: BlockWriter['blocks'][number]): void {
    if (block.parts[block.parts.length - 1] !== ' ') {
      return;
    }
    block.parts.pop();
    const lastSegment = block.segments[block.segments.length - 1];
    if (lastSegment !== undefined && lastSegment.end === block.length) {
      block.segments.pop();
    }
    block.length -= 1;
    this.totalLength -= 1;
  }

  private append(kind: TextBlockKind, text: string, node: Text | null, nodeOffset: number): void {
    if (this.totalLength + text.length > this.maxLength) {
      this.truncated = true;
      return;
    }
    const block = this.current(kind);
    if (text.startsWith('\n')) {
      this.dropTrailingSpace(block);
    }
    if (node !== null) {
      block.segments.push({ node, nodeOffset, start: block.length, end: block.length + text.length });
    }
    block.parts.push(text);
    block.length += text.length;
    this.totalLength += text.length;
  }
}

/**
 * Mesaj veya editör içeriğini kontrollü bir DOM gezintisiyle düz metne çevirir.
 * E-posta HTML'i yeniden sayfaya eklenmez veya çalıştırılmaz; tek bir
 * `textContent` çağrısı, gizli metinleri karıştırabileceği için kullanılmaz.
 */
export function extractTextBlocks(root: Node, options: ExtractOptions = {}): ExtractionResult {
  const writer = new BlockWriter(options.maxLength ?? Number.POSITIVE_INFINITY);
  /** Her tablo satırına girildiğinde yazılmış karakter sayısı. */
  const rowStarts = new Map<Element, number>();
  let mode: 'body' | 'quote' = 'body';
  let stopped = false;

  const visit = (node: Node, kind: () => TextBlockKind, preformatted: boolean): void => {
    if (writer.truncated || stopped) {
      return;
    }
    if (node === options.stopAt) {
      stopped = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      // Tablo ve liste yapısındaki biçimlendirme boşlukları tarayıcıda da görünmez.
      const parentTag = node.parentElement?.tagName.toUpperCase() ?? '';
      if (STRUCTURAL_PARENTS.has(parentTag) && (node.textContent ?? '').trim() === '') {
        return;
      }
      writer.writeText(kind(), node as Text, preformatted);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    const element = node as Element;
    const tag = element.tagName.toUpperCase();
    if (SKIPPED_TAGS.has(tag) || isHidden(element)) {
      return;
    }

    const role = options.classify?.(element) ?? null;
    if (role === 'exclude') {
      return;
    }
    if (role === 'quote-start') {
      mode = 'quote';
    }
    // İmza içindeki iç içe elemanlar imza türünü devralır; alıntı başladıktan
    // sonraki bütün içerik alıntıdır.
    const childKind: () => TextBlockKind = role === 'signature' && mode === 'body' ? () => 'signature' : kind;

    if (tag === 'BR') {
      writer.writeSynthetic(kind(), '\n');
      return;
    }

    const isBlock = BLOCK_TAGS.has(tag) || role !== null;
    if (isBlock) {
      writer.requestBreak(tag === 'P' ? 2 : 1);
    }
    if (tag === 'LI') {
      const parent = element.parentElement;
      const marker =
        parent?.tagName === 'OL'
          ? `${
              Array.from(parent.children)
                .filter((child) => child.tagName === 'LI')
                .indexOf(element) + 1
            }. `
          : '- ';
      writer.writeSynthetic(childKind(), marker);
    }
    if (tag === 'TR') {
      rowStarts.set(element, writer.written);
    }
    // Hücre ayırıcı yalnızca aynı satırda önceki hücrelerden metin yazıldıysa
    // eklenir; e-posta şablonlarındaki boş renk/boşluk hücreleri ayırıcı üretmez.
    const rowStart = element.parentElement === null ? undefined : rowStarts.get(element.parentElement);
    if ((tag === 'TD' || tag === 'TH') && rowStart !== undefined && writer.written > rowStart) {
      writer.writeSynthetic(childKind(), TABLE_CELL_SEPARATOR);
    }

    const childPreformatted = preformatted || isPreformatted(element);
    for (const child of Array.from(element.childNodes)) {
      visit(child, childKind, childPreformatted);
    }

    if (isBlock) {
      writer.requestBreak(tag === 'P' ? 2 : 1);
    }
  };

  for (const child of Array.from(root.childNodes)) {
    visit(child, () => (mode === 'quote' ? 'quote' : 'body'), false);
  }

  return {
    blocks: writer.blocks
      .map((block) => ({
        kind: block.kind,
        certainty: 'certain' as const,
        text: block.parts.join(''),
        segments: block.segments,
      }))
      .filter((block) => block.text.trim().length > 0),
    truncated: writer.truncated,
  };
}
