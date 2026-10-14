/**
 * Kararlı hata kodları. Kod, hatanın kaynağını programatik olarak ayırır;
 * kullanıcıya gösterilen açıklama eklentinin `locales/` dosyalarından gelir.
 */
export const ERROR_CODES = [
  'PAGE_UNSUPPORTED',
  'PAGE_NOT_READY',
  'THREAD_CHANGED',
  'ACCOUNT_CHANGED',
  'TARGET_MISSING',
  'TARGET_CHANGED',
  'SELECTION_INVALID',
  'SOURCE_EMPTY',
  'SOURCE_TOO_LARGE',
  'CONTEXT_TOO_LARGE',
  'CONTEXT_REQUIRED',
  'CONTEXT_STALE',
  'LANGUAGE_REQUIRED',
  'RESULT_INVALID',
  'RESULT_UNCHANGED',
  'PREVIEW_STALE',
  'SETTINGS_CONFLICT',
  'SETTINGS_INVALID',
  'READ_TIMEOUT',
  'READ_CANCELLED',
  'WRITE_UNSUPPORTED',
  'WRITE_UNCERTAIN',
  'UNDO_INVALID',
  'CLIPBOARD_UNAVAILABLE',
  'EXTENSION_RELOADED',
  'PROCESSING_UNAVAILABLE',
  'CONTENT_SCRIPT_UNREACHABLE',
  'MESSAGE_REJECTED',
  'UNEXPECTED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Hatanın panelde ilişkilendirileceği alan. */
export type ErrorField = 'source' | 'instruction' | 'targetLanguage' | 'context' | 'target' | 'preview';

export interface AppError {
  readonly code: ErrorCode;
  readonly field?: ErrorField;
  /**
   * Yalnızca içerik taşımayan sayısal tanı bilgisi (sınır, uzunluk, sayı).
   * E-posta metni, adres veya URL buraya asla yazılmaz.
   */
  readonly details?: Readonly<Record<string, number>>;
}

export function appError(
  code: ErrorCode,
  options: { field?: ErrorField; details?: Record<string, number> } = {},
): AppError {
  return Object.freeze({
    code,
    ...(options.field ? { field: options.field } : {}),
    ...(options.details ? { details: Object.freeze({ ...options.details }) } : {}),
  });
}
