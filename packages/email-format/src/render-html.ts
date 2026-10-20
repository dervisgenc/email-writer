import type { CellAlign, ChartSpec, EmailBlock, EmailDocument, Inline } from './document';

export interface HtmlOptions {
  /** Locale used to format chart values. */
  readonly locale?: string;
}

const BORDER = '#d1d1d1';
const HEADER_BACKGROUND = '#f5f5f5';
const BAR_COLOR = '#0f6cbd';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineHtml(inlines: readonly Inline[]): string {
  return inlines
    .map((inline) => {
      switch (inline.type) {
        case 'text':
          return escapeHtml(inline.text);
        case 'break':
          return '<br>';
        case 'strong':
          return `<b>${inlineHtml(inline.children)}</b>`;
        case 'em':
          return `<i>${inlineHtml(inline.children)}</i>`;
        case 'link':
          return `<a href="${escapeHtml(inline.href)}">${inlineHtml(inline.children)}</a>`;
      }
    })
    .join('');
}

/** An empty line is written as `<div><br></div>`, as Outlook does. */
const lineHtml = (inlines: readonly Inline[]) =>
  `<div>${inlines.length > 0 ? inlineHtml(inlines) : '<br>'}</div>`;

export function formatChartValue(value: number, unit: string | null, locale?: string): string {
  let number: string;
  try {
    number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  } catch {
    number = String(value);
  }
  return unit ? `${number} ${unit}` : number;
}

function cellStyle(align: CellAlign, header: boolean): string {
  return [
    `border:1px solid ${BORDER}`,
    'padding:6px 10px',
    'vertical-align:top',
    `text-align:${align ?? 'left'}`,
    ...(header ? [`background:${HEADER_BACKGROUND}`, 'font-weight:600'] : []),
  ].join(';');
}

function tableHtml(block: Extract<EmailBlock, { type: 'table' }>): string {
  const head = block.header
    .map(
      (cell, column) =>
        `<th style="${cellStyle(block.align[column] ?? null, true)}">${inlineHtml(cell)}</th>`,
    )
    .join('');
  const body = block.rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell, column) =>
              `<td style="${cellStyle(block.align[column] ?? null, false)}">${inlineHtml(cell)}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');
  return `<table style="border-collapse:collapse;border:1px solid ${BORDER}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * Email-safe horizontal bar chart built from nested tables and inline styles.
 * No images, scripts or SVG, so it renders in every email client.
 */
function chartHtml(chart: ChartSpec, options: HtmlOptions): string {
  const max = Math.max(...chart.data.map((point) => Math.abs(point.value)), 0);
  const rows = chart.data
    .map((point) => {
      const share = max === 0 ? 0 : Math.abs(point.value) / max;
      const width = point.value === 0 ? 0 : Math.max(1, Math.round(share * 100));
      const bar =
        width === 0
          ? '&nbsp;'
          : `<table role="presentation" style="border-collapse:collapse;width:${width}%"><tr><td style="height:14px;line-height:14px;font-size:1px;background:${BAR_COLOR}">&nbsp;</td></tr></table>`;
      return (
        '<tr>' +
        `<td style="padding:4px 12px 4px 0;white-space:nowrap;vertical-align:middle">${escapeHtml(point.label)}</td>` +
        `<td style="padding:4px 0;width:100%;min-width:160px;vertical-align:middle">${bar}</td>` +
        `<td style="padding:4px 0 4px 12px;white-space:nowrap;text-align:right;vertical-align:middle">${escapeHtml(
          formatChartValue(point.value, chart.unit, options.locale),
        )}</td>` +
        '</tr>'
      );
    })
    .join('');
  const title = chart.title ? `<div><b>${escapeHtml(chart.title)}</b></div>` : '';
  return `${title}<table role="presentation" style="border-collapse:collapse;width:100%;max-width:560px">${rows}</table>`;
}

function blockHtml(block: EmailBlock, options: HtmlOptions): string {
  switch (block.type) {
    case 'paragraph':
      return block.lines.map(lineHtml).join('');
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul';
      const start = block.ordered && block.start !== 1 ? ` start="${block.start}"` : '';
      const items = block.items.map((item) => `<li>${inlineHtml(item)}</li>`).join('');
      return `<${tag}${start} style="margin-top:0;margin-bottom:0">${items}</${tag}>`;
    }
    case 'table':
      return tableHtml(block);
    case 'chart':
      return chartHtml(block.chart, options);
  }
}

/** HTML to insert into the draft. Blocks are separated by an empty line, as in Outlook. */
export function renderEmailHtml(document: EmailDocument, options: HtmlOptions = {}): string {
  return document.blocks.map((block) => blockHtml(block, options)).join('<div><br></div>');
}
