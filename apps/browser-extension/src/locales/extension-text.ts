import type { HostOperatingSystem, Theme } from '@email-writer/contracts';
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
    /** Yardımcı uygulama bağlı değilken gösterilir ve karşılama sihirbazına götürür. */
    readonly setupNeeded: string;
    readonly finishSetup: string;
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
  readonly welcome: WelcomeText;
}

/** Karşılama sihirbazı: yardımcı uygulamayı kurma, yöntem seçme ve deneme. */
export interface WelcomeText {
  readonly title: string;
  readonly subtitle: string;
  readonly stepsLabel: string;
  readonly steps: readonly [string, string, string, string];
  readonly back: string;
  readonly next: string;
  readonly intro: {
    readonly title: string;
    readonly lead: string;
    readonly reasons: readonly string[];
    readonly source: string;
    readonly doesTitle: string;
    readonly does: readonly string[];
    readonly doesNotTitle: string;
    readonly doesNot: readonly string[];
  };
  readonly install: {
    readonly title: string;
    readonly lead: string;
    readonly system: string;
    readonly command: string;
    /** Terminali veya PowerShell'i açıp komutu çalıştırmayı anlatan tek cümle. */
    readonly terminal: Readonly<Record<HostOperatingSystem, string>>;
    readonly waiting: string;
    readonly connected: (version: string) => string;
    readonly whatTitle: string;
    readonly what: readonly string[];
  };
  readonly tryIt: {
    readonly title: string;
    readonly lead: string;
    readonly sampleLabel: string;
    /** Düzelt denemesi için uydurma, yazım hatalı kısa bir e-posta. */
    readonly sample: string;
    readonly run: string;
    readonly running: string;
    readonly success: string;
    readonly resultLabel: string;
    readonly openOutlook: string;
    readonly personalOutlook: string;
    readonly openSettings: string;
  };
}
