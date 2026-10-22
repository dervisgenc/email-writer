import type { PageTheme } from '@writehand/contracts';
import { isDarkBackground } from '@writehand/mail-dom';

import { queryFirst } from './selectors';

/**
 * Reads whether Gmail is light or dark from the computed background of its main surface, and
 * that background and text color, the way InboxSDK tells Gmail's theme. Only colors are read,
 * never page content. Gmail exposes no theme variables or classes, so the accent and other
 * roles keep the extension's own colors. Returns `null` when the surface is transparent (a theme
 * with a background picture); the extension then follows the system theme.
 */
export function readPageTheme(document: Document): PageTheme | null {
  const view = document.defaultView;
  if (view === null) {
    return null;
  }
  for (const surface of [queryFirst(document, 'themeSurface'), document.body]) {
    if (surface === null) {
      continue;
    }
    const style = view.getComputedStyle(surface);
    const dark = isDarkBackground(style.backgroundColor);
    if (dark !== null) {
      return {
        scheme: dark ? 'dark' : 'light',
        colors: { background: style.backgroundColor, text: style.color },
      };
    }
  }
  return null;
}
