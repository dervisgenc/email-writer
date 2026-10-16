import { z } from 'zod';

/**
 * Çeviri ve yanıt için önerilen hedef diller (BCP 47). Liste yalnızca öneridir:
 * kullanıcı katalogda olmayan bir dili adıyla da yazabilir. Dil adları
 * `Intl.DisplayNames` ile arayüz dilinde gösterilir; burada çeviri tutulmaz.
 */
export const LANGUAGE_CATALOG = [
  'en',
  'en-GB',
  'tr',
  'de',
  'fr',
  'es',
  'es-419',
  'it',
  'pt',
  'pt-BR',
  'nl',
  'pl',
  'ru',
  'uk',
  'ar',
  'fa',
  'he',
  'hi',
  'bn',
  'ur',
  'zh-Hans',
  'zh-Hant',
  'ja',
  'ko',
  'id',
  'ms',
  'th',
  'vi',
  'fil',
  'sv',
  'da',
  'nb',
  'fi',
  'is',
  'el',
  'cs',
  'sk',
  'hu',
  'ro',
  'bg',
  'hr',
  'sr',
  'sl',
  'bs',
  'mk',
  'sq',
  'et',
  'lv',
  'lt',
  'az',
  'ka',
  'kk',
  'uz',
  'hy',
  'ca',
  'eu',
  'gl',
  'ga',
  'cy',
  'sw',
  'af',
  'ta',
  'te',
  'mr',
  'gu',
  'pa',
  'ml',
  'kn',
] as const;
export type CatalogLanguage = (typeof LANGUAGE_CATALOG)[number];

/**
 * Hedef dil: katalogdaki bir kod (ör. `de`, `pt-BR`) ya da kullanıcının yazdığı
 * bir dil adı (ör. "Osmanlı Türkçesi"). Ad modele veri olarak gider; satır sonu
 * ve işaretleme karakterleri kabul edilmez.
 */
export type TargetLanguage = string;

export const MAX_LANGUAGE_NAME_LENGTH = 60;
const LANGUAGE_NAME_PATTERN = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} ()'’.,/-]*$/u;

export const targetLanguageSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_LANGUAGE_NAME_LENGTH)
  .regex(LANGUAGE_NAME_PATTERN);

export function isCatalogLanguage(value: string): value is CatalogLanguage {
  return (LANGUAGE_CATALOG as readonly string[]).includes(value);
}

/**
 * Kullanıcının girdiğini hedef dile çevirir: katalog kodları büyük/küçük harf
 * fark etmeden eşlenir (`PT-br` → `pt-BR`); geçerli bir ad olduğu gibi kalır.
 */
export function normalizeTargetLanguage(input: string): TargetLanguage | null {
  const value = input.trim().replace(/\s+/g, ' ');
  const code = LANGUAGE_CATALOG.find((item) => item.toLowerCase() === value.toLowerCase());
  if (code !== undefined) return code;
  return targetLanguageSchema.safeParse(value).success ? value : null;
}

const englishNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language', fallback: 'code' });
  } catch {
    return null;
  }
})();

/** Modele giden ad: katalog kodları İngilizce adıyla ve koduyla, diğerleri yazıldığı gibi. */
export function modelLanguageLabel(language: TargetLanguage): string {
  if (!isCatalogLanguage(language)) return language;
  const name = englishNames?.of(language);
  return name && name !== language ? `${name} (${language})` : language;
}

/** Eklenti arayüzünün çevrildiği diller. */
export const UI_LANGUAGES = ['tr', 'en', 'de', 'fr', 'es'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

/** Her arayüz dilinin kendi dilindeki adı: kullanıcı kendi dilini hangi dilde olursa olsun tanır. */
export const UI_LANGUAGE_NAMES: Readonly<Record<UiLanguage, string>> = {
  tr: 'Türkçe',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
};

/** Ayardaki arayüz dili; `auto` tarayıcının dilini izler. */
export const UI_LANGUAGE_PREFERENCES = ['auto', ...UI_LANGUAGES] as const;
export type UiLanguagePreference = (typeof UI_LANGUAGE_PREFERENCES)[number];

/** Tarayıcı dillerinden desteklenen ilk arayüz dilini seçer; yoksa İngilizce. */
export function resolveUiLanguage(
  preference: UiLanguagePreference,
  browserLanguages: readonly string[],
): UiLanguage {
  if (preference !== 'auto') return preference;
  for (const language of browserLanguages) {
    const base = language.toLowerCase().split('-')[0];
    const match = UI_LANGUAGES.find((item) => item === base);
    if (match !== undefined) return match;
  }
  return 'en';
}
