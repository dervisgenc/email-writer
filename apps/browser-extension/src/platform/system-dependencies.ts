import type { Clock, IdGenerator } from '@email-writer/core';

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
};

export function createRandomIds(): IdGenerator {
  return { next: () => crypto.randomUUID() };
}
