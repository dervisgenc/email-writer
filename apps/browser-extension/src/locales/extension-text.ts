import type { Theme } from '@email-writer/contracts';
import type { UiText } from '@email-writer/ui';

export type PopupStatusKey =
  'ready' | 'waiting' | 'unsupported' | 'disabled' | 'not-mail-site' | 'unreachable' | 'checking';

/** Eklentinin bütün kullanıcı metinleri: panel, araç çubuğu penceresi ve ayarlar. */
export interface ExtensionText {
  /** Tarayıcının eklenti listesinde ve mağazada görünen açıklama (en fazla 132 karakter). */
  readonly description: string;
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
    readonly subtitle: string;
    readonly preferencesTitle: string;
    readonly preferencesDescription: string;
    readonly uiLanguage: string;
    /** "Otomatik" seçeneği; diller kendi adlarıyla (`UI_LANGUAGE_NAMES`) gösterilir. */
    readonly uiLanguageAuto: string;
    readonly targetLanguage: string;
    readonly targetLanguageHint: string;
    readonly favoriteLanguages: string;
    readonly favoriteLanguagesHint: string;
    readonly addLanguage: string;
    readonly removeLanguage: (language: string) => string;
    readonly favoritesFull: string;
    readonly languagesTitle: string;
    readonly languagesDescription: string;
    readonly instructionsTitle: string;
    readonly instructionsDescription: string;
    readonly instructionsLabel: string;
    readonly instructionsPlaceholder: string;
    readonly instructionsExamplesLabel: string;
    readonly instructionsExamples: readonly string[];
    readonly instructionsCount: (count: number, limit: number) => string;
    readonly tone: string;
    readonly theme: string;
    readonly themes: Readonly<Record<Theme, string>>;
    readonly themeOptions: Readonly<Record<Theme, string>>;
    readonly themeHint: string;
    readonly siteEnabled: string;
    readonly siteEnabledHint: string;
    readonly unsaved: string;
    readonly save: string;
    readonly saved: string;
    readonly saving: string;
    readonly defaultsNote: string;
    readonly privacyTitle: string;
    readonly privacyDescription: string;
    readonly privacyPoints: readonly string[];
  };
}
