import {
  isCatalogLanguage,
  LANGUAGE_CATALOG,
  normalizeTargetLanguage,
  type CatalogLanguage,
  type TargetLanguage,
} from '@email-writer/contracts';

/** Dil adları tarayıcının yerleşik verisinden gelir; arayüz dilinde gösterilir. */
const displayNames = new Map<string, Intl.DisplayNames | null>();

function namesFor(locale: string): Intl.DisplayNames | null {
  if (!displayNames.has(locale)) {
    try {
      displayNames.set(locale, new Intl.DisplayNames([locale, 'en'], { type: 'language', fallback: 'code' }));
    } catch {
      displayNames.set(locale, null);
    }
  }
  return displayNames.get(locale) ?? null;
}

function capitalize(text: string, locale: string): string {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/** Katalog kodu için yerelleştirilmiş ad; kullanıcının yazdığı ad olduğu gibi. */
export function languageLabel(language: TargetLanguage, locale: string): string {
  if (!isCatalogLanguage(language)) return language;
  const name = namesFor(locale)?.of(language);
  return name ? capitalize(name, locale) : language;
}

export interface LanguageOption {
  readonly value: CatalogLanguage;
  readonly label: string;
}

/** Katalogdaki diller, arayüz dilindeki adlarına göre sıralı. */
export function languageOptions(locale: string): LanguageOption[] {
  return LANGUAGE_CATALOG.map((value) => ({ value, label: languageLabel(value, locale) })).sort((a, b) =>
    a.label.localeCompare(b.label, locale),
  );
}

/**
 * Kullanıcının yazdığını hedef dile çevirir: kod (`de`), arayüz dilindeki ad
 * ("Almanca") veya İngilizce ad ("German") katalog koduna eşlenir; başka geçerli
 * bir ad olduğu gibi kalır. Kullanılamayan girdi için `null` döner.
 */
export function matchLanguage(input: string, locale: string): TargetLanguage | null {
  const value = input.trim().replace(/\s+/g, ' ');
  if (value === '') return null;
  const normalized = normalizeTargetLanguage(value);
  if (normalized !== null && isCatalogLanguage(normalized)) return normalized;
  const wanted = value.toLocaleLowerCase(locale);
  for (const code of LANGUAGE_CATALOG) {
    if (
      languageLabel(code, locale).toLocaleLowerCase(locale) === wanted ||
      languageLabel(code, 'en').toLowerCase() === value.toLowerCase()
    ) {
      return code;
    }
  }
  return normalized;
}
