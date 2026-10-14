import type { ErrorCode } from '@email-writer/contracts';

/**
 * Eklentinin tek kayıt noktası. Yalnızca hata kodu, alan adı ve kişisel içerik
 * taşımayan sayılar kabul edilir; e-posta gövdesi, konu, adres, kaynak metin,
 * önizleme veya tam URL buraya yazılamaz. Normal derlemede sessizdir.
 */
export interface DiagnosticEvent {
  readonly code: ErrorCode | 'UNHANDLED';
  readonly area: 'content-script' | 'background' | 'popup' | 'options' | 'connector';
  readonly numbers?: Readonly<Record<string, number>>;
}

export function reportDiagnostic(event: DiagnosticEvent): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console -- tek ve içeriksiz tanı çıkışı
    console.warn('[email-writer]', event.area, event.code, event.numbers ?? {});
  }
}
