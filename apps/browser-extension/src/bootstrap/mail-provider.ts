import type { ComposerRef, MailConnector, SelectorReport, SiteId, ThreadRef } from '@email-writer/contracts';

/** Eklentinin kendi arayüz kökleri bu öznitelikle işaretlenir ve sayfa gözleminden dışlanır. */
export const OWN_UI_ATTRIBUTE = 'data-email-writer-ui';
export const OWN_UI_SELECTOR = `[${OWN_UI_ATTRIBUTE}]`;

/**
 * Başlatma düğmesinin yanına yerleştirileceği doğrulanmış arayüz bölgesi.
 * Düğme Outlook'un DOM ağacına eklenmez; sayfa gövdesinde bu elemanın konumuna
 * göre yüzer. `element` yalnızca montaj kodunda kullanılır; `core`, işlem
 * kayıtları veya depolamaya geçirilmez.
 */
export interface LauncherAnchor {
  readonly key: string;
  readonly element: HTMLElement;
  /** Düğmenin elemana göre köşesi. */
  readonly placement: 'top-end' | 'bottom-end';
  readonly target:
    | { readonly kind: 'thread'; readonly thread: ThreadRef }
    | { readonly kind: 'composer'; readonly composer: ComposerRef };
}

/** Bir e-posta ortamının eklentiye sunduğu her şey: bağlantı ve düğme konumları. */
export interface MailPageProvider {
  readonly siteId: SiteId;
  readonly connector: MailConnector;
  locateLauncherAnchors(): readonly LauncherAnchor[];
  /** Gerçek sayfada seçici doğrulaması için içeriksiz eşleşme sayıları. */
  selectorReport(): readonly SelectorReport['entries'][number][];
}
