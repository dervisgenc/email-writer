import type { PageColorRole, PageTheme, Theme } from '@email-writer/contracts';

/** Eklenti arayüzünün renk değişkenleri ile sayfa renk rollerinin karşılığı. */
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
  /** `.ew-root` üzerindeki `data-theme`: yedek paletin seçimi. */
  readonly theme: 'light' | 'dark' | 'system';
  /** Sayfadan okunan renkler; yedek paletin üzerine yazılır. */
  readonly style: Readonly<Record<string, string>>;
}

/**
 * Ayar "otomatik" (`system`) ise ve e-posta uygulamasının renkleri
 * okunabiliyorsa eklenti onlarla görünür; böylece Outlook'un açık/koyu
 * modu ve vurgu rengi takip edilir. Okunamazsa işletim sistemi tercihi
 * kullanılır. Açık veya koyu seçimi sayfa renklerini geçersiz kılar.
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
