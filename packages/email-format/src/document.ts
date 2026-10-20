/**
 * Parsed form of the limited Markdown the model returns. HTML is generated only from this
 * structure; text from the model is never interpreted as HTML.
 */
export type Inline =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'strong'; readonly children: readonly Inline[] }
  | { readonly type: 'em'; readonly children: readonly Inline[] }
  | { readonly type: 'link'; readonly href: string; readonly children: readonly Inline[] }
  | { readonly type: 'break' };

export type CellAlign = 'left' | 'center' | 'right' | null;

export interface ChartPoint {
  readonly label: string;
  readonly value: number;
}

export interface ChartSpec {
  readonly title: string | null;
  readonly unit: string | null;
  readonly data: readonly ChartPoint[];
}

export type EmailBlock =
  | { readonly type: 'paragraph'; readonly lines: readonly (readonly Inline[])[] }
  | {
      readonly type: 'list';
      readonly ordered: boolean;
      readonly start: number;
      readonly items: readonly (readonly Inline[])[];
    }
  | {
      readonly type: 'table';
      readonly align: readonly CellAlign[];
      readonly header: readonly (readonly Inline[])[];
      readonly rows: readonly (readonly (readonly Inline[])[])[];
    }
  | { readonly type: 'chart'; readonly chart: ChartSpec };

export interface EmailDocument {
  readonly blocks: readonly EmailBlock[];
}

/** Does the document contain more than plain paragraphs (formatting, lists, tables, charts, links)? */
export function isRichDocument(document: EmailDocument): boolean {
  const richInline = (inlines: readonly Inline[]): boolean =>
    inlines.some((inline) => inline.type !== 'text' && inline.type !== 'break');
  return document.blocks.some((block) => block.type !== 'paragraph' || block.lines.some(richInline));
}
