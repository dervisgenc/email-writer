/**
 * İşlem doğrulama sınırları (UTF-16 birimi). Token hesabı değildir; tek
 * yerde tanımlanır.
 */
export const ACTION_LIMITS = Object.freeze({
  /** Düzeltme veya çeviri kaynağı. */
  maxSourceLength: 20_000,
  /** Yanıt talimatı. */
  maxInstructionLength: 5_000,
  /** Önizlemeye kabul edilen metin. */
  maxPreviewLength: 30_000,
});
