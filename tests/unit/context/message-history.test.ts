import {
  EMPTY_HISTORY,
  isRelatedEntry,
  normalizeSubject,
  recordSnapshot,
  type HistoryEntry,
} from '@writehand/core';
import { describe, expect, it } from 'vitest';

import { body, message, scopeB, thread, threadA, threadB } from '../../fixtures/synthetic-mail/threads';

describe('read message history', () => {
  it('accumulates reads in first-read order, updating the content of a repeated message while keeping its position', () => {
    const first = recordSnapshot(EMPTY_HISTORY, thread([message('a', 0, [body('A')])]));
    const second = recordSnapshot(first, thread([message('b', 0, [body('B')])], { ref: threadB }));
    const third = recordSnapshot(second, thread([message('a', 0, [body('A güncel')])]));

    expect(third.entries.map((entry) => [entry.message.messageKey, entry.order])).toEqual([
      ['a', 0],
      ['b', 1],
    ]);
    expect(third.entries[0]?.message.blocks[0]?.text).toBe('A güncel');
    expect(third.entries[1]?.threadRef).toEqual(threadB);
  });

  it('drops the oldest messages when the limit is exceeded', () => {
    let history = EMPTY_HISTORY;
    for (const key of ['a', 'b', 'c']) {
      history = recordSnapshot(history, thread([message(key, 0, [body(key)])]), 2);
    }

    expect(history.entries.map((entry) => entry.message.messageKey)).toEqual(['b', 'c']);
  });

  it('strips reply/forward prefixes from the subject and never matches an empty subject', () => {
    expect(normalizeSubject('RE: FW:  Teklif   revizyonu')).toBe('teklif revizyonu');
    expect(normalizeSubject('YNT: İLT: Teklif')).toBe('teklif');
    expect(normalizeSubject('RE[2]: AW: Teklif')).toBe('teklif');
    expect(normalizeSubject('Re: ')).toBeNull();
    expect(normalizeSubject(null)).toBeNull();
    // A colon that is not part of a prefix is kept.
    expect(normalizeSubject('Rapor: Ekim')).toBe('rapor: ekim');
  });

  it('treats the same conversation or subject as related, but never another account', () => {
    const entry = (threadRef = threadB, subject: string | null = 'RE: Teklif'): HistoryEntry => ({
      threadRef,
      subject,
      message: message('x', 0, [body('x')]),
      order: 0,
    });

    expect(isRelatedEntry(entry(threadA, 'Başka'), threadA, 'Teklif')).toBe(true);
    expect(isRelatedEntry(entry(), threadA, 'Teklif')).toBe(true);
    expect(isRelatedEntry(entry(threadB, 'Fatura'), threadA, 'Teklif')).toBe(false);
    expect(isRelatedEntry(entry(threadB, null), threadA, null)).toBe(false);
    expect(isRelatedEntry(entry({ ...threadA, scope: scopeB }), threadA, 'Teklif')).toBe(false);
  });
});
