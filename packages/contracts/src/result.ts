/**
 * Beklenen hataları istisna fırlatmadan taşıyan ayrımlı sonuç tipi.
 * Programlama hataları bu tipe çevrilmez; uygulama sınırında yakalanır.
 */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Ortamdan bağımsız iptal sinyali. Tarayıcının `AbortSignal` nesnesi bu
 * arayüzü yapısal olarak karşılar; `core` ve `contracts` DOM tiplerine bağlanmaz.
 */
export interface AbortSignalLike {
  readonly aborted: boolean;
}
