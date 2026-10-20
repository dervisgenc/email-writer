import { maskIdentifier, maskText } from './mask-text';

/** Structural attributes that carry no content; their values are shown as is. */
const STRUCTURAL_ATTRIBUTES = new Set([
  'role',
  'aria-expanded',
  'aria-selected',
  'aria-level',
  'aria-hidden',
  'aria-multiline',
  'aria-haspopup',
  'aria-posinset',
  'aria-setsize',
  'contenteditable',
  'tabindex',
  'datetime',
  'dir',
]);

/** Attributes that reference IDs: their values are masked like IDs. */
const REFERENCE_ATTRIBUTES = new Set(['id', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'for']);

/** Attributes whose value may contain a name, subject or address: shown as a masked shape. */
const MASKED_ATTRIBUTES = new Set(['aria-label', 'title', 'alt', 'aria-description', 'placeholder']);

/** Elements whose contents are not shown. */
const OPAQUE_TAGS = new Set(['svg', 'script', 'style', 'noscript', 'template', 'img', 'iframe']);

const MAX_CLASSES = 4;

export interface StructureOptions {
  readonly maxDepth: number;
  readonly maxLines: number;
  /** Elements matching this selector are not expanded (e.g. the email body). */
  readonly collapse: string;
}

/** A value with whitespace or `@` may be natural text or an address. */
const looksLikeText = (value: string) => /[\s@]/.test(value);

function describeAttributes(element: Element): string {
  const parts: string[] = [];
  for (const { name, value } of Array.from(element.attributes)) {
    if (name === 'class' || name === 'style') {
      continue;
    }
    if (STRUCTURAL_ATTRIBUTES.has(name)) {
      parts.push(`${name}=${value}`);
    } else if (MASKED_ATTRIBUTES.has(name) || (name.startsWith('data-') && looksLikeText(value))) {
      parts.push(`${name}=«${maskText(value, 40)}»`);
    } else if (REFERENCE_ATTRIBUTES.has(name) || name.startsWith('data-')) {
      // Outlook's own markers (e.g. data-testid) stay as they are; numbers and opaque IDs are hidden.
      parts.push(`${name}=${maskIdentifier(value)}`);
    }
  }
  return parts.length === 0 ? '' : `[${parts.join(' ')}]`;
}

function describeClasses(element: Element): string {
  const classes = Array.from(element.classList);
  const shown = classes.slice(0, MAX_CLASSES).map((name) => `.${name}`);
  return shown.join('') + (classes.length > MAX_CLASSES ? `(+${classes.length - MAX_CLASSES})` : '');
}

/** Masked shape of the element's direct text nodes. */
function ownTextShape(element: Element): string {
  const text = Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text === '' ? '' : ` "${maskText(text, 40)}"`;
}

/**
 * Returns the anonymous structure of a DOM subtree line by line: tag, role,
 * masked ID and attributes, classes and the masked shape of the text.
 * Meant for verifying selectors; it never returns real text, names or addresses.
 */
export function describeStructure(root: Element, options: StructureOptions): string[] {
  const lines: string[] = [];

  const visit = (element: Element, depth: number) => {
    if (lines.length >= options.maxLines) {
      return;
    }
    const indent = '  '.repeat(depth);
    const tag = element.tagName.toLowerCase();
    lines.push(
      `${indent}${tag}${describeAttributes(element)}${describeClasses(element)}${ownTextShape(element)}`,
    );

    if (OPAQUE_TAGS.has(tag)) {
      return;
    }
    if (element.matches(options.collapse)) {
      lines.push(`${indent}  … ${element.querySelectorAll('*').length} elements (contents not shown)`);
      return;
    }
    if (depth >= options.maxDepth && element.children.length > 0) {
      lines.push(`${indent}  … ${element.children.length} child elements (depth limit)`);
      return;
    }
    for (const child of Array.from(element.children)) {
      visit(child, depth + 1);
    }
  };

  visit(root, 0);
  if (lines.length >= options.maxLines) {
    lines.push(`… line limit (${options.maxLines})`);
  }
  return lines;
}
