import { browser } from '#imports';
import { NATIVE_HOST_NAME, type HostOperatingSystem } from '@writehand/contracts';

import type { MessageSender } from './runtime-messaging';
import type { SettingsStorageArea } from './settings-store';

/**
 * The only place that touches browser extension APIs. Browser-specific differences
 * are adapted here, so `if Firefox` checks do not spread into business rules.
 */
export const localSettingsArea: SettingsStorageArea = {
  get: (key) => browser.storage.local.get(key),
  set: (items) => browser.storage.local.set(items),
};

export function onSettingsStorageChanged(key: string, listener: (value: unknown) => void): () => void {
  const handler = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
    const change = changes[key];
    if (areaName === 'local' && change !== undefined) {
      listener(change.newValue);
    }
  };
  browser.storage.onChanged.addListener(handler);
  return () => browser.storage.onChanged.removeListener(handler);
}

export function sendToBackground(message: unknown): Promise<unknown> {
  return browser.runtime.sendMessage(message);
}

export function sendToTab(tabId: number, message: unknown): Promise<unknown> {
  return browser.tabs.sendMessage(tabId, message);
}

/**
 * Gets the active tab without the broad `tabs` permission. The browser exposes the URL
 * only on (supported) sites the extension has access to.
 */
export async function activeTab(): Promise<{ readonly id: number; readonly url: string | undefined } | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id === undefined ? null : { id: tab.id, url: tab.url };
}

const extensionOrigin = () => browser.runtime.getURL('/');

/** Messages are accepted only from this extension's own screens (toolbar, settings). */
export function isOwnExtensionPage(sender: MessageSender): boolean {
  return (
    sender.id === browser.runtime.id &&
    typeof sender.url === 'string' &&
    sender.url.startsWith(extensionOrigin())
  );
}

/**
 * Permission to talk to the local helper app (`nativeMessaging`) is optional: no warning at
 * install time; the welcome wizard requests it along with the reason. Without it the browser
 * does not expose `connectNative`.
 */
export async function hasNativeMessagingPermission(): Promise<boolean> {
  try {
    return await browser.permissions.contains({ permissions: ['nativeMessaging'] });
  } catch {
    return false;
  }
}

/** Opens the browser permission prompt; must be called inside a user click, before any await. */
export function requestNativeMessagingPermission(): Promise<boolean> {
  return browser.permissions.request({ permissions: ['nativeMessaging'] }).catch(() => false);
}

export function connectAiHost() {
  if (typeof browser.runtime.connectNative !== 'function')
    throw new Error('Native messaging is not allowed.');
  const port = browser.runtime.connectNative(NATIVE_HOST_NAME);
  // Read lastError only to acknowledge browser failures; never log native messages.
  port.onDisconnect.addListener(() => {
    void browser.runtime.lastError;
  });
  return port;
}

export function extensionId(): string {
  return browser.runtime.id;
}

export function addRuntimeMessageListener(
  listener: (message: unknown, sender: MessageSender, sendResponse: (response: unknown) => void) => boolean,
): () => void {
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}

export function openOptionsPage(): Promise<void> {
  return browser.runtime.openOptionsPage();
}

/** Opens the welcome wizard in a new tab (no `tabs` permission needed). */
export async function openWelcomePage(): Promise<void> {
  await browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') });
}

/** The operating system the browser runs on, using the names from the release files. */
export async function operatingSystem(): Promise<HostOperatingSystem> {
  const { os } = await browser.runtime.getPlatformInfo();
  return os === 'mac' ? 'darwin' : os === 'win' ? 'windows' : 'linux';
}

/** Whether access to the supported sites is still granted. */
export async function hasSiteAccess(origins: readonly string[]): Promise<boolean> {
  try {
    return await browser.permissions.contains({ origins: [...origins] });
  } catch {
    return false;
  }
}
