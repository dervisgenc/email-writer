import { z } from 'zod';

/**
 * Suggested target languages for translation and replies (BCP 47). The list is only a
 * suggestion: the user can also type the name of a language that is not in the catalog.
 * Language names are shown in the UI language via `Intl.DisplayNames`; no translations
 * are kept here.
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
 * Target language: a catalog code (e.g. `de`, `pt-BR`) or a language name the user typed
 * (e.g. "Ottoman Turkish"). The name reaches the model as data; line breaks and markup
 * characters are rejected.
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
 * Turns user input into a target language: catalog codes match case-insensitively
 * (`PT-br` → `pt-BR`); a valid name is kept as is.
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

/** Name sent to the model: catalog codes as English name plus code, others as typed. */
export function modelLanguageLabel(language: TargetLanguage): string {
  if (!isCatalogLanguage(language)) return language;
  const name = englishNames?.of(language);
  return name && name !== language ? `${name} (${language})` : language;
}

/** Languages the extension UI is translated into. */
export const UI_LANGUAGES = ['tr', 'en', 'de', 'fr', 'es'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

/** Each UI language's name in that language, so users recognize theirs whatever the current UI language. */
export const UI_LANGUAGE_NAMES: Readonly<Record<UiLanguage, string>> = {
  tr: 'Türkçe',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
};

/** UI language setting; `auto` follows the browser language. */
export const UI_LANGUAGE_PREFERENCES = ['auto', ...UI_LANGUAGES] as const;
export type UiLanguagePreference = (typeof UI_LANGUAGE_PREFERENCES)[number];

/** Picks the first supported UI language from the browser languages; falls back to English. */
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
