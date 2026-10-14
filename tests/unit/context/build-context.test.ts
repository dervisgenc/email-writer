import { buildContext, type BuildContextInput } from '@email-writer/core';
import { describe, expect, it } from 'vitest';

import {
  body,
  meetingThread,
  message,
  quote,
  scopeB,
  signature,
  thread,
  threadA,
} from '../../fixtures/synthetic-mail/threads';
import { sequentialIds, testDependencies } from '../test-dependencies';

function input(overrides: Partial<BuildContextInput> = {}): BuildContextInput {
  return {
    expectedThread: threadA,
    snapshot: meetingThread(),
    selection: { mode: 'automatic' },
    includedBlocks: [],
    ...overrides,
  };
}

describe('buildContext', () => {
  it('başka hesap veya konuşmaya ait snapshot reddedilir', () => {
    const snapshot = { ...meetingThread(), ref: { ...threadA, scope: scopeB } };
    const result = buildContext(input({ snapshot }), testDependencies());

    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'THREAD_CHANGED' }) });
  });

  it('kesin imzaları ve kanıtlanmış tekrar alıntıları çıkarır, gövdeyi korur', () => {
    const result = buildContext(input(), testDependencies());
    if (!result.ok) throw new Error('beklenmeyen hata');

    expect(result.value.messages.map((m) => m.text)).toEqual([
      'Merhaba Ayşe,\n\nPerşembe 14:00 toplantısını teyit edebilir misin?',
      'Hi Mehmet,\n\nThursday works for me. Can we also review the 1.250,00 TL invoice?',
      'Tamam, faturayı da gündeme ekledim. 😊',
    ]);
    expect(result.value.omissions).toEqual(
      expect.arrayContaining([
        { messageKey: 'm1', blockIndex: 1, reason: 'signature' },
        { messageKey: 'm2', blockIndex: 1, reason: 'signature' },
        { messageKey: 'm2', blockIndex: 2, reason: 'duplicate-quote' },
        { messageKey: 'm3', blockIndex: 1, reason: 'duplicate-quote' },
      ]),
    );
    expect(result.value.ordering).toBe('sent-at');
    expect(result.value.activeMessageKey).toBe('m3');
  });

  it('bağlamda olmayan içerik taşıyan alıntıyı korur', () => {
    const snapshot = thread([
      message('m1', 0, [body('İlk mesaj')]),
      message('m2', 1, [
        body('Cevap'),
        quote('From: X\n\nİlk mesaj\n\nFrom: Y\n\nHiç okunmamış eski bir mesaj'),
      ]),
    ]);
    const result = buildContext(input({ snapshot }), testDependencies());
    if (!result.ok) throw new Error('beklenmeyen hata');

    expect(result.value.messages[1]?.text).toContain('Hiç okunmamış eski bir mesaj');
    expect(result.value.omissions.some((o) => o.reason === 'duplicate-quote')).toBe(false);
  });

  it('emin olunamayan imza veya alıntı çıkarılmaz', () => {
    const snapshot = thread([
      message('m1', 0, [body('Merhaba'), signature('Teşekkürler', 'uncertain')]),
      message('m2', 1, [body('Selam'), quote('From: A\n\nMerhaba', 'uncertain')]),
    ]);
    const result = buildContext(input({ snapshot }), testDependencies());
    if (!result.ok) throw new Error('beklenmeyen hata');

    expect(result.value.messages.map((m) => m.text)).toEqual([
      'Merhaba\n\nTeşekkürler',
      'Selam\n\nFrom: A\n\nMerhaba',
    ]);
    expect(result.value.omissions).toEqual([]);
  });

  it('kullanıcının geri dahil ettiği blok bağlamda kalır', () => {
    const result = buildContext(
      input({ includedBlocks: [{ messageKey: 'm1', blockIndex: 1 }] }),
      testDependencies(),
    );
    if (!result.ok) throw new Error('beklenmeyen hata');

    expect(result.value.messages[0]?.text).toContain('Saygılarımla,\nMehmet Demir');
  });

  it('aynı mesaj kimliği iki kez okunduysa tek mesaj alınır', () => {
    const repeated = message('m1', 0, [body('Merhaba')]);
    const snapshot = thread([repeated, { ...repeated, displayOrder: 1 }]);
    const result = buildContext(input({ snapshot }), testDependencies());
    if (!result.ok) throw new Error('beklenmeyen hata');

    expect(result.value.messages).toHaveLength(1);
    expect(result.value.omissions).toContainEqual({ messageKey: 'm1', reason: 'duplicate-message' });
  });

  it('aynı içerikli iki ayrı gerçek mesaj korunur', () => {
    const snapshot = thread([message('m1', 0, [body('Tamam')]), message('m2', 1, [body('Tamam')])]);
    const result = buildContext(input({ snapshot }), testDependencies());
    if (!result.ok) throw new Error('beklenmeyen hata');

    expect(result.value.messages.map((m) => m.messageKey)).toEqual(['m1', 'm2']);
  });

  it('tarih eksikse yapay tarih üretmez ve ekran sırasını kullanır', () => {
    const snapshot = thread([
      message('m2', 1, [body('İkinci')], { sentAt: '2026-10-11T09:00:00.000Z' }),
      message('m1', 0, [body('Birinci')], { sentAt: null, sentAtText: 'Dün' }),
    ]);
    const result = buildContext(input({ snapshot }), testDependencies());
    if (!result.ok) throw new Error('beklenmeyen hata');

    expect(result.value.ordering).toBe('display-order');
    expect(result.value.messages.map((m) => [m.messageKey, m.sentAt, m.sentAtText])).toEqual([
      ['m1', null, 'Dün'],
      ['m2', '2026-10-11T09:00:00.000Z', null],
    ]);
  });

  it('otomatik seçimde sınır aşılırsa aktif mesajı korur, eski mesajları raporlar', () => {
    const snapshot = thread(
      [
        message('m1', 0, [body('a'.repeat(40))]),
        message('m2', 1, [body('b'.repeat(40))]),
        message('m3', 2, [body('c'.repeat(40))]),
      ],
      { activeMessageKey: 'm3' },
    );
    const policy = { version: 1, maxMessages: 20, maxTotalLength: 90 };
    const result = buildContext(input({ snapshot, policy }), testDependencies());
    if (!result.ok) throw new Error('beklenmeyen hata');

    expect(result.value.messages.map((m) => m.messageKey)).toEqual(['m2', 'm3']);
    expect(result.value.omissions).toContainEqual({ messageKey: 'm1', reason: 'size-limit' });
  });

  it('mesaj sayısı sınırında en yakın geçmişi alır', () => {
    const messages = Array.from({ length: 5 }, (_, i) => message(`m${i}`, i, [body(`Mesaj ${i}`)]));
    const policy = { version: 1, maxMessages: 2, maxTotalLength: 60_000 };
    const result = buildContext(input({ snapshot: thread(messages), policy }), testDependencies());
    if (!result.ok) throw new Error('beklenmeyen hata');

    expect(result.value.messages.map((m) => m.messageKey)).toEqual(['m3', 'm4']);
    expect(result.value.omissions.filter((o) => o.reason === 'message-limit')).toHaveLength(3);
  });

  it('aktif mesaj tek başına sığmıyorsa sessizce kırpmaz', () => {
    const snapshot = thread([message('m1', 0, [body('x'.repeat(100))])]);
    const policy = { version: 1, maxMessages: 20, maxTotalLength: 50 };
    const result = buildContext(input({ snapshot, policy }), testDependencies());

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'CONTEXT_TOO_LARGE', field: 'context' }),
    });
  });

  it('kullanıcının açıkça seçtiği bağlam sınırı aşıyorsa daraltmaz, hata döner', () => {
    const snapshot = thread([
      message('m1', 0, [body('a'.repeat(40))]),
      message('m2', 1, [body('b'.repeat(40))]),
    ]);
    const policy = { version: 1, maxMessages: 20, maxTotalLength: 60 };
    const result = buildContext(
      input({ snapshot, policy, selection: { mode: 'manual', messageKeys: ['m1', 'm2'] } }),
      testDependencies(),
    );

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'CONTEXT_TOO_LARGE' }),
    });
  });

  it('elle çıkarılan mesajı gerekçesiyle kaydeder', () => {
    const result = buildContext(
      input({ selection: { mode: 'manual', messageKeys: ['m2', 'm3'] } }),
      testDependencies(),
    );
    if (!result.ok) throw new Error('beklenmeyen hata');

    expect(result.value.messages.map((m) => m.messageKey)).toEqual(['m2', 'm3']);
    expect(result.value.omissions).toContainEqual({ messageKey: 'm1', reason: 'user-excluded' });
    // m1 bağlamda olmadığı için m2'deki m1 alıntısı artık tekrar sayılmaz.
    expect(result.value.messages[0]?.text).toContain('Perşembe 14:00');
  });

  it('aynı girdiden kimlik ve zaman hariç aynı içeriği üretir', () => {
    const first = buildContext(input(), { clock: { now: () => 't1' }, ids: sequentialIds('a') });
    const second = buildContext(input(), { clock: { now: () => 't2' }, ids: sequentialIds('b') });
    if (!first.ok || !second.ok) throw new Error('beklenmeyen hata');

    const { contextId: _a, createdAt: _b, ...firstContent } = first.value;
    const { contextId: _c, createdAt: _d, ...secondContent } = second.value;
    expect(firstContent).toEqual(secondContent);
    expect(first.value.contextId).not.toBe(second.value.contextId);
  });

  it('üretilen bağlam değişmezdir ve kaynak snapshot ile bağ taşımaz', () => {
    const snapshot = meetingThread();
    const result = buildContext(input({ snapshot }), testDependencies());
    if (!result.ok) throw new Error('beklenmeyen hata');

    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.messages[0])).toBe(true);
    expect(result.value.coverage).not.toBe(snapshot.coverage);
  });

  it('satır sonlarını ve son boşlukları normalize eder, sayılara dokunmaz', () => {
    const snapshot = thread([
      message('m1', 0, [body('Tutar: 1.250,00 TL   \r\n\r\n\r\nTarih: 12.10.2026\t')]),
    ]);
    const result = buildContext(input({ snapshot }), testDependencies());
    if (!result.ok) throw new Error('beklenmeyen hata');

    expect(result.value.messages[0]?.text).toBe('Tutar: 1.250,00 TL\n\nTarih: 12.10.2026');
  });
});
