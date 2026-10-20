/**
 * Discriminated result type that carries expected errors without throwing.
 * Programming errors are not converted to this type; they are caught at the app boundary.
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
 * Environment-independent cancellation signal. The browser's `AbortSignal` satisfies this
 * interface structurally; `core` and `contracts` do not depend on DOM types.
 */
export interface AbortSignalLike {
  readonly aborted: boolean;
}
