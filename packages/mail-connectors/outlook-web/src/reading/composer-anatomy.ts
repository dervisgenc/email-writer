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
 * The structure of a draft editor: the boundary between the editable region the
 * user writes in and the protected region, such as the signature or earlier mail.
 */
export interface ComposerAnatomy {
  readonly editor: HTMLElement;
  /** First element of the protected region (signature or start of the quote). */
  readonly boundary: Element | null;
  readonly editableText: string;
  readonly editableSegments: readonly TextSegment[];
  /** Text of the protected region; checked to be unchanged after a write. */
  readonly protectedText: string;
  readonly containsRichContent: boolean;
  readonly canReplaceBody: boolean;
  readonly canInsertIntoEmptyBody: boolean;
}

export interface AnatomyOptions {
  readonly classify: (element: Element) => ElementRole;
  /**
   * In reply drafts, earlier mail may sit inside the editor. Without a boundary
   * marker, the body as a whole does not count as safely separated.
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
  // The body counts as separated if a marker proves the boundary or this is a new email.
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

const isBlankText = (node: Node) =>
  node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() === '';

/** Finds the neighboring node, skipping whitespace-only text. */
function sibling(node: Node | null, direction: 'previous' | 'next'): Node | null {
  let current = node;
  while (current !== null && isBlankText(current)) {
    current = direction === 'previous' ? current.previousSibling : current.nextSibling;
  }
  return current;
}

/**
 * Range covering the whole editable region, up to just before the boundary element:
 * the whole part the user wrote. The ends are placed inside the first and last
 * blocks rather than between blocks, so when the browser deletes and types it
 * does not merge the last line into the next block (e.g. the signature's first
 * line); the content stays inside the body paragraph.
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
    // Empty body: fall back to a position between blocks.
    range.setStart(editor, 0);
  }
  return range;
}

/** Where text goes in an empty draft: inside the first empty line or at the start of the editor. */
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
 * Fingerprint of the region the user wrote: its whitespace-normalized text and
 * the number of elements such as tables and images. The revision goes up only
 * when these change. The signature and earlier mail are left out, so a ready
 * result and the selection stay valid when Outlook fills in the quote after
 * opening the editor or restructures the written content (with the same text).
 * At write time, the selection text, the body and the protected region are
 * checked separately.
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
