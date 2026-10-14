/**
 * E-posta bağlantılarının ortak biçime çevirdiği veri. Buradaki kimlikler
 * yetkilendirme token'ı değildir; yanlış hedefin kullanılmasını engelleyen
 * yerel ilişkilerdir. DOM referansları bağlantı modülünün içinde kalır.
 */

export interface MailScope {
  readonly providerId: string;
  /** Açık posta hesabını ayıran yerel, opak kimlik. E-posta adresi değildir. */
  readonly accountScopeId: string;
  /** Sayfa yeniden yüklendiğinde değişir; sekmeler aynı değeri paylaşmaz. */
  readonly documentInstanceId: string;
}

export interface ThreadRef {
  readonly scope: MailScope;
  readonly threadKey: string;
}

export interface ComposerRef {
  readonly scope: MailScope;
  /** Editör silinip yeniden oluşturulursa yeni kimlik alır. */
  readonly composerKey: string;
  readonly threadKey: string | null;
}

export type TextBlockKind = 'body' | 'quote' | 'signature' | 'unknown';

export interface TextBlock {
  readonly kind: TextBlockKind;
  readonly text: string;
  readonly certainty: 'certain' | 'uncertain';
}

export type CoverageReason =
  'collapsed-messages' | 'virtualized-content' | 'read-limit' | 'unverified-history';

export interface MessageSnapshot {
  readonly messageKey: string;
  readonly senderLabel: string | null;
  /** Yalnızca güvenilir biçimde okunabildiyse ISO tarih; aksi halde `null`. */
  readonly sentAt: string | null;
  /** Ekranda görünen tarih yazısı. Ayrıştırılmaz, sıralamada kullanılmaz. */
  readonly sentAtText: string | null;
  readonly displayOrder: number;
  readonly blocks: readonly TextBlock[];
}

/**
 * DOM'dan okumak bütün posta geçmişine erişildiğini kanıtlamaz; bu yüzden
 * `complete` diye bir kapsam değeri bilinçli olarak yoktur.
 */
export interface ContextCoverage {
  readonly source: 'visible-dom';
  readonly status: 'partial' | 'unknown';
  readonly readableMessageCount: number;
  readonly knownUnreadableMessageCount: number | null;
  readonly reasons: readonly CoverageReason[];
}

export interface ThreadSnapshot {
  readonly ref: ThreadRef;
  readonly revision: number;
  readonly capturedAt: string;
  readonly subject: string | null;
  readonly activeMessageKey: string | null;
  readonly messages: readonly MessageSnapshot[];
  readonly coverage: ContextCoverage;
}

export interface ComposerSnapshot {
  readonly ref: ComposerRef;
  readonly revision: number;
  readonly capturedAt: string;
  /** Kullanıcının yazdığı ve güvenle düzenlenebilen bölge. */
  readonly editableText: string;
  readonly canReplaceBody: boolean;
  readonly canReplaceSelection: boolean;
  readonly canInsertIntoEmptyBody: boolean;
  readonly containsRichContent: boolean;
}

/** Aralıklar, `editableText` üzerinde UTF-16 indisleridir. */
export interface DraftSelection {
  readonly selectionId: string;
  readonly composerRef: ComposerRef;
  readonly composerRevision: number;
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** Salt okunur gelen mesajdan yapılan seçim; yazma hakkı oluşturmaz. */
export interface ReceivedMessageSelection {
  readonly threadRef: ThreadRef;
  readonly messageKey: string;
  readonly text: string;
}

export function isSameScope(a: MailScope, b: MailScope): boolean {
  return (
    a.providerId === b.providerId &&
    a.accountScopeId === b.accountScopeId &&
    a.documentInstanceId === b.documentInstanceId
  );
}

export function isSameThread(a: ThreadRef, b: ThreadRef): boolean {
  return a.threadKey === b.threadKey && isSameScope(a.scope, b.scope);
}

export function isSameComposer(a: ComposerRef, b: ComposerRef): boolean {
  return a.composerKey === b.composerKey && isSameScope(a.scope, b.scope);
}
