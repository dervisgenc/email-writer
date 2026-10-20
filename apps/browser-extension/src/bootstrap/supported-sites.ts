/**
 * Desteklenen Outlook Web adresleri. Gerçek test hesaplarının yönlendiği
 * adreslerle doğrulanır (bkz. docs/outlook-web-dogrulama.md). Geliştirme ve
 * test derlemesinde yerel sayfa adresleri `wxt.config.ts` içinde eklenir;
 * normal paketin manifestinde bulunmaz.
 */
export const OUTLOOK_WEB_MATCHES = [
  'https://outlook.live.com/*',
  'https://outlook.office.com/*',
  'https://outlook.office365.com/*',
  'https://outlook.cloud.microsoft/*',
] as const;

export const DEVELOPMENT_MATCHES = ['http://localhost/*', 'http://127.0.0.1/*'] as const;

/** Karşılama sihirbazının "Outlook'u aç" bağlantıları: iş/okul hesabı ve kişisel hesap. */
export const OUTLOOK_WEB_START = {
  work: 'https://outlook.office.com/mail/',
  personal: 'https://outlook.live.com/mail/',
} as const;
