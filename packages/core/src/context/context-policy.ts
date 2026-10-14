/**
 * Bağlam sınırları. Ölçülmüş ürün sınırları değil, ilk implementasyon için
 * başlangıç kararlarıdır ve yalnızca burada tanımlanır. Token hesabı değildir.
 */
export interface ContextPolicy {
  readonly version: number;
  readonly maxMessages: number;
  /** UTF-16 birimi cinsinden toplam bağlam metni sınırı. */
  readonly maxTotalLength: number;
}

export const DEFAULT_CONTEXT_POLICY: ContextPolicy = Object.freeze({
  version: 1,
  maxMessages: 20,
  maxTotalLength: 60_000,
});
