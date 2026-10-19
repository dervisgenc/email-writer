import type { AiCommand, SettingsChanges } from '@email-writer/contracts';
import { MatchPattern } from '#imports';

import { DEVELOPMENT_MATCHES, OUTLOOK_WEB_MATCHES } from '../bootstrap/supported-sites';
import { sendToBackground, sendToTab } from './extension-browser';
import { createRequest, sendRequest } from './runtime-messaging';

/**
 * Eklenti ekranlarının (araç çubuğu penceresi, ayarlar) arka plan koduna ve
 * etkin sekmenin content script'ine gönderdiği istekler.
 */
const requestId = () => crypto.randomUUID();

export function fetchAiStatus() {
  return sendRequest(sendToBackground, createRequest('AI_STATUS', {}, requestId()));
}
export function fetchAiSummary() {
  return sendRequest(sendToBackground, createRequest('AI_SUMMARY', {}, requestId()));
}
export function runAiCommand(command: AiCommand) {
  return sendRequest(sendToBackground, createRequest('AI_COMMAND', command, requestId()));
}
export function fetchHostInfo() {
  return sendRequest(sendToBackground, createRequest('HOST_INFO', {}, requestId()));
}
export function requestOpenOptions() {
  return sendRequest(sendToBackground, createRequest('OPEN_OPTIONS', {}, requestId()));
}

export function fetchSettings() {
  return sendRequest(sendToBackground, createRequest('GET_SETTINGS', {}, requestId()));
}

export function patchSettings(expectedRevision: number, changes: SettingsChanges) {
  return sendRequest(
    sendToBackground,
    createRequest('PATCH_SETTINGS', { expectedRevision, changes }, requestId()),
  );
}

export function queryPageStatus(tabId: number) {
  return sendRequest(
    (message) => sendToTab(tabId, message),
    createRequest('GET_PAGE_STATUS', {}, requestId()),
  );
}

export function requestOpenPanel(tabId: number) {
  return sendRequest((message) => sendToTab(tabId, message), createRequest('OPEN_PANEL', {}, requestId()));
}

export function fetchSelectorReport(tabId: number) {
  return sendRequest(
    (message) => sendToTab(tabId, message),
    createRequest('GET_SELECTOR_REPORT', {}, requestId()),
  );
}

const supportedPatterns = () => {
  const patterns: readonly string[] =
    import.meta.env.MODE === 'production'
      ? OUTLOOK_WEB_MATCHES
      : [...OUTLOOK_WEB_MATCHES, ...DEVELOPMENT_MATCHES];
  return patterns.map((pattern) => new MatchPattern(pattern));
};

/** Sekme adresi yalnızca desteklenen sitelerde tarayıcı tarafından verilir. */
export function isSupportedUrl(url: string | undefined): boolean {
  return url !== undefined && supportedPatterns().some((pattern) => pattern.includes(url));
}

export const SUPPORTED_ORIGINS: readonly string[] = OUTLOOK_WEB_MATCHES;
