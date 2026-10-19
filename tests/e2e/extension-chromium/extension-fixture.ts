import { resolve } from 'node:path';

import { chromium, test as base, type BrowserContext, type Page, type Worker } from '@playwright/test';

export const FIXTURE_URL = 'http://127.0.0.1:4517/mail/inbox';

/** Test derlemesi: yerel örnek sayfa origin'i ve etiketli örnek sonuç kaynağı içerir. */
const EXTENSION_PATH = resolve(process.cwd(), 'apps/browser-extension/.output/chrome-mv3-test');

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      // Arayüz dili varsayılan olarak tarayıcı dilini izler; testler Türkçe metinleri doğrular.
      locale: 'tr-TR',
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent('serviceworker');
    await use(new URL(worker.url()).host);
  },
});

export const expect = test.expect;

/**
 * Sahte yerel yardımcı uygulama: arka plandaki `connectNative` yerine geçer. `installed`
 * false iken bağlantı hemen kopar (yardımcı uygulama yok); true iken HOST_*, AI_STATUS ve
 * AI_GENERATE isteklerine sabit yanıt verir. Durum testten `globalThis.fakeHost` ile değiştirilir.
 */
export async function installFakeHost(worker: Worker, options: { installed: boolean }): Promise<void> {
  await worker.evaluate((installed) => {
    const host = {
      installed,
      info: {
        version: '0.1.0',
        os: 'linux',
        arch: 'x64',
        browsers: ['firefox', 'chrome'],
        development: false,
      },
      latest: '0.2.0',
      status: {
        mode: 'claude-code',
        accounts: [],
        activeAccountId: null,
        apiKeyConfigured: false,
        models: [{ id: 'sonnet', label: 'Claude Sonnet' }],
        selectedModel: 'sonnet',
        ready: true,
        signingIn: false,
        needsPlanAcknowledgement: false,
        claudeCode: {
          installed: true,
          loggedIn: true,
          subscription: true,
          plan: 'max',
          account: 'demo@example.test',
          organization: null,
        },
        error: null,
      },
    };
    (globalThis as unknown as { fakeHost: typeof host }).fakeHost = host;
    const runtime = (globalThis as unknown as { chrome: { runtime: { connectNative: () => unknown } } })
      .chrome.runtime;
    runtime.connectNative = () => {
      let receive: (message: unknown) => void = () => undefined;
      let disconnect: () => void = () => undefined;
      const payloadFor = (type: string): unknown => {
        if (type === 'HOST_INFO') return host.info;
        if (type === 'HOST_UPDATE_CHECK')
          return {
            current: host.info.version,
            latest: host.latest,
            available: host.latest !== host.info.version,
          };
        if (type === 'HOST_UPDATE') {
          host.info = { ...host.info, version: host.latest };
          return { version: host.latest };
        }
        if (type === 'AI_GENERATE')
          return {
            text: 'Hi Sam,\n\nThanks for your message. I can send the report on Thursday, but I need the latest numbers from your team first. Could you share them by Wednesday?\n\nBest,\nAlex',
          };
        return host.status;
      };
      return {
        onMessage: { addListener: (listener: (message: unknown) => void) => (receive = listener) },
        onDisconnect: { addListener: (listener: () => void) => (disconnect = listener) },
        disconnect: () => undefined,
        postMessage(request: { protocolVersion: number; requestId: string; type: string }) {
          setTimeout(() => {
            // Without the helper app the browser closes the port at once.
            if (!host.installed) return disconnect();
            receive({
              protocolVersion: request.protocolVersion,
              requestId: request.requestId,
              ok: true,
              payload: structuredClone(payloadFor(request.type)),
            });
          }, 0);
        },
      };
    };
  }, options.installed);
}

/** İsteğe bağlı `nativeMessaging` iznini sayfada taklit eder; Playwright tarayıcının izin penceresini onaylayamaz. */
export async function fakeNativeMessagingPermission(page: Page, granted = false): Promise<void> {
  await page.addInitScript((initial) => {
    let allowed = initial;
    const permissions = (globalThis as unknown as { chrome: { permissions: Record<string, unknown> } }).chrome
      .permissions;
    permissions.contains = async () => allowed;
    permissions.request = async () => (allowed = true);
  }, granted);
}
