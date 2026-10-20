import type { PageColorRole, PageTheme, Theme } from '@writehand/contracts';

/** Maps page color roles to the extension UI's color variables. */
const TOKEN_FOR_ROLE: Readonly<Record<PageColorRole, string>> = {
  background: '--ew-color-bg',
  surface: '--ew-color-surface',
  surfaceHover: '--ew-color-surface-hover',
  border: '--ew-color-border',
  text: '--ew-color-text',
  mutedText: '--ew-color-muted',
  accent: '--ew-color-accent',
  accentHover: '--ew-color-accent-hover',
  onAccent: '--ew-color-on-accent',
  link: '--ew-color-link',
  focus: '--ew-color-focus',
};

export interface Appearance {
  /** `data-theme` on `.ew-root`: selects the fallback palette. */
  readonly theme: 'light' | 'dark' | 'system';
  /** Colors read from the page; they override the fallback palette. */
  readonly style: Readonly<Record<string, string>>;
}

/**
 * When the setting is "automatic" (`system`) and the mail app's colors can be
 * read, the extension uses them, so it follows Outlook's light/dark mode and
 * accent color. If they cannot be read, the operating system preference is
 * used. Choosing light or dark overrides the page colors.
 */
export function resolveAppearance(setting: Theme, page: PageTheme | null): Appearance {
  if (setting !== 'system') {
    return { theme: setting, style: {} };
  }
  if (page === null) {
    return { theme: 'system', style: {} };
  }
  const style: Record<string, string> = {};
  for (const [role, value] of Object.entries(page.colors) as [PageColorRole, string][]) {
    style[TOKEN_FOR_ROLE[role]] = value;
  }
  return { theme: page.scheme, style };
}
