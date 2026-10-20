/**
 * Context limits. These are starting values for the first implementation, not measured
 * product limits, and are defined only here. Not a token count.
 */
export interface ContextPolicy {
  readonly version: number;
  readonly maxMessages: number;
  /** Limit for the total context text, in UTF-16 code units. */
  readonly maxTotalLength: number;
}

export const DEFAULT_CONTEXT_POLICY: ContextPolicy = Object.freeze({
  version: 1,
  maxMessages: 20,
  maxTotalLength: 60_000,
});
