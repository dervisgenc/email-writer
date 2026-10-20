import {
  isCatalogLanguage,
  LANGUAGE_CATALOG,
  normalizeTargetLanguage,
  type CatalogLanguage,
  type TargetLanguage,
} from '@writehand/contracts';

/** Language names come from the browser's built-in data and are shown in the UI language. */
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

/** Localized name for a catalog code; a name the user typed is returned as is. */
export function languageLabel(language: TargetLanguage, locale: string): string {
  if (!isCatalogLanguage(language)) return language;
  const name = namesFor(locale)?.of(language);
  return name ? capitalize(name, locale) : language;
}

export interface LanguageOption {
  readonly value: CatalogLanguage;
  readonly label: string;
}

/** Catalog languages, sorted by their names in the UI language. */
export function languageOptions(locale: string): LanguageOption[] {
  return LANGUAGE_CATALOG.map((value) => ({ value, label: languageLabel(value, locale) })).sort((a, b) =>
    a.label.localeCompare(b.label, locale),
  );
}

/**
 * Turns user input into a target language: a code (`de`), the name in the UI language
 * ("Allemand" in French) or the English name ("German") maps to the catalog code; any
 * other valid name is kept as is. Returns `null` for unusable input.
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
