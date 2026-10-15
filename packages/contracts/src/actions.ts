import { z } from 'zod';

import type { ContextSnapshot } from './context';
import type { LanguageCode } from './languages';
import type { ComposerRef } from './mail';

export const OPERATIONS = ['revise', 'translate', 'reply', 'compose'] as const;
export type Operation = (typeof OPERATIONS)[number];

/**
 * Kaynağı kullanıcının talimatı olan işlemler: konuşmaya yanıt (`reply`) ve
 * bağlamsız yeni e-posta metni (`compose`). Diğerleri mevcut metni işler.
 */
export function isInstructionOperation(operation: Operation): operation is 'reply' | 'compose' {
  return operation === 'reply' || operation === 'compose';
}

export const TONES = ['neutral', 'formal', 'friendly'] as const;
export type Tone = (typeof TONES)[number];

export type SourceOrigin = 'panel' | 'draft' | 'draft-selection' | 'received-message';

/**
 * Sonucun taslağa nereye yazılacağı. Seçim değiştirme, `selectionId` olmadan
 * temsil edilemez.
 */
export type ApplyTarget =
  | {
      readonly mode: 'replace-selection';
      readonly composerRef: ComposerRef;
      readonly expectedRevision: number;
      readonly selectionId: string;
    }
  | {
      readonly mode: 'replace-body' | 'insert-empty';
      readonly composerRef: ComposerRef;
      readonly expectedRevision: number;
    };

export type ApplyMode = ApplyTarget['mode'];

/**
 * Doğrulanmış ve değişmez işlem kaydı. Ekrandaki Vue nesnesinin referansı
 * değil, bağımsız bir veri kopyasıdır. Bu aşamada prompt üretilmez.
 */
export interface PreparedAction {
  readonly requestId: string;
  readonly sessionId: string;
  readonly formRevision: number;
  readonly operation: Operation;
  readonly source: {
    readonly origin: SourceOrigin;
    readonly text: string;
  };
  /** Yanıt hazırlamada kullanıcının isteği; e-posta içeriğiyle birleştirilmez. */
  readonly instruction: string;
  readonly targetLanguage: LanguageCode | null;
  readonly tone: Tone;
  readonly context: ContextSnapshot | null;
  /** Hazırlık anındaki hedefin değişmez kopyası. Güncel hedefin sahibi oturumdur. */
  readonly target: ApplyTarget | null;
  readonly createdAt: string;
}

/** Önizlemeye kabul edilmeden önce doğrulanan sonuç kaydı. */
export const previewCandidateSchema = z
  .object({
    requestId: z.string().min(1).max(128),
    sessionId: z.string().min(1).max(128),
    formRevision: z.number().int().nonnegative(),
    text: z.string(),
    /** Geliştirme kaynağından gelen örnek sonuç işareti. */
    sample: z.boolean(),
  })
  .strict();

export type PreviewCandidate = z.infer<typeof previewCandidateSchema>;
