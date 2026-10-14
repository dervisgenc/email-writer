import type { PageSupport } from '@email-writer/contracts';

import { NON_MAIL_PATH_PREFIXES, queryFirst } from './selectors';

/** Posta arayüzü işaretleri bu süre içinde görünmezse ekran desteklenmiyor sayılır. */
export const DEFAULT_WAIT_LIMIT_MS = 15_000;

/**
 * Görünen alanın posta arayüzü olup olmadığını belirler. Aynı alan adındaki
 * takvim veya giriş ekranına düğme eklenmez. Bir seçici eşleşmediğinde bütün
 * sayfanın metnini yedek yöntem olarak almak yasaktır.
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
