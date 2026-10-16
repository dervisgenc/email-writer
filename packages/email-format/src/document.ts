/**
 * Modelin döndürdüğü sınırlı Markdown'ın ayrıştırılmış hâli. HTML yalnızca bu
 * yapıdan üretilir; modelden gelen metin hiçbir zaman HTML olarak yorumlanmaz.
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

/** Düz paragraflardan fazlası (biçim, liste, tablo, grafik, bağlantı) var mı? */
export function isRichDocument(document: EmailDocument): boolean {
  const richInline = (inlines: readonly Inline[]): boolean =>
    inlines.some((inline) => inline.type !== 'text' && inline.type !== 'break');
  return document.blocks.some((block) => block.type !== 'paragraph' || block.lines.some(richInline));
}
