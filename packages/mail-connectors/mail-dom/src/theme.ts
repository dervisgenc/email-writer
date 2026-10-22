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
export function relativeLuminance(color: string): number | null {
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

/** Whether a background of this color is dark; `null` if it cannot be parsed. */
export function isDarkBackground(color: string): boolean | null {
  const luminance = relativeLuminance(color);
  return luminance === null ? null : luminance < 0.4;
}
