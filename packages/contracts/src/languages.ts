/**
 * Çeviri ve yanıt için desteklenen hedef diller. Liste tek yerde tutulur;
 * işlem kayıtlarında ve ayarlarda yalnızca dil kodu kullanılır.
 */
export const LANGUAGE_CODES = ['tr', 'en', 'de', 'fr', 'es'] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

/** Eklenti arayüzünün desteklediği diller. */
export const UI_LANGUAGES = ['tr', 'en'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

export function isLanguageCode(value: string): value is LanguageCode {
  return (LANGUAGE_CODES as readonly string[]).includes(value);
}
