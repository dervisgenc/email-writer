import { buildContext, describeContext } from '@writehand/core';
import { describe, expect, it } from 'vitest';

import { body, message, thread, threadA } from '../../fixtures/synthetic-mail/threads';
import { testDependencies } from '../test-dependencies';

describe('describeContext', () => {
  it('describes missing coverage and excluded messages separately', () => {
    const snapshot = thread(
      [message('m1', 0, [body('Bir')]), message('m2', 1, [body('İki')]), message('m3', 2, [body('Üç')])],
      {
        coverage: {
          source: 'visible-dom',
          status: 'partial',
          readableMessageCount: 3,
          knownUnreadableMessageCount: 2,
          reasons: ['collapsed-messages', 'unverified-history'],
        },
      },
    );
    const context = buildContext(
      {
        expectedThread: threadA,
        snapshot,
        selection: { included: [], excluded: ['m1'] },
        includedBlocks: [],
      },
      testDependencies(),
    );
    if (!context.ok) throw new Error('unexpected error');

    expect(describeContext(context.value)).toEqual([
      { kind: 'message-count', count: 2 },
      { kind: 'collapsed-unread', count: 2 },
      { kind: 'coverage-unverified' },
      { kind: 'user-excluded', count: 1 },
      { kind: 'display-order-used' },
    ]);
  });
});
