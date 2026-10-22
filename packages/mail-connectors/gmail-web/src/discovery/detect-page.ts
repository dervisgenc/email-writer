import type { PageSupport } from '@writehand/contracts';

import { queryFirst } from './selectors';

/** If no mail UI markers appear within this time, the screen counts as unsupported. */
export const DEFAULT_WAIT_LIMIT_MS = 15_000;

/**
 * Decides whether the page is Gmail's mail UI. Google Chat on the same host (`/chat/…`) gets no
 * buttons; Gmail's own single-purpose views (print, original message) have neither the app's
 * main area nor an editor, so they end up unsupported too. Falling back to the whole page's
 * text when a selector does not match is forbidden.
 */
export function detectPage(
  document: Document,
  elapsedMs: number,
  waitLimitMs = DEFAULT_WAIT_LIMIT_MS,
): PageSupport {
  // Gmail's paths are `/mail/u/<n>/`; the synthetic test pages put a prefix before them.
  if (!(document.location?.pathname ?? '/').includes('/mail/')) {
    return 'unsupported';
  }
  const hasMailUi =
    queryFirst(document, 'mainArea') !== null || queryFirst(document, 'composeEditor') !== null;
  if (hasMailUi) {
    return 'ready';
  }
  return elapsedMs < waitLimitMs ? 'waiting' : 'unsupported';
}
