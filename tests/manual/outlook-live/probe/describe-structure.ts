import { maskIdentifier, maskText } from './mask-text';

/** Değeri olduğu gibi gösterilen, içerik taşımayan yapısal öznitelikler. */
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

/** Kimlik başvurusu taşıyan öznitelikler: değerleri kimlik gibi maskelenir. */
const REFERENCE_ATTRIBUTES = new Set(['id', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'for']);

/** Değeri ad, konu veya adres içerebilen öznitelikler: biçimi maskelenerek gösterilir. */
const MASKED_ATTRIBUTES = new Set(['aria-label', 'title', 'alt', 'aria-description', 'placeholder']);

/** İçi gösterilmeyen elemanlar. */
const OPAQUE_TAGS = new Set(['svg', 'script', 'style', 'noscript', 'template', 'img', 'iframe']);

const MAX_CLASSES = 4;

export interface StructureOptions {
  readonly maxDepth: number;
  readonly maxLines: number;
  /** Bu seçiciye uyan elemanların içi dökülmez (ör. e-posta gövdesi). */
  readonly collapse: string;
}

/** Boşluk veya `@` içeren değer doğal metin ya da adres olabilir. */
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
      // Outlook'un kendi işaretleri (ör. data-testid) olduğu gibi kalır; sayılar ve opak kimlikler gizlenir.
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

/** Elemanın doğrudan metin düğümlerinin maskeli biçimi. */
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
 * Bir DOM alt ağacının anonim yapısını satır satır verir: etiket, rol,
 * maskeli kimlik ve öznitelikler, sınıflar ve metnin maskeli biçimi.
 * Seçici doğrulamak içindir; gerçek metin, ad veya adres döndürmez.
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
      lines.push(`${indent}  … ${element.querySelectorAll('*').length} eleman (içi gösterilmiyor)`);
      return;
    }
    if (depth >= options.maxDepth && element.children.length > 0) {
      lines.push(`${indent}  … ${element.children.length} alt eleman (derinlik sınırı)`);
      return;
    }
    for (const child of Array.from(element.children)) {
      visit(child, depth + 1);
    }
  };

  visit(root, 0);
  if (lines.length >= options.maxLines) {
    lines.push(`… satır sınırı (${options.maxLines})`);
  }
  return lines;
}
