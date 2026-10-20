import type { PageColorRole, PageTheme } from '@writehand/contracts';

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

/** The 0–255 channels of a `#rgb`, `#rrggbb` or `rgb(r, g, b)` value. */
function parseChannels(color: string): number[] | null {
  const value = color.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value)?.[1];
  if (hex !== undefined) {
    const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex;
    return [0, 2, 4].map((index) => Number.parseInt(full.slice(index, index + 2), 16));
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(value);
  return rgb === null ? null : [rgb[1], rgb[2], rgb[3]].map(Number);
}

/** Relative luminance of the color from 0 to 1 (WCAG); `null` if it cannot be parsed. */
function relativeLuminance(color: string): number | null {
  const channels = parseChannels(color);
  if (channels === null) {
    return null;
  }
  const [red = 0, green = 0, blue = 0] = channels.map((channel) => {
    const unit = channel / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

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
  const luminance = colors.background === undefined ? null : relativeLuminance(colors.background);
  if (luminance === null || colors.text === undefined) {
    return null;
  }
  return { scheme: luminance < 0.4 ? 'dark' : 'light', colors };
}
