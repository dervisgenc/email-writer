import type { ContextCoverage, ThreadRef } from './mail';

/**
 * Bu belgedeki "context", kullanıcının işlemde kullanmayı seçtiği mesajların
 * düzenli veri paketidir. Prompt, özet veya AI çıktısı değildir.
 */

export interface ContextMessage {
  readonly messageKey: string;
  readonly senderLabel: string | null;
  readonly sentAt: string | null;
  readonly sentAtText: string | null;
  /** Mesajın okunduğu konuşmanın konusu. */
  readonly subject: string | null;
  /**
   * `current`: açık konuşmadan veya aynı konulu bir konuşmadan (varsayılan
   * olarak bağlamdadır). `other`: kullanıcının başka bir konuşmadan eklediği.
   */
  readonly conversation: 'current' | 'other';
  /** Metin, kullanıcının bağlam denetleyicisinde yaptığı düzenlemedir. */
  readonly edited: boolean;
  readonly text: string;
}

export type OmissionReason =
  'user-excluded' | 'signature' | 'duplicate-quote' | 'duplicate-message' | 'message-limit' | 'size-limit';

export interface ContextOmission {
  readonly messageKey: string;
  readonly blockIndex?: number;
  readonly reason: OmissionReason;
}

export type ContextOrdering = 'sent-at' | 'display-order';

export interface ContextSnapshot {
  readonly contextId: string;
  readonly threadRef: ThreadRef;
  readonly threadRevision: number;
  /** Yanıt verilecek mesaj bağlamda varsa kimliği; yoksa `null`. */
  readonly activeMessageKey: string | null;
  readonly ordering: ContextOrdering;
  readonly messages: readonly ContextMessage[];
  readonly coverage: ContextCoverage;
  readonly omissions: readonly ContextOmission[];
  readonly policyVersion: number;
  readonly createdAt: string;
}

/**
 * Kullanıcının bağlam denetleyicisindeki seçimi, varsayılan kurala göre
 * istisnalar olarak tutulur. Varsayılan: açık konuşmadaki ve aynı konulu
 * mesajlar bağlamdadır, başka konuşmalardan okunan mesajlar değildir. Böylece
 * sonradan okunan ilgili mesajlar da kendiliğinden bağlama girer.
 */
export interface ContextSelection {
  /** Varsayılan olarak bağlamda olmayıp kullanıcının eklediği mesajlar. */
  readonly included: readonly string[];
  /** Kullanıcının bağlamdan çıkardığı mesajlar. */
  readonly excluded: readonly string[];
}

export const DEFAULT_CONTEXT_SELECTION: ContextSelection = Object.freeze({ included: [], excluded: [] });

/** Kullanıcının bağlam denetleyicisinde düzenlediği mesaj metni; orijinal mesaj değişmez. */
export interface ContextEdit {
  readonly messageKey: string;
  readonly text: string;
}

/** Otomatik çıkarılan bir imza veya alıntı bloğunu geri dahil etmek için. */
export interface BlockRef {
  readonly messageKey: string;
  readonly blockIndex: number;
}

/**
 * Bağlamın kapsamını açıklayan bilgilendirme kayıtları. Bunlar hata değildir;
 * işlemi engelleyen durumlar `AppError` ile ayrıca ifade edilir.
 */
export type ContextNotice =
  | { readonly kind: 'message-count'; readonly count: number }
  | { readonly kind: 'collapsed-unread'; readonly count: number }
  | { readonly kind: 'collapsed-unknown' }
  | { readonly kind: 'coverage-unverified' }
  | { readonly kind: 'virtualized-content' }
  | { readonly kind: 'read-limit' }
  | { readonly kind: 'user-excluded'; readonly count: number }
  | { readonly kind: 'other-conversations'; readonly count: number }
  | { readonly kind: 'user-edited'; readonly count: number }
  | { readonly kind: 'message-limited'; readonly count: number }
  | { readonly kind: 'size-limited'; readonly count: number }
  | { readonly kind: 'signature-removed'; readonly count: number }
  | { readonly kind: 'duplicate-quote-removed'; readonly count: number }
  | { readonly kind: 'display-order-used' };
