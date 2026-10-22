import type { PageColorRole, PageTheme } from '@writehand/contracts';
import { isDarkBackground } from '@writehand/mail-dom';

import { queryFirst } from './selectors';

/** Maps the extension's color roles to Fluent UI v9 theme variables. */
const FLUENT_VARIABLES: Readonly<Record<PageColorRole, string>> = {
  background: '--colorNeutralBackground1',
  surface: '--colorNeutralBackground3',
  surfaceHover: '--colorNeutralBackground1Hover',
  border: '--colorNeutralStroke2',
  text: '--colorNeutralForeground1',
  mutedText: '--colorNeutralForeground3',
  accent: '--colorBrandBackground',
  accentHover: '--colorBrandBackgroundHover',
  onAccent: '--colorNeutralForegroundOnBrand',
  link: '--colorBrandForeground1',
  focus: '--colorStrokeFocus2',
};

/**
 * Reads Outlook's current theme colors. Only color values are read, never page
 * content. Returns `null` if the background or text color is missing; the
 * extension then uses its own light/dark theme.
 */
export function readPageTheme(document: Document): PageTheme | null {
  const provider = queryFirst(document, 'themeProvider');
  const style = provider === null ? null : (document.defaultView?.getComputedStyle(provider) ?? null);
  if (style === null) {
    return null;
  }
  const colors: Partial<Record<PageColorRole, string>> = {};
  for (const [role, variable] of Object.entries(FLUENT_VARIABLES) as [PageColorRole, string][]) {
    const value = style.getPropertyValue(variable).trim();
    if (value !== '') {
      colors[role] = value;
    }
  }
  const dark = colors.background === undefined ? null : isDarkBackground(colors.background);
  if (dark === null || colors.text === undefined) {
    return null;
  }
  return { scheme: dark ? 'dark' : 'light', colors };
}
