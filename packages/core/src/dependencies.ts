/**
 * The clock and ID generation are injected so tests do not depend on the real clock or
 * random IDs.
 */
export interface Clock {
  /** Current time in ISO 8601 format. */
  now(): string;
}

export interface IdGenerator {
  next(): string;
}
