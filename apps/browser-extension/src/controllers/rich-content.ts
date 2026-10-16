import type { ApplyRequest } from '@email-writer/contracts';
import {
  isRichDocument,
  parseEmailMarkdown,
  renderEmailHtml,
  renderPlainText,
  renderVisibleText,
} from '@email-writer/email-format';

/** Panoya veya taslağa giden içerik: her zaman düz metin, biçimliyse HTML de. */
export interface ClipboardContent {
  readonly text: string;
  readonly html: string | null;
}

/** Önizleme metninin (sınırlı Markdown) panoya kopyalanacak hâli. */
export function clipboardContent(previewText: string): ClipboardContent {
  const document = parseEmailMarkdown(previewText);
  return {
    text: renderPlainText(document),
    html: isRichDocument(document) ? renderEmailHtml(document) : null,
  };
}

/**
 * Yazma isteğini hedefe göre hazırlar. Cümle içindeki bir seçim düz metin olarak
 * olduğu gibi yazılır; taslağın tamamına yazarken Markdown işaretleri temizlenir ve
 * biçimli içerik (liste, tablo, grafik) HTML olarak verilir.
 */
export function withRichContent(request: ApplyRequest): ApplyRequest {
  if (request.target.mode === 'replace-selection') return request;
  const document = parseEmailMarkdown(request.text);
  const text = renderPlainText(document);
  if (!isRichDocument(document)) return { ...request, text };
  return {
    ...request,
    text,
    rich: { html: renderEmailHtml(document), visibleText: renderVisibleText(document) },
  };
}
