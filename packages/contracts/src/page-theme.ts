/**
 * E-posta uygulamasının o anki renkleri. Eklenti arayüzü sayfayla uyumlu
 * görünsün diye okunur; içerik taşımaz. Renkler CSS renk değeridir.
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
  /** Sayfada bulunamayan roller eklentinin kendi renkleriyle tamamlanır. */
  readonly colors: Readonly<Partial<Record<PageColorRole, string>>>;
}
