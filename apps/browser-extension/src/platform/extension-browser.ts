import { browser } from '#imports';
import { NATIVE_HOST_NAME, type HostOperatingSystem } from '@email-writer/contracts';

import type { MessageSender } from './runtime-messaging';
import type { SettingsStorageArea } from './settings-store';

/**
 * Tarayıcı eklenti API'lerine dokunan tek yer. Tarayıcıya özgü bir fark
 * gerekirse burada uyarlanır; iş kurallarına `if Firefox` kontrolleri yayılmaz.
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
 * Genel `tabs` izni olmadan etkin sekme alınır. Adres yalnızca eklentinin
 * erişim izni olan (desteklenen) sitelerde tarayıcı tarafından verilir.
 */
export async function activeTab(): Promise<{ readonly id: number; readonly url: string | undefined } | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id === undefined ? null : { id: tab.id, url: tab.url };
}

const extensionOrigin = () => browser.runtime.getURL('/');

/** Mesaj yalnızca bu eklentinin kendi ekranlarından (araç çubuğu, ayarlar) kabul edilir. */
export function isOwnExtensionPage(sender: MessageSender): boolean {
  return (
    sender.id === browser.runtime.id &&
    typeof sender.url === 'string' &&
    sender.url.startsWith(extensionOrigin())
  );
}

/**
 * Yerel yardımcı uygulamayla konuşma izni (`nativeMessaging`) isteğe bağlıdır: kurulumda uyarı
 * çıkmaz, karşılama sihirbazı izni gerekçesiyle birlikte ister. İzin yokken tarayıcı
 * `connectNative`'i sunmaz.
 */
export async function hasNativeMessagingPermission(): Promise<boolean> {
  try {
    return await browser.permissions.contains({ permissions: ['nativeMessaging'] });
  } catch {
    return false;
  }
}

/** Tarayıcı izin penceresini açar; kullanıcı tıklamasının içinde, beklemeden çağrılmalıdır. */
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

/** Karşılama sihirbazını yeni sekmede açar (`tabs` izni gerekmez). */
export async function openWelcomePage(): Promise<void> {
  await browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') });
}

/** Tarayıcının çalıştığı işletim sistemi; sürüm dosyalarındaki adlarla. */
export async function operatingSystem(): Promise<HostOperatingSystem> {
  const { os } = await browser.runtime.getPlatformInfo();
  return os === 'mac' ? 'darwin' : os === 'win' ? 'windows' : 'linux';
}

/** Desteklenen sitelere erişim izninin hâlâ verilmiş olup olmadığı. */
export async function hasSiteAccess(origins: readonly string[]): Promise<boolean> {
  try {
    return await browser.permissions.contains({ origins: [...origins] });
  } catch {
    return false;
  }
}
