import { DEFAULT_CONTEXT_SELECTION, type ApplyTarget } from '@email-writer/contracts';
import { buildContext, prepareAction, validatePreviewCandidate, type ActionDraft } from '@email-writer/core';
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
  if (!result.ok) throw new Error('beklenmeyen hata');
  return result.value;
}

describe('prepareAction', () => {
  it('yalnızca boşluk içeren düzeltme girdisinde işlem kaydı oluşturmaz', () => {
    const result = prepare({ source: { origin: 'panel', text: '  \n\t ' } });

    expect(result).toEqual({
      ok: false,
      error: [expect.objectContaining({ code: 'SOURCE_EMPTY', field: 'source' })],
    });
  });

  it('çeviride hedef dil yoksa LANGUAGE_REQUIRED döner', () => {
    const result = prepare({ operation: 'translate', targetLanguage: null });

    expect(result).toEqual({
      ok: false,
      error: [expect.objectContaining({ code: 'LANGUAGE_REQUIRED', field: 'targetLanguage' })],
    });
  });

  it('sınırı aşan kaynakta sayısal tanı bilgisiyle hata verir', () => {
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

  it('yeni e-postada düzeltme bağlam zorunlu olmadan hazırlanır; kullanılmayan alanlar kayda girmez', () => {
    const result = prepare({ instruction: 'yok sayılmalı' });
    if (!result.ok) throw new Error('beklenmeyen hata');

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
    // Kaynak metin kırpılmaz.
    expect(result.value.source.text).toBe('Toplantıyı yarın yapabiliriz.');
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it('çeviride ton işlem kaydına etki etmez', () => {
    const result = prepare({ operation: 'translate', tone: 'friendly' });
    if (!result.ok) throw new Error('beklenmeyen hata');

    expect(result.value.tone).toBe('neutral');
    expect(result.value.targetLanguage).toBe('en');
  });

  it('gelen mesajın çevirisinde kaynak received-message, hedef null olur', () => {
    const result = prepare({
      operation: 'translate',
      source: { origin: 'received-message', text: 'Hello there' },
    });
    if (!result.ok) throw new Error('beklenmeyen hata');

    expect(result.value.source.origin).toBe('received-message');
    expect(result.value.target).toBeNull();
  });

  it('yanıt için okunabilir mesaj yoksa işlem hazırlanmaz', () => {
    const result = prepare({ operation: 'reply', instruction: 'Kibarca teşekkür et', context: null });

    expect(result).toEqual({
      ok: false,
      error: [expect.objectContaining({ code: 'CONTEXT_REQUIRED', field: 'context' })],
    });
  });

  it('yanıtta talimat mesaj geçmişinden ayrı tutulur', () => {
    const context = replyContext();
    const result = prepare({
      operation: 'reply',
      source: { origin: 'panel', text: '' },
      instruction: 'Perşembe uygun, faturayı sonra konuşalım de.',
      context,
      target: null,
    });
    if (!result.ok) throw new Error('beklenmeyen hata');

    expect(result.value.instruction).toBe('Perşembe uygun, faturayı sonra konuşalım de.');
    expect(result.value.context?.threadRef).toEqual(threadA);
    expect(result.value.context?.messages.some((m) => m.text.includes('Perşembe uygun'))).toBe(false);
  });
});

describe('validatePreviewCandidate', () => {
  const action = (() => {
    const result = prepare();
    if (!result.ok) throw new Error('beklenmeyen hata');
    return result.value;
  })();

  const candidate = {
    requestId: action.requestId,
    sessionId: 's1',
    formRevision: 4,
    text: 'Toplantıyı yarın yapabiliriz.',
    sample: true,
  };

  it('aynı işleme ait sonucu kabul eder', () => {
    expect(validatePreviewCandidate(candidate, action)).toEqual({ status: 'accepted', candidate });
  });

  it('eski işleme ait sonucu sessizce yok sayar', () => {
    expect(validatePreviewCandidate({ ...candidate, requestId: 'eski' }, action)).toEqual({
      status: 'ignored',
    });
    expect(validatePreviewCandidate({ ...candidate, formRevision: 3 }, action)).toEqual({
      status: 'ignored',
    });
  });

  it('boş, çok uzun veya şemaya uymayan sonucu reddeder', () => {
    expect(validatePreviewCandidate({ ...candidate, text: '   ' }, action).status).toBe('rejected');
    expect(validatePreviewCandidate({ ...candidate, text: 'a'.repeat(30_001) }, action).status).toBe(
      'rejected',
    );
    expect(validatePreviewCandidate({ ...candidate, html: '<b>x</b>' }, action).status).toBe('rejected');
  });
});
