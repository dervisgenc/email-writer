import {
  SITE_IDS,
  type AiCommand,
  type AiInput,
  type SettingsChanges,
  type SiteId,
} from '@writehand/contracts';
import { MatchPattern } from '#imports';

import { DEVELOPMENT_MATCHES, SITE_MATCHES } from '../bootstrap/supported-sites';
import { sendToBackground, sendToTab } from './extension-browser';
import { createRequest, sendRequest } from './runtime-messaging';

/**
 * Requests that the extension's screens (toolbar popup, settings) send to the
 * background and to the active tab's content script.
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
/** Generation from an extension page (the welcome wizard's trial run). */
export function generateText(input: AiInput) {
  return sendRequest(
    sendToBackground,
    createRequest('AI_GENERATE', { generationId: crypto.randomUUID(), input }, requestId()),
  );
}
export function fetchHostInfo() {
  return sendRequest(sendToBackground, createRequest('HOST_INFO', {}, requestId()));
}
export function checkHostUpdate() {
  return sendRequest(sendToBackground, createRequest('HOST_UPDATE_CHECK', {}, requestId()));
}
export function updateHost() {
  return sendRequest(sendToBackground, createRequest('HOST_UPDATE', {}, requestId()));
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

const sitePatterns = (site: SiteId) =>
  (import.meta.env.MODE === 'production'
    ? SITE_MATCHES[site]
    : [...SITE_MATCHES[site], ...DEVELOPMENT_MATCHES[site]]
  ).map((pattern) => new MatchPattern(pattern));

/** The supported mail site a tab URL belongs to; the browser exposes the URL only on those. */
export function siteOfUrl(url: string | undefined): SiteId | null {
  if (url === undefined) return null;
  return SITE_IDS.find((site) => sitePatterns(site).some((pattern) => pattern.includes(url))) ?? null;
}

export function isSupportedUrl(url: string | undefined): boolean {
  return siteOfUrl(url) !== null;
}
