import type { ApplyTarget } from './actions';
import type { AppError } from './errors';
import type {
  ComposerRef,
  ComposerSnapshot,
  DraftSelection,
  MailScope,
  ReceivedMessageSelection,
  ThreadRef,
  ThreadSnapshot,
} from './mail';
import type { AbortSignalLike, Result } from './result';

export type PageSupport = 'waiting' | 'ready' | 'unsupported';

/** Sayfanın genel durumu. Mesaj gövdesi taşımaz. */
export interface PageState {
  readonly support: PageSupport;
  readonly scope: MailScope | null;
  readonly activeThread: ThreadRef | null;
  readonly composers: readonly ComposerRef[];
}

export type MailEvent =
  | { readonly type: 'page-state-changed'; readonly state: PageState }
  | { readonly type: 'account-changed' }
  | {
      readonly type: 'active-thread-changed';
      readonly previous: ThreadRef | null;
      readonly current: ThreadRef | null;
    }
  | { readonly type: 'thread-content-changed'; readonly threadRef: ThreadRef }
  | { readonly type: 'composer-added'; readonly ref: ComposerRef }
  | { readonly type: 'composer-removed'; readonly ref: ComposerRef }
  | {
      /**
       * Aynı editörün ait olduğu konuşma sonradan anlaşıldı (ör. Outlook yanıtı
       * konuşmaya geç bağladı). Editör, sürümü ve kayıtları aynı kalır; yalnızca
       * kimlik kaydı yenilenir.
       */
      readonly type: 'composer-rebound';
      readonly previous: ComposerRef;
      readonly ref: ComposerRef;
    }
  | {
      readonly type: 'composer-changed';
      readonly ref: ComposerRef;
      readonly revision: number;
    };

export interface ApplyRequest {
  /** Aynı kimlikle ikinci kez yazma yapılmaz. */
  readonly applyOperationId: string;
  readonly target: ApplyTarget;
  readonly text: string;
  /**
   * Biçimli içerik (liste, tablo, grafik). Yalnızca taslağın tamamına veya boş
   * taslağa yazarken verilir; `text` aynı içeriğin düz metin karşılığıdır.
   * `visibleText`, yazmadan sonra editörde okunması beklenen metindir.
   */
  readonly rich?: { readonly html: string; readonly visibleText: string };
}

export type ApplyOutcome =
  | {
      readonly status: 'applied';
      readonly composerRevision: number;
      /** Değişen bölüm kesin sınırlanamadıysa `null`; geri alma sunulmaz. */
      readonly undoId: string | null;
    }
  | { readonly status: 'rejected'; readonly error: AppError }
  | { readonly status: 'uncertain'; readonly error: AppError };

export type UndoOutcome =
  | { readonly status: 'undone'; readonly composerRevision: number }
  | { readonly status: 'rejected'; readonly error: AppError }
  | { readonly status: 'uncertain'; readonly error: AppError };

/**
 * Her e-posta ortamının (Outlook Web, Gmail Web, Outlook masaüstü) uyguladığı
 * ortak bağlantı arayüzü. Uygulama bağlantıya seçici göndermez; anlamlı
 * işlemler ister. Okuma ve yazma işlemleri asenkrondur çünkü bazı ortamlar
 * (ör. Office.js) yalnızca asenkron erişim sunar.
 */
export interface MailConnector {
  readonly providerId: string;

  /** Destek durumu, etkin konuşma ve görünen taslak referansları. */
  getPageState(): PageState;

  /** Yalnızca istenen konuşmanın erişilebilir içeriğini okur. */
  readThread(ref: ThreadRef, signal: AbortSignalLike): Promise<Result<ThreadSnapshot, AppError>>;

  readComposer(ref: ComposerRef): Promise<Result<ComposerSnapshot, AppError>>;

  /**
   * Uygulamalar canlı seçimi ilk `await`ten önce, eşzamanlı olarak okumalıdır;
   * aksi halde odak panele geçtiğinde seçim kaybolabilir.
   */
  captureDraftSelection(ref: ComposerRef): Promise<Result<DraftSelection | null, AppError>>;

  readSelectedMessageText(ref: ThreadRef): Promise<Result<ReceivedMessageSelection | null, AppError>>;

  /** Abonelikten çıkma fonksiyonu döndürür. */
  subscribe(listener: (event: MailEvent) => void): () => void;

  /** Hedefi DOM'a yazmadan hemen önce tekrar doğrular ve yalnızca bir kez yazar. */
  applyText(request: ApplyRequest): Promise<ApplyOutcome>;

  /** Yalnızca koşulları hâlâ geçerli olan son eklenti değişikliğini geri alır. */
  undoChange(undoId: string): Promise<UndoOutcome>;

  /** Gözlemcileri, seçim ve geri alma kayıtlarını, DOM bağlantılarını temizler. */
  dispose(): void;
}
