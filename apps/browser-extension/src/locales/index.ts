import type { UiLanguage } from '@email-writer/contracts';

import { en } from './en';
import type { ExtensionText } from './extension-text';
import { tr } from './tr';

const TEXTS: Readonly<Record<UiLanguage, ExtensionText>> = { tr, en };

export function textFor(language: UiLanguage): ExtensionText {
  return TEXTS[language];
}

export type { ExtensionText, PopupStatusKey } from './extension-text';
