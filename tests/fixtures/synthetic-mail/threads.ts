/**
 * Synthetic conversations without personal data. All names, addresses and
 * contents are made up; none were taken from a real mailbox.
 */
import type {
  ContextCoverage,
  MailScope,
  MessageSnapshot,
  TextBlock,
  ThreadRef,
  ThreadSnapshot,
} from '@writehand/contracts';

export const scopeA: MailScope = {
  providerId: 'outlook-web',
  accountScopeId: 'acct-a',
  documentInstanceId: 'doc-1',
};

export const scopeB: MailScope = { ...scopeA, accountScopeId: 'acct-b' };

export const threadA: ThreadRef = { scope: scopeA, threadKey: 'thread-a' };
export const threadB: ThreadRef = { scope: scopeA, threadKey: 'thread-b' };

export function body(text: string): TextBlock {
  return { kind: 'body', text, certainty: 'certain' };
}

export function quote(text: string, certainty: TextBlock['certainty'] = 'certain'): TextBlock {
  return { kind: 'quote', text, certainty };
}

export function signature(text: string, certainty: TextBlock['certainty'] = 'certain'): TextBlock {
  return { kind: 'signature', text, certainty };
}

export function message(
  messageKey: string,
  displayOrder: number,
  blocks: TextBlock[],
  overrides: Partial<MessageSnapshot> = {},
): MessageSnapshot {
  return {
    messageKey,
    senderLabel: `Gönderen ${messageKey}`,
    sentAt: null,
    sentAtText: null,
    displayOrder,
    blocks,
    ...overrides,
  };
}

const defaultCoverage: ContextCoverage = {
  source: 'visible-dom',
  status: 'partial',
  readableMessageCount: 0,
  knownUnreadableMessageCount: 0,
  reasons: ['unverified-history'],
};

export function thread(messages: MessageSnapshot[], overrides: Partial<ThreadSnapshot> = {}): ThreadSnapshot {
  return {
    ref: threadA,
    revision: 1,
    capturedAt: '2026-10-13T09:00:00.000Z',
    subject: 'Proje toplantısı',
    activeMessageKey: messages[messages.length - 1]?.messageKey ?? null,
    messages,
    coverage: { ...defaultCoverage, readableMessageCount: messages.length },
    ...overrides,
  };
}

/** A three-message conversation in mixed Turkish and English, with quotes and signatures. */
export function meetingThread(): ThreadSnapshot {
  const first = message(
    'm1',
    0,
    [
      body('Merhaba Ayşe,\n\nPerşembe 14:00 toplantısını teyit edebilir misin?'),
      signature('Saygılarımla,\nMehmet Demir'),
    ],
    { sentAt: '2026-10-10T08:00:00.000Z' },
  );

  const second = message(
    'm2',
    1,
    [
      body('Hi Mehmet,\n\nThursday works for me. Can we also review the 1.250,00 TL invoice?'),
      signature('Best,\nAyşe'),
      quote(
        'From: Mehmet Demir <mehmet@example.test>\nSent: Friday, October 10, 2026 11:00 AM\nTo: Ayşe Kaya\nSubject: Proje toplantısı\n\nMerhaba Ayşe,\n\nPerşembe 14:00 toplantısını teyit edebilir misin?\n\nSaygılarımla,\nMehmet Demir',
      ),
    ],
    { sentAt: '2026-10-11T09:30:00.000Z' },
  );

  const third = message(
    'm3',
    2,
    [
      body('Tamam, faturayı da gündeme ekledim. 😊'),
      quote(
        'Kimden: Ayşe Kaya <ayse@example.test>\nGönderildi: 11 Ekim 2026 Cumartesi 12:30\nKime: Mehmet Demir\nKonu: RE: Proje toplantısı\n\nHi Mehmet,\n\nThursday works for me. Can we also review the 1.250,00 TL invoice?\n\nBest,\nAyşe\n\nFrom: Mehmet Demir <mehmet@example.test>\nSent: Friday, October 10, 2026 11:00 AM\nTo: Ayşe Kaya\nSubject: Proje toplantısı\n\nMerhaba Ayşe,\n\nPerşembe 14:00 toplantısını teyit edebilir misin?\n\nSaygılarımla,\nMehmet Demir',
      ),
    ],
    { sentAt: '2026-10-12T07:15:00.000Z' },
  );

  return thread([first, second, third]);
}
