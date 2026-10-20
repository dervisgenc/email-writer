import type { EmailBlock, EmailDocument, Inline } from './document';
import { formatChartValue } from './render-html';

function inlineText(inlines: readonly Inline[], links: 'inline' | 'text-only'): string {
  return inlines
    .map((inline) => {
      switch (inline.type) {
        case 'text':
          return inline.text;
        case 'break':
          return '\n';
        case 'strong':
        case 'em':
          return inlineText(inline.children, links);
        case 'link': {
          const label = inlineText(inline.children, links);
          const href = inline.href.replace(/^mailto:/i, '');
          return links === 'inline' && label !== href ? `${label} (${href})` : label;
        }
      }
    })
    .join('');
}

function blockText(block: EmailBlock, locale: string | undefined): string {
  switch (block.type) {
    case 'paragraph':
      return block.lines.map((line) => inlineText(line, 'inline')).join('\n');
    case 'list':
      return block.items
        .map(
          (item, index) => `${block.ordered ? `${block.start + index}.` : '-'} ${inlineText(item, 'inline')}`,
        )
        .join('\n');
    case 'table':
      return [block.header, ...block.rows]
        .map((row) => row.map((cell) => inlineText(cell, 'inline')).join(' | '))
        .join('\n');
    case 'chart':
      return [
        ...(block.chart.title ? [block.chart.title] : []),
        ...block.chart.data.map(
          (point) => `${point.label}: ${formatChartValue(point.value, block.chart.unit, locale)}`,
        ),
      ].join('\n');
  }
}

/** Plain-text equivalent for copying, plain-text targets and fallback display. */
export function renderPlainText(document: EmailDocument, options: { locale?: string } = {}): string {
  return document.blocks.map((block) => blockText(block, options.locale)).join('\n\n');
}

/**
 * Text expected to be read back from the draft after writing to the editor: link addresses
 * and chart bars are not text; list items start with "- " or their number, as the reader
 * produces them. Write verification compares against this.
 */
export function renderVisibleText(document: EmailDocument, options: { locale?: string } = {}): string {
  return document.blocks
    .map((block) => {
      switch (block.type) {
        case 'paragraph':
          return block.lines.map((line) => inlineText(line, 'text-only')).join('\n');
        case 'list':
          return block.items
            .map((item, index) => `${block.ordered ? `${index + 1}.` : '-'} ${inlineText(item, 'text-only')}`)
            .join('\n');
        case 'table':
          return [block.header, ...block.rows]
            .map((row) => row.map((cell) => inlineText(cell, 'text-only')).join(' | '))
            .join('\n');
        case 'chart':
          return [
            ...(block.chart.title ? [block.chart.title] : []),
            ...block.chart.data.map(
              (point) => `${point.label} ${formatChartValue(point.value, block.chart.unit, options.locale)}`,
            ),
          ].join('\n');
      }
    })
    .join('\n');
}
