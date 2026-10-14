import type {
  AppError,
  ApplyTarget,
  BlockRef,
  ComposerRef,
  ContextSelection,
  ContextSnapshot,
  LanguageCode,
  Operation,
  PreparedAction,
  ThreadRef,
  ThreadSnapshot,
  Tone,
} from '@email-writer/contracts';

/**
 * Panel oturumunun tek durum modeli. Birbiriyle çelişebilecek ayrı
 * `isLoading`/`hasResult` değişkenleri yerine tek bir aşama tutulur. Panelin
 * açık/kapalı olması bu modelin parçası değildir.
 */
export type SessionPhase =
  | { readonly status: 'idle' }
  | {
      readonly status: 'reading';
      readonly operationId: string;
      readonly subject: 'thread' | 'source';
    }
  | { readonly status: 'editing' }
  | { readonly status: 'prepared'; readonly requestId: string }
  | { readonly status: 'preview' }
  | {
      readonly status: 'applying';
      readonly operationId: string;
      readonly kind: 'apply' | 'undo';
    }
  | { readonly status: 'applied' }
  | { readonly status: 'error'; readonly error: AppError };

export type SessionStatus = SessionPhase['status'];

export interface SessionForm {
  readonly operation: Operation;
  readonly sourceText: string;
  readonly instruction: string;
  /** Gizlenen tercih oturumda saklanır; düzeltmede işlem kaydına girmez. */
  readonly targetLanguage: LanguageCode;
  readonly tone: Tone;
  /** Düzeltme ve çeviride konuşmanın bağlama dahil edilmesi. */
  readonly useConversation: boolean;
  readonly contextSelection: ContextSelection;
  readonly includedBlocks: readonly BlockRef[];
  /** Aktif mesaj tanınamadığında kullanıcının seçtiği yanıt verilecek mesaj. */
  readonly replyTargetKey: string | null;
}

/**
 * Kaynak metnin e-posta sayfasında nereden alındığı. Panelde yapılan
 * düzenleme bu kaydı değiştirmez: işlenecek yeni metin ile Outlook'ta
 * değiştirilecek eski bölüm ayrı kayıtlardır.
 */
export type SourceBinding =
  | { readonly kind: 'panel' }
  | {
      readonly kind: 'draft';
      readonly composerRef: ComposerRef;
      readonly composerRevision: number;
      readonly loadedText: string;
      readonly canReplaceBody: boolean;
      readonly canInsertIntoEmptyBody: boolean;
    }
  | {
      readonly kind: 'draft-selection';
      readonly composerRef: ComposerRef;
      readonly composerRevision: number;
      readonly selectionId: string;
      readonly loadedText: string;
    }
  | {
      readonly kind: 'received-message';
      readonly threadRef: ThreadRef;
      readonly messageKey: string;
      readonly loadedText: string;
    };

/** Kaynak veya hedefin neden artık geçerli olmadığı. */
export type StaleReason =
  'composer-changed' | 'composer-removed' | 'selection-invalid' | 'thread-changed' | 'account-changed';

export interface SessionPreview {
  readonly requestId: string;
  /** Önizlemenin ait olduğu işlem kaydının form sürümü. */
  readonly formRevision: number;
  /** Uygulanacak metnin tek kaynağı; kullanıcının son düzenlemesidir. */
  readonly text: string;
  readonly previewRevision: number;
  readonly sample: boolean;
}

export interface AppliedChange {
  readonly applyOperationId: string;
  readonly requestId: string;
  readonly previewRevision: number;
  readonly outcome: 'applied' | 'uncertain';
  readonly composerRef: ComposerRef;
  readonly undoId: string | null;
  readonly composerRevisionAfter: number | null;
}

export interface SessionState {
  readonly sessionId: string;
  readonly phase: SessionPhase;
  readonly formRevision: number;
  readonly form: SessionForm;
  /** Oturumun bağlı olduğu konuşma; başka konuşmanın içeriği karıştırılmaz. */
  readonly thread: ThreadRef | null;
  readonly threadSnapshot: ThreadSnapshot | null;
  readonly context: ContextSnapshot | null;
  readonly contextError: AppError | null;
  /** Konuşmaya yeni içerik geldi; yeniden okunmadan bu bağlamla işlem hazırlanmaz. */
  readonly contextStale: boolean;
  readonly binding: SourceBinding;
  /** Kullanıcının açıkça seçtiği hedef; yoksa hedef kaynak kaydından türetilir. */
  readonly explicitTarget: ApplyTarget | null;
  /** Hedef editörün bilinen son sürümü. */
  readonly targetComposerRevision: number | null;
  readonly action: PreparedAction | null;
  readonly preview: SessionPreview | null;
  readonly lastChange: AppliedChange | null;
  readonly staleReason: StaleReason | null;
  readonly fieldErrors: readonly AppError[];
}

export interface CreateSessionOptions {
  readonly sessionId: string;
  readonly thread: ThreadRef | null;
  readonly operation?: Operation;
  readonly defaults: { readonly targetLanguage: LanguageCode; readonly tone: Tone };
  readonly staleReason?: StaleReason | null;
}

export function createSession(options: CreateSessionOptions): SessionState {
  return {
    sessionId: options.sessionId,
    phase: { status: 'idle' },
    formRevision: 0,
    form: {
      operation: options.operation ?? 'revise',
      sourceText: '',
      instruction: '',
      targetLanguage: options.defaults.targetLanguage,
      tone: options.defaults.tone,
      useConversation: false,
      contextSelection: { mode: 'automatic' },
      includedBlocks: [],
      replyTargetKey: null,
    },
    thread: options.thread,
    threadSnapshot: null,
    context: null,
    contextError: null,
    contextStale: false,
    binding: { kind: 'panel' },
    explicitTarget: null,
    targetComposerRevision: null,
    action: null,
    preview: null,
    lastChange: null,
    staleReason: options.staleReason ?? null,
    fieldErrors: [],
  };
}

export function isPreviewCurrent(state: SessionState): boolean {
  return state.preview !== null && state.preview.formRevision === state.formRevision;
}

export function isSessionBusy(state: SessionState): boolean {
  const { status } = state.phase;
  return status === 'reading' || status === 'applying' || status === 'prepared';
}

/** Süren bir işlem bittiğinde veya iptal edildiğinde oturumun döneceği aşama. */
export function restingPhase(state: SessionState): SessionPhase {
  const { preview, lastChange } = state;
  if (preview !== null && isPreviewCurrent(state)) {
    const isApplied =
      lastChange?.outcome === 'applied' &&
      lastChange.requestId === preview.requestId &&
      lastChange.previewRevision === preview.previewRevision;
    return isApplied ? { status: 'applied' } : { status: 'preview' };
  }
  const hasInput =
    state.threadSnapshot !== null ||
    state.binding.kind !== 'panel' ||
    state.form.sourceText !== '' ||
    state.form.instruction !== '';
  return hasInput ? { status: 'editing' } : { status: 'idle' };
}
