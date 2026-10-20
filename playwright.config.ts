import { defineConfig } from '@playwright/test';

/**
 * Playwright can only drive extension flows in Chromium. Firefox is covered
 * separately by `tests/e2e/extension-firefox/run-smoke.mjs` and a real install;
 * a passing Chromium run does not count for Firefox.
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
