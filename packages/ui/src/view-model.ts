import type {
  ApplyMode,
  ContextNotice,
  ErrorCode,
  ErrorField,
  LanguageCode,
  Operation,
  SourceOrigin,
  Tone,
} from '@email-writer/contracts';

/**
 * Panelin göstermek için ihtiyaç duyduğu salt okunur görünüm verisi. Oturum
 * durumundan eklenti tarafında üretilir; bileşenler iş kuralı hesaplamaz.
 */

/** Yazma alanındaki araç çubuğundan doğrudan istenen işlem. */
export type QuickActionRequest =
  | { readonly operation: 'revise' }
  | { readonly operation: 'translate'; readonly language: LanguageCode }
  | { readonly operation: 'reply' }
  | { readonly operation: 'compose' };

export type TargetView =
  | { readonly kind: 'none' }
  | { readonly kind: 'composer'; readonly isReply: boolean }
  | { readonly kind: 'received-message' };

export type SourceReloadKind = 'draft' | 'selection' | 'received-message';

export interface SourceView {
  readonly origin: SourceOrigin;
  readonly text: string;
  readonly instruction: string;
  readonly edited: boolean;
  /** Kaynağı yeniden almak mevcut metni değiştirecekse onay istenir. */
  readonly pendingReplace: SourceReloadKind | null;
  readonly canLoadDraft: boolean;
  readonly canLoadSelection: boolean;
  readonly canLoadReceivedSelection: boolean;
  readonly isReading: boolean;
}

export interface OptionsView {
  readonly targetLanguage: LanguageCode;
  readonly tone: Tone;
  readonly showTargetLanguage: boolean;
  readonly showTone: boolean;
  readonly useConversation: boolean;
  readonly showUseConversation: boolean;
}

export interface OmittedBlockView {
  readonly blockIndex: number;
  readonly kind: 'signature' | 'quote';
  readonly text: string;
}

export interface ContextMessageView {
  readonly messageKey: string;
  readonly senderLabel: string | null;
  readonly sentAtText: string | null;
  readonly subject: string | null;
  /**
   * `current`: açık konuşmadan veya aynı konudan (varsayılan olarak bağlamda).
   * `other`: başka bir konuşmadan okunan; yalnızca kullanıcı eklerse bağlamda.
   */
  readonly group: 'current' | 'other';
  readonly preview: string;
  /** Bağlama girecek metin; kullanıcı düzenlediyse düzenlenmiş hâli. */
  readonly text: string;
  readonly included: boolean;
  readonly edited: boolean;
  /** Yanıt hazırlamada aktif mesaj bağlamdan çıkarılamaz. */
  readonly locked: boolean;
  readonly isReplyTarget: boolean;
  readonly omittedBlocks: readonly OmittedBlockView[];
}

export interface ContextView {
  readonly status: 'not-loaded' | 'reading' | 'ready' | 'stale' | 'error';
  readonly required: boolean;
  /** Aktif mesaj tanınamadı: kullanıcı yanıt verilecek mesajı seçmelidir. */
  readonly needsReplyTarget: boolean;
  readonly notices: readonly ContextNotice[];
  readonly messages: readonly ContextMessageView[];
  readonly errorCode: ErrorCode | null;
}

export interface PreviewView {
  readonly text: string;
  readonly sample: boolean;
  readonly stale: boolean;
  readonly unchanged: boolean;
}

export interface ApplyView {
  readonly mode: ApplyMode | null;
  readonly canApply: boolean;
  readonly blocker: ErrorCode | null;
  readonly canCopy: boolean;
  readonly canUndo: boolean;
  readonly isApplying: boolean;
  /** Dolu bir yanıt taslağını değiştirmek için açık onay seçeneği. */
  readonly canReplaceExistingReply: boolean;
  /** Hedefsiz bir önizlemeyi açık yanıt taslağına bağlama seçeneği. */
  readonly canUseOpenComposer: boolean;
}

export type StatusView =
  | { readonly kind: 'none' }
  | { readonly kind: 'busy'; readonly activity: 'reading' | 'preparing' | 'applying' | 'undoing' }
  | { readonly kind: 'success'; readonly message: 'applied' | 'undone' | 'copied' }
  | { readonly kind: 'error'; readonly code: ErrorCode; readonly canRetry: boolean }
  | { readonly kind: 'info'; readonly code: ErrorCode };

export interface PanelView {
  readonly operation: Operation;
  /**
   * Talimattan yazma işlemi: konuşmanın yanıtında `reply`, yeni iletide veya
   * taslak yokken `compose`. Panelin ilk sekmesi buna göre gösterilir.
   */
  readonly writeOperation: 'reply' | 'compose';
  readonly target: TargetView;
  readonly source: SourceView;
  readonly options: OptionsView;
  readonly context: ContextView;
  readonly fieldErrors: Partial<Record<ErrorField, ErrorCode>>;
  readonly prepare: {
    readonly canPrepare: boolean;
    readonly blocker: ErrorCode | null;
    readonly isPreparing: boolean;
  };
  readonly preview: PreviewView | null;
  readonly apply: ApplyView;
  readonly status: StatusView;
  readonly staleNotice: ErrorCode | null;
}
