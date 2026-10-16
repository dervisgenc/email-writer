import { resolve } from 'node:path';

import { chromium, test as base, type BrowserContext } from '@playwright/test';

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
