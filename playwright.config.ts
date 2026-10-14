import { defineConfig } from '@playwright/test';

/**
 * Eklenti akışları Playwright ile yalnızca Chromium'da test edilebilir.
 * Firefox ayrıca `tests/e2e/extension-firefox/run-smoke.mjs` ve gerçek
 * kurulumla denenir; Chromium testinin geçmesi Firefox için yeterli sayılmaz.
 */
export default defineConfig({
  testDir: 'tests/e2e/extension-chromium',
  timeout: 30_000,
  workers: 1,
  reporter: [['list']],
  webServer: {
    command: 'node scripts/serve-fixtures.mjs',
    url: 'http://127.0.0.1:4517/mail/inbox',
    reuseExistingServer: true,
  },
});
