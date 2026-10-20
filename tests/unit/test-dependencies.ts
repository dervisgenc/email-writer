import type { Clock, IdGenerator } from '@writehand/core';

export function fixedClock(iso = '2026-10-13T10:00:00.000Z'): Clock {
  return { now: () => iso };
}

export function sequentialIds(prefix = 'id'): IdGenerator {
  let counter = 0;
  return {
    next: () => {
      counter += 1;
      return `${prefix}-${counter}`;
    },
  };
}

export function testDependencies() {
  return { clock: fixedClock(), ids: sequentialIds() };
}
