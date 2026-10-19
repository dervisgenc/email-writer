import type { HostInfo } from '@email-writer/contracts';

/** Eklentinin bu bilgisayardaki yardımcı uygulama hakkında bildikleri. */
export type HelperView =
  | { readonly kind: 'checking' }
  /** Tarayıcı, eklentinin bilgisayardaki programlarla konuşmasına henüz izin vermedi. */
  | { readonly kind: 'permission' }
  | { readonly kind: 'missing' }
  /** Bu eklentinin desteklediğinden eski; sürümünü bildiremeyecek kadar eskiyse `version` null. */
  | { readonly kind: 'outdated'; readonly version: string | null }
  | { readonly kind: 'connected'; readonly info: HostInfo };

/** Yardımcı uygulama kartının ve sihirbazdaki kurulum adımının ortak metinleri. */
export interface HelperText {
  readonly title: string;
  readonly description: string;
  /** Kartın başındaki kısa durum. */
  readonly states: Readonly<Record<HelperView['kind'], string>>;
  readonly permissionBody: string;
  readonly grant: string;
  readonly missingBody: string;
  readonly outdatedBody: string;
  readonly version: (version: string, system: string) => string;
  readonly browsers: (names: string) => string;
  readonly development: string;
  readonly checkUpdates: string;
  readonly checkUpdatesHint: string;
  readonly updateAvailable: (version: string) => string;
  readonly upToDate: string;
  readonly update: string;
  readonly updating: string;
  readonly updated: (version: string) => string;
  readonly openWizard: string;
  readonly uninstallTitle: string;
  /** Kaldırma komutunun açıklaması; `flag` hesap bilgilerini de silen seçenektir. */
  readonly uninstallBody: (flag: string) => string;
  readonly copy: string;
  readonly copied: string;
}
