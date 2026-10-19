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
  'AI_HOST_UNAVAILABLE',
  'AI_NOT_CONNECTED',
  'AI_AUTH_FAILED',
  'AI_AUTH_EXCHANGE_FAILED',
  'AI_AUTH_TOKEN_INVALID',
  'AI_AUTH_IDENTITY_FAILED',
  'AI_AUTH_CANCELLED',
  'AI_POLICY_DENIED',
  'AI_WORKSPACE_MISMATCH',
  'AI_ACCOUNT_NAME_TAKEN',
  'AI_PLAN_REQUIRED',
  'AI_NOT_ELIGIBLE',
  'AI_ACCESS_DENIED',
  'AI_LIMIT_REACHED',
  'AI_UNAVAILABLE',
  'AI_NETWORK',
  'AI_MODEL_UNAVAILABLE',
  'AI_RESPONSE_INCOMPLETE',
  'AI_REVOKE_UNCONFIRMED',
  'AI_BUSY',
  'AI_CLAUDE_NOT_INSTALLED',
  'AI_CLAUDE_NOT_LOGGED_IN',
  /** Claude Code yalnızca kabuk olmadan güvenle başlatılamayan bir komut betiği (claude.cmd) olarak bulundu. */
  'AI_CLAUDE_UNSUPPORTED_INSTALL',
  /** Eklenti ve yerel yardımcı uygulama farklı sürümlerden; istek tanınmadı. */
  'AI_VERSION_MISMATCH',
  /** Yardımcı uygulamanın en son sürümü GitHub'dan öğrenilemedi. */
  'HOST_UPDATE_CHECK_FAILED',
  /** Güncelleme indirilemedi veya kurulamadı; kurulu sürüm değişmedi. */
  'HOST_UPDATE_FAILED',
  /** İndirilen sürümün imzası veya sağlaması doğrulanamadı; hiçbir şey kurulmadı. */
  'HOST_UPDATE_UNVERIFIED',
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
