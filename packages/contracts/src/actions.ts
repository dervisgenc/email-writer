import { z } from 'zod';

import type { ContextSnapshot } from './context';
import type { TargetLanguage } from './languages';
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
 * Hazır bir sonucun istenen yönde değiştirilmesi (ör. tabloya çevir, kısalt).
 * Orijinal görev bağlam olarak kalır; değişiklik önceki sonuca uygulanır.
 */
export interface Refinement {
  readonly instruction: string;
  readonly previous: string;
}

export const REFINEMENTS = ['table', 'list', 'chart', 'shorter', 'formal', 'friendly'] as const;
export type RefinementKind = (typeof REFINEMENTS)[number];
export const MAX_REFINEMENT_LENGTH = 500;

/** Biçim gerektiren düzenlemeler; yalnızca taslağın tamamına yazılan sonuçlarda sunulur. */
export const RICH_REFINEMENTS: readonly RefinementKind[] = ['table', 'list', 'chart'];

/** Model için açık talimatlar; arayüz etiketleri yerelleştirilir. */
export const REFINEMENT_INSTRUCTIONS: Readonly<Record<RefinementKind, string>> = {
  table:
    'Present the key facts or figures as a Markdown table where that makes them easier to read. Keep the greeting, the surrounding sentences and the sign-off as normal text.',
  list: 'Restructure the main content into concise bullet points. Keep the greeting and the sign-off as normal lines.',
  chart:
    'Add a bar chart (a ```chart block) that visualises the numbers already in the text, where it fits best. Use only numbers that appear in the text. If there are fewer than two comparable numbers, leave the text unchanged.',
  shorter:
    'Make it noticeably shorter and more concise while keeping every important fact, request and date.',
  formal: 'Make the tone more formal and professional.',
  friendly: 'Make the tone warmer and friendlier while staying professional.',
};

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
  /** Yalnızca çeviride dolu; yanıt ve yeni ileti konuşmanın veya talimatın dilini izler. */
  readonly targetLanguage: TargetLanguage | null;
  readonly tone: Tone;
  readonly context: ContextSnapshot | null;
  /** Hazırlık anındaki hedefin değişmez kopyası. Güncel hedefin sahibi oturumdur. */
  readonly target: ApplyTarget | null;
  /** Varsa önceki sonuç bu talimatla değiştirilir. */
  readonly refinement: Refinement | null;
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
