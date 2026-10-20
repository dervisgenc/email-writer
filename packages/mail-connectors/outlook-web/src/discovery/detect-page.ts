import type { PageSupport } from '@writehand/contracts';

import { NON_MAIL_PATH_PREFIXES, queryFirst } from './selectors';

/** If no mail UI markers appear within this time, the screen counts as unsupported. */
export const DEFAULT_WAIT_LIMIT_MS = 15_000;

/**
 * Decides whether the visible area is the mail UI. No button is added to the
 * calendar or sign-in screens on the same domain. Falling back to the whole
 * page's text when a selector does not match is forbidden.
 */
export function detectPage(
  document: Document,
  elapsedMs: number,
  waitLimitMs = DEFAULT_WAIT_LIMIT_MS,
): PageSupport {
  const path = document.location?.pathname.toLowerCase() ?? '/';
  if (NON_MAIL_PATH_PREFIXES.some((prefix) => path.startsWith(prefix) || path.includes(`${prefix}/`))) {
    return 'unsupported';
  }
  const hasMailUi =
    queryFirst(document, 'readingPane') !== null ||
    queryFirst(document, 'composeEditor') !== null ||
    queryFirst(document, 'selectedConversation') !== null;
  if (hasMailUi) {
    return 'ready';
  }
  return elapsedMs < waitLimitMs ? 'waiting' : 'unsupported';
}
