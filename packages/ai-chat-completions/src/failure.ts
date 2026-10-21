import { appError, err, ok, type AppError, type ErrorCode, type Result } from '@writehand/contracts';

/** A failure with a stable code, thrown inside this package and returned as a `Result` at its boundary. */
export class ProviderFailure extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
  }
}

/**
 * Maps an HTTP error to a stable code. `code` is the provider's error code, when it sends one
 * (Groq: `invalid_api_key`, `model_not_found`; OpenRouter repeats the status as a number).
 */
export function failureFor(status: number, code?: string): ProviderFailure {
  if (status === 401 || code === 'invalid_api_key') return new ProviderFailure('AI_KEY_INVALID');
  // Groq answers 413 when one request exceeds the plan's tokens per minute; waiting does not help.
  if (status === 413 || code === 'context_length_exceeded')
    return new ProviderFailure('AI_REQUEST_TOO_LARGE');
  // 402: OpenRouter has no credits left for a paid model.
  if (status === 402 || status === 429 || code === 'rate_limit_exceeded')
    return new ProviderFailure('AI_LIMIT_REACHED');
  if (status === 403) return new ProviderFailure('AI_ACCESS_DENIED');
  if (status === 404 || code === 'model_not_found' || code === 'model_decommissioned')
    return new ProviderFailure('AI_MODEL_UNAVAILABLE');
  return new ProviderFailure('AI_UNAVAILABLE');
}

function codeOf(caught: unknown): ErrorCode {
  if (caught instanceof ProviderFailure) return caught.code;
  if (caught instanceof Error && (caught.name === 'AbortError' || caught.name === 'TimeoutError'))
    return 'READ_CANCELLED';
  // `fetch` rejects with a TypeError when the provider cannot be reached at all.
  if (caught instanceof TypeError) return 'AI_NETWORK';
  // An answer in an unexpected format (invalid JSON, a changed model list).
  return 'AI_UNAVAILABLE';
}

/** Runs a provider call and turns every failure into a stable code; no response text is kept. */
export async function settle<T>(work: () => Promise<T>): Promise<Result<T, AppError>> {
  try {
    return ok(await work());
  } catch (caught) {
    return err(appError(codeOf(caught)));
  }
}
