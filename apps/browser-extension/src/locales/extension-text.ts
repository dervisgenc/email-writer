import type { Theme, UiLanguage } from '@email-writer/contracts';
import type { UiText } from '@email-writer/ui';

export type PopupStatusKey =
  'ready' | 'waiting' | 'unsupported' | 'disabled' | 'not-mail-site' | 'unreachable' | 'checking';

/** Eklentinin bütün kullanıcı metinleri: panel, araç çubuğu penceresi ve ayarlar. */
export interface ExtensionText {
  readonly ui: UiText;
  readonly popup: {
    readonly title: string;
    readonly statuses: Readonly<Record<PopupStatusKey, string>>;
    readonly openPanel: string;
    readonly openSettings: string;
    readonly siteAccessMissing: string;
    readonly developmentBuild: string;
  };
  readonly options: {
    readonly title: string;
    readonly uiLanguage: string;
    readonly uiLanguages: Readonly<Record<UiLanguage, string>>;
    readonly targetLanguage: string;
    readonly tone: string;
    readonly theme: string;
    readonly themes: Readonly<Record<Theme, string>>;
    readonly siteEnabled: string;
    readonly save: string;
    readonly saved: string;
    readonly saving: string;
    readonly storageNote: string;
    readonly defaultsNote: string;
  };
}
