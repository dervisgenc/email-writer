/**
 * The email app's current colors. Read so the extension UI matches the page; carries no
 * content. Colors are CSS color values.
 */
export const PAGE_COLOR_ROLES = [
  'background',
  'surface',
  'surfaceHover',
  'border',
  'text',
  'mutedText',
  'accent',
  'accentHover',
  'onAccent',
  'link',
  'focus',
] as const;

export type PageColorRole = (typeof PAGE_COLOR_ROLES)[number];

export interface PageTheme {
  readonly scheme: 'light' | 'dark';
  /** Roles missing from the page are filled in with the extension's own colors. */
  readonly colors: Readonly<Partial<Record<PageColorRole, string>>>;
}
