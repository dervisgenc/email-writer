import { DEFAULT_CONTEXT_SELECTION, type ApplyTarget } from '@writehand/contracts';
import { buildContext, prepareAction, validatePreviewCandidate, type ActionDraft } from '@writehand/core';
import { describe, expect, it } from 'vitest';

import { meetingThread, scopeA, threadA } from '../../fixtures/synthetic-mail/threads';
import { testDependencies } from '../test-dependencies';

const composerRef = { scope: scopeA, composerKey: 'composer-1', threadKey: 'thread-a' };
const selectionTarget: ApplyTarget = {
  mode: 'replace-selection',
  composerRef,
  expectedRevision: 3,
  selectionId: 'sel-1',
};

function draft(overrides: Partial<ActionDraft> = {}): ActionDraft {
  return {
    operation: 'revise',
    source: { origin: 'draft-selection', text: 'Toplantıyı yarın yapabiliriz.' },
    instruction: '',
    targetLanguage: 'en',
    tone: 'formal',
    context: null,
    target: selectionTarget,
    ...overrides,
  };
}

function prepare(overrides: Partial<ActionDraft> = {}) {
  return prepareAction({ sessionId: 's1', formRevision: 4, draft: draft(overrides) }, testDependencies());
}

function replyContext() {
  const result = buildContext(
    {
      expectedThread: threadA,
      snapshot: meetingThread(),
      selection: DEFAULT_CONTEXT_SELECTION,
      includedBlocks: [],
    },
    testDependencies(),
  );
  if (!result.ok) throw new Error('unexpected error');
  return result.value;
}

describe('prepareAction', () => {
  it('creates no action record for revise input that contains only whitespace', () => {
    const result = prepare({ source: { origin: 'panel', text: '  \n\t ' } });

    expect(result).toEqual({
      ok: false,
      error: [expect.objectContaining({ code: 'SOURCE_EMPTY', field: 'source' })],
    });
  });

  it('returns LANGUAGE_REQUIRED for a translation without a target language', () => {
    const result = prepare({ operation: 'translate', targetLanguage: null });

    expect(result).toEqual({
      ok: false,
      error: [expect.objectContaining({ code: 'LANGUAGE_REQUIRED', field: 'targetLanguage' })],
    });
  });

  it('fails with numeric diagnostics when the source exceeds the limit', () => {
    const result = prepare({ source: { origin: 'panel', text: 'a'.repeat(20_001) } });

    expect(result).toEqual({
      ok: false,
      error: [
        expect.objectContaining({
          code: 'SOURCE_TOO_LARGE',
          details: { limit: 20_000, length: 20_001 },
        }),
      ],
    });
  });

  it('prepares a revise in a new email without requiring context, leaving unused fields out of the record', () => {
    const result = prepare({ instruction: 'yok sayılmalı' });
    if (!result.ok) throw new Error('unexpected error');

    expect(result.value).toMatchObject({
      requestId: 'id-1',
      sessionId: 's1',
      formRevision: 4,
      operation: 'revise',
      targetLanguage: null,
      tone: 'formal',
      instruction: '',
      context: null,
      target: selectionTarget,
    });
    // The source text is not trimmed.
    expect(result.value.source.text).toBe('Toplantıyı yarın yapabiliriz.');
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it('ignores the tone in the action record for a translation', () => {
    const result = prepare({ operation: 'translate', tone: 'friendly' });
    if (!result.ok) throw new Error('unexpected error');

    expect(result.value.tone).toBe('neutral');
    expect(result.value.targetLanguage).toBe('en');
  });

  it('uses a received-message source and a null target when translating a received message', () => {
    const result = prepare({
      operation: 'translate',
      source: { origin: 'received-message', text: 'Hello there' },
    });
    if (!result.ok) throw new Error('unexpected error');

    expect(result.value.source.origin).toBe('received-message');
    expect(result.value.target).toBeNull();
  });

  it('prepares no reply without a readable message', () => {
    const result = prepare({ operation: 'reply', instruction: 'Kibarca teşekkür et', context: null });

    expect(result).toEqual({
      ok: false,
      error: [expect.objectContaining({ code: 'CONTEXT_REQUIRED', field: 'context' })],
    });
  });

  it('keeps the reply instruction separate from the message history', () => {
    const context = replyContext();
    const result = prepare({
      operation: 'reply',
      source: { origin: 'panel', text: '' },
      instruction: 'Perşembe uygun, faturayı sonra konuşalım de.',
      context,
      target: null,
    });
    if (!result.ok) throw new Error('unexpected error');

    expect(result.value.instruction).toBe('Perşembe uygun, faturayı sonra konuşalım de.');
    expect(result.value.context?.threadRef).toEqual(threadA);
    expect(result.value.context?.messages.some((m) => m.text.includes('Perşembe uygun'))).toBe(false);
  });
});

describe('validatePreviewCandidate', () => {
  const action = (() => {
    const result = prepare();
    if (!result.ok) throw new Error('unexpected error');
    return result.value;
  })();

  const candidate = {
    requestId: action.requestId,
    sessionId: 's1',
    formRevision: 4,
    text: 'Toplantıyı yarın yapabiliriz.',
    sample: true,
  };

  it('accepts a result for the same action', () => {
    expect(validatePreviewCandidate(candidate, action)).toEqual({ status: 'accepted', candidate });
  });

  it('silently ignores a result for an earlier action', () => {
    expect(validatePreviewCandidate({ ...candidate, requestId: 'eski' }, action)).toEqual({
      status: 'ignored',
    });
    expect(validatePreviewCandidate({ ...candidate, formRevision: 3 }, action)).toEqual({
      status: 'ignored',
    });
  });

  it('rejects an empty, overlong or schema-violating result', () => {
    expect(validatePreviewCandidate({ ...candidate, text: '   ' }, action).status).toBe('rejected');
    expect(validatePreviewCandidate({ ...candidate, text: 'a'.repeat(30_001) }, action).status).toBe(
      'rejected',
    );
    expect(validatePreviewCandidate({ ...candidate, html: '<b>x</b>' }, action).status).toBe('rejected');
  });
});
