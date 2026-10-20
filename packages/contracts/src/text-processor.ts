import type { PreparedAction, PreviewCandidate } from './actions';
import type { AppError } from './errors';
import type { AbortSignalLike, Result } from './result';

/**
 * Boundary that takes a prepared action and returns a plain-text result for that same action.
 *
 * The real connection sends the text to the background/local AI module. The test build uses
 * a sample result at the same boundary. Provider details never leak into the business logic.
 */
export interface TextProcessor {
  readonly kind: 'development-sample' | 'connected';
  process(action: PreparedAction, signal: AbortSignalLike): Promise<Result<PreviewCandidate, AppError>>;
}
