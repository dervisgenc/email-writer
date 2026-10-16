import { extractTextBlocks, type ElementRole, type TextSegment } from './extract-text-blocks';

const RICH_CONTENT_TAGS = new Set([
  'TABLE',
  'IMG',
  'PICTURE',
  'SVG',
  'VIDEO',
  'AUDIO',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'CANVAS',
]);

/**
 * Bir taslak editörünün yapısı: kullanıcının yazdığı düzenlenebilir bölge ile
 * imza veya önceki yazışma gibi korunan bölge arasındaki sınır.
 */
export interface ComposerAnatomy {
  readonly editor: HTMLElement;
  /** Korunan bölgenin ilk elemanı (imza veya alıntı başlangıcı). */
  readonly boundary: Element | null;
  readonly editableText: string;
  readonly editableSegments: readonly TextSegment[];
  /** Korunan bölgenin metni; yazmadan sonra değişmediği doğrulanır. */
  readonly protectedText: string;
  readonly containsRichContent: boolean;
  readonly canReplaceBody: boolean;
  readonly canInsertIntoEmptyBody: boolean;
}

export interface AnatomyOptions {
  readonly classify: (element: Element) => ElementRole;
  /**
   * Yanıt taslaklarında önceki yazışma editörün içinde olabilir. Sınır
   * işareti bulunamazsa gövdenin tamamı güvenle ayrılmış sayılmaz.
   */
  readonly isReply: boolean;
}

function findBoundary(editor: HTMLElement, classify: AnatomyOptions['classify']): Element | null {
  const walker = editor.ownerDocument.createTreeWalker(editor, NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const role = classify(node as Element);
    if (role === 'signature' || role === 'quote-start') {
      return node as Element;
    }
  }
  return null;
}

function hasRichContentBefore(editor: HTMLElement, boundary: Element | null): boolean {
  const walker = editor.ownerDocument.createTreeWalker(editor, NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node === boundary) {
      return false;
    }
    if (RICH_CONTENT_TAGS.has((node as Element).tagName.toUpperCase())) {
      return true;
    }
  }
  return false;
}

function protectedTextAfter(editor: HTMLElement, boundary: Element | null): string {
  if (boundary === null) {
    return '';
  }
  const range = editor.ownerDocument.createRange();
  range.setStartBefore(boundary);
  range.setEnd(editor, editor.childNodes.length);
  return extractTextBlocks(range.cloneContents())
    .blocks.map((block) => block.text)
    .join('\n');
}

export function readComposerAnatomy(editor: HTMLElement, options: AnatomyOptions): ComposerAnatomy {
  const boundary = findBoundary(editor, options.classify);
  const extraction = extractTextBlocks(editor, { classify: options.classify, stopAt: boundary });
  const editableBlock = extraction.blocks.find((block) => block.kind === 'body');
  const editableText = editableBlock?.text ?? '';
  const containsRichContent = hasRichContentBefore(editor, boundary);
  const protectedText = protectedTextAfter(editor, boundary);
  const isBlank = editableText.trim().length === 0;
  // Sınır bir işaretle kanıtlandıysa veya yeni bir e-postadaysak gövde ayrılmış sayılır.
  const boundaryIsCertain = boundary !== null || !options.isReply;

  return {
    editor,
    boundary,
    editableText,
    editableSegments: editableBlock?.segments ?? [],
    protectedText,
    containsRichContent,
    canReplaceBody: boundaryIsCertain && !containsRichContent && !isBlank,
    canInsertIntoEmptyBody: isBlank && (boundaryIsCertain || editor.textContent?.trim() === ''),
  };
}

/** Düzenlenebilir bölgenin tamamını kapsayan aralık (sınır elemanının öncesine kadar). */
const isBlankText = (node: Node) =>
  node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() === '';

/** Boşluk metinlerini atlayarak komşu düğümü bulur. */
function sibling(node: Node | null, direction: 'previous' | 'next'): Node | null {
  let current = node;
  while (current !== null && isBlankText(current)) {
    current = direction === 'previous' ? current.previousSibling : current.nextSibling;
  }
  return current;
}

/**
 * Kullanıcının yazdığı bölümün tamamı. Uçlar blokların arasına değil, ilk ve son
 * bloğun içine konur: tarayıcı silip yazarken son satırı sonraki bloğa (ör. imzanın
 * ilk satırına) birleştirmez; içerik gövde paragrafının içinde kalır.
 */
export function editableRegionRange(anatomy: ComposerAnatomy): Range {
  const { editor, boundary } = anatomy;
  const range = editor.ownerDocument.createRange();
  const first = sibling(editor.firstChild, 'next');
  if (
    first !== null &&
    first !== boundary &&
    first.nodeType === Node.ELEMENT_NODE &&
    !first.contains(boundary)
  ) {
    range.setStart(first, 0);
  } else {
    range.setStart(editor, 0);
  }
  const last =
    boundary === null ? sibling(editor.lastChild, 'previous') : sibling(boundary.previousSibling, 'previous');
  if (last !== null && last.nodeType === Node.ELEMENT_NODE) {
    range.setEnd(last, last.childNodes.length);
  } else if (last !== null && last.nodeType === Node.TEXT_NODE) {
    range.setEnd(last, last.textContent?.length ?? 0);
  } else if (boundary === null) {
    range.setEnd(editor, editor.childNodes.length);
  } else {
    range.setEndBefore(boundary);
  }
  if (range.collapsed && !range.toString()) {
    // Boş gövde: bloklar arası konuma geri dönülür.
    range.setStart(editor, 0);
  }
  return range;
}

/** Boş taslakta metnin ekleneceği nokta: ilk boş satırın içi veya editörün başı. */
export function emptyInsertionRange(anatomy: ComposerAnatomy): Range {
  const range = anatomy.editor.ownerDocument.createRange();
  const first = anatomy.editor.firstElementChild;
  const firstIsEmptyLine =
    first !== null &&
    first !== anatomy.boundary &&
    !first.contains(anatomy.boundary) &&
    (first.textContent ?? '').trim() === '';
  range.setStart(firstIsEmptyLine ? first : anatomy.editor, 0);
  range.collapse(true);
  return range;
}

/**
 * Kullanıcının yazdığı bölgenin parmak izi: boşlukları sadeleştirilmiş metni ve
 * tablo, resim gibi öğelerin sayısı. Yalnızca bunlar değişince sürüm artar.
 * İmza ve önceki yazışma dahil edilmez; Outlook alıntıyı editörü açtıktan sonra
 * doldurduğunda veya yazılan içeriği kendi yapısına göre yeniden düzenlediğinde
 * (metin aynıyken) hazır sonuç ve seçim geçerli kalır. Yazma anında seçim metni,
 * gövde ve korunan bölge ayrıca doğrulanır.
 */
export function composerFingerprint(editor: HTMLElement, classify: AnatomyOptions['classify']): string {
  const boundary = findBoundary(editor, classify);
  const extraction = extractTextBlocks(editor, { classify, stopAt: boundary });
  const text = extraction.blocks
    .map((block) => `${block.kind}:${block.text.replace(/\s+/gu, ' ').trim()}`)
    .join('\u0001');
  return `${richElementsBefore(editor, boundary)}\u0002${text}`;
}

function richElementsBefore(editor: HTMLElement, boundary: Element | null): number {
  const walker = editor.ownerDocument.createTreeWalker(editor, NodeFilter.SHOW_ELEMENT);
  let count = 0;
  for (let node = walker.nextNode(); node !== null && node !== boundary; node = walker.nextNode()) {
    if (RICH_CONTENT_TAGS.has((node as Element).tagName.toUpperCase())) count += 1;
  }
  return count;
}
