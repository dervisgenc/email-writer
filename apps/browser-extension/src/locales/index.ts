import { resolveUiLanguage, type UiLanguage, type UiLanguagePreference } from '@email-writer/contracts';

import { de } from './de';
import { en } from './en';
import { es } from './es';
import type { ExtensionText } from './extension-text';
import { fr } from './fr';
import { tr } from './tr';

const TEXTS: Readonly<Record<UiLanguage, ExtensionText>> = { tr, en, de, fr, es };

/** Ayardaki tercih (`auto` dahil) ve tarayıcı dillerine göre arayüz dili. */
export function uiLanguageFor(
  preference: UiLanguagePreference,
  browserLanguages: readonly string[] = globalThis.navigator?.languages ?? [],
): UiLanguage {
  return resolveUiLanguage(preference, browserLanguages);
}

export function textFor(preference: UiLanguagePreference): ExtensionText {
  return TEXTS[uiLanguageFor(preference)];
}

export type { ExtensionText, PopupStatusKey } from './extension-text';
