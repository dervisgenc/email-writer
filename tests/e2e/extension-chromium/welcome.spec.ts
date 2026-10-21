import { expect, fakePermissions, installFakeGroq, installFakeHost, test } from './extension-fixture';

const DOWNLOAD = 'https://github.com/dervisgenc/writehand/releases/latest/download';
/** The browser runs on the same machine as the test, so the wizard preselects this system. */
const HOST_SYSTEM =
  ({ darwin: 'macOS', win32: 'Windows' } as Record<string, string>)[process.platform] ?? 'Linux';
const noHorizontalScroll = () => document.documentElement.scrollWidth <= window.innerWidth;

test('opens the welcome wizard by itself on first install', async ({ context, extensionId }) => {
  await expect
    .poll(() => context.pages().map((page) => page.url()))
    .toContain(`chrome-extension://${extensionId}/welcome.html`);
});

test('wizard: the two ways to connect, the helper app install for a plan and a trial with a fake helper app', async ({
  context,
  extensionId,
}) => {
  test.setTimeout(60_000);
  const worker = context.serviceWorkers()[0]!;
  await installFakeHost(worker, { installed: false });
  const page = await context.newPage();
  await fakePermissions(page);
  await page.goto(`chrome-extension://${extensionId}/welcome.html`);

  await expect(page.getByRole('heading', { name: 'Hoş geldiniz', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bağlanmanın iki yolu' })).toBeVisible();
  await expect(page.getByText('Doğrudan tarayıcıda çalışır; hiçbir şey kurmanız gerekmez.')).toBeVisible();
  await expect(page.getByText('E-posta göndermez.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'GitHub’daki kaynak kodu' })).toHaveAttribute(
    'href',
    'https://github.com/dervisgenc/writehand',
  );
  await page.screenshot({ path: 'test-results/welcome-1-light.png', fullPage: true, animations: 'disabled' });

  await page.getByRole('button', { name: 'Devam' }).click();
  await expect(page.getByRole('heading', { name: 'AI bağlantısı' })).toBeVisible();
  // Without the helper app, the method that works without it is preselected.
  await expect(page.locator('.ew-method[data-mode="api-key"]')).toHaveAttribute('data-checked', 'true');
  await expect(page.locator('.ew-method[data-mode="chatgpt"]')).toContainText('Önerilen');
  await expect(page.locator('.ew-method[data-mode="claude-code"]')).toContainText('Deneysel');
  await page.locator('.ew-method[data-mode="claude-code"]').click();
  // A plan method needs the helper app: its install appears in place of the method's settings.
  await expect(page.getByRole('heading', { name: 'Yardımcı uygulamayı kurun' })).toBeVisible();
  // The browser cannot reach the helper app without the permission, so it is requested here.
  await page.getByRole('button', { name: 'İzin ver' }).click();
  await expect(page.getByRole('button', { name: 'İzin ver' })).toHaveCount(0);
  await expect(page.getByText('Yardımcı uygulama bekleniyor')).toBeVisible();
  // The system the browser runs on is preselected; the unpacked extension's ID is added to the command.
  await expect(page.getByRole('radio', { name: HOST_SYSTEM })).toBeChecked();
  await page.getByText('Linux', { exact: true }).click();
  await expect(page.locator('.ew-command__text').first()).toHaveText(
    `curl -fsSL ${DOWNLOAD}/install.sh | sh -s -- --extension-id=${extensionId}`,
  );
  await page.getByText('Windows', { exact: true }).click();
  await expect(page.locator('.ew-command__text').first()).toHaveText(
    `$env:WRITEHAND_EXTENSION_ID='${extensionId}'; irm ${DOWNLOAD}/install.ps1 | iex`,
  );
  await expect(page.getByText('PowerShell’i açın')).toBeVisible();
  await page.getByText('Komut ne yapar?').click();
  await expect(page.getByText('SHA-256 sağlamasını denetler; tutmazsa durur.')).toBeVisible();
  await page.screenshot({
    path: 'test-results/welcome-2-waiting.png',
    fullPage: true,
    animations: 'disabled',
  });

  // Once the user runs the command, the chosen method appears within a few seconds.
  await worker.evaluate(() => {
    (globalThis as unknown as { fakeHost: { installed: boolean } }).fakeHost.installed = true;
  });
  await expect(page.getByText('Bağlı · Metin üretmeye hazır')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.ew-ai-settings .ew-status-pill')).toHaveText('Hazır');
  await expect(page.locator('.ew-method[data-mode="claude-code"]')).toHaveAttribute('data-checked', 'true');

  await page.getByRole('button', { name: 'Devam' }).click();
  await page.getByRole('button', { name: 'Örneği düzelt' }).click();
  await expect(page.getByText('Thanks for your message.', { exact: false })).toBeVisible();
  await expect(page.getByText('Her şey çalışıyor.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Outlook’u aç' })).toHaveAttribute(
    'href',
    'https://outlook.office.com/mail/',
  );
  // The last step stays current; the two before it are done.
  await expect(page.locator('.ew-steps__item[data-state="done"]')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/welcome-3-light.png', fullPage: true, animations: 'disabled' });

  // Dark theme (the Automatic setting follows the system preference) at phone width: no horizontal scroll.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  for (let step = 0; step < 3; step++) {
    await page.locator('.ew-steps__button').nth(step).click();
    expect(await page.evaluate(noHorizontalScroll), `step ${step + 1}`).toBe(true);
  }
  await page.locator('.ew-steps__button').nth(1).click();
  await page.screenshot({
    path: 'test-results/welcome-2-narrow-dark.png',
    fullPage: true,
    animations: 'disabled',
  });
});

test('wizard: a Groq key works without the helper app, stays encrypted and revises the sample', async ({
  context,
  extensionId,
}) => {
  const worker = context.serviceWorkers()[0]!;
  await installFakeHost(worker, { installed: false });
  await installFakeGroq(worker);
  const page = await context.newPage();
  await fakePermissions(page);
  await page.goto(`chrome-extension://${extensionId}/welcome.html`);
  await page.getByRole('button', { name: 'Devam' }).click();

  await expect(page.getByRole('radio', { name: 'Groq', exact: true })).toBeChecked();
  await expect(page.getByRole('link', { name: 'Groq API anahtarı oluştur' })).toHaveAttribute(
    'href',
    'https://console.groq.com/keys',
  );
  // A key in another provider's format is not sent.
  await page.getByLabel('Groq API anahtarı').fill('sk-or-v1-e2e-test-key-0123456789');
  await expect(page.getByText('Bu bir OpenRouter anahtarına benziyor')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anahtarı bağla' })).toBeDisabled();
  await page.getByLabel('Groq API anahtarı').fill('gsk_e2e-test-key-0123456789');
  await page.getByRole('button', { name: 'Anahtarı bağla' }).click();

  await expect(page.getByText('Groq anahtarı bu tarayıcıda şifreli olarak kayıtlı.')).toBeVisible();
  await expect(page.locator('.ew-ai-settings .ew-status-pill')).toHaveText('Hazır');
  // OpenAI's free open-weight model is chosen; speech models are not offered.
  await expect(page.getByLabel('Model', { exact: true })).toHaveValue('openai/gpt-oss-120b');
  await expect(page.getByLabel('Model', { exact: true }).locator('option')).toHaveText([
    'Model',
    'llama-3.3-70b-versatile',
    'openai/gpt-oss-120b',
  ]);
  await expect(page.getByLabel('Groq API anahtarı')).toHaveValue('');
  await page.screenshot({
    path: 'test-results/welcome-2-api-key.png',
    fullPage: true,
    animations: 'disabled',
  });

  await page.getByRole('button', { name: 'Devam' }).click();
  await page.getByRole('button', { name: 'Örneği düzelt' }).click();
  await expect(page.getByText('Thanks for your message.', { exact: false })).toBeVisible();

  // Every request went to Groq with the key; storage holds only ciphertext.
  const requests = await worker.evaluate(
    () =>
      (globalThis as unknown as { fakeGroq: { requests: { url: string; authorization: string }[] } }).fakeGroq
        .requests,
  );
  expect(requests.map((request) => request.url)).toEqual([
    'https://api.groq.com/openai/v1/models',
    'https://api.groq.com/openai/v1/chat/completions',
  ]);
  expect(new Set(requests.map((request) => request.authorization))).toEqual(
    new Set(['Bearer gsk_e2e-test-key-0123456789']),
  );
  const stored = await worker.evaluate(() =>
    (
      globalThis as unknown as { chrome: { storage: { local: { get: (key: null) => Promise<unknown> } } } }
    ).chrome.storage.local.get(null),
  );
  expect(JSON.stringify(stored)).toContain('"secrets"');
  expect(JSON.stringify(stored)).not.toContain('gsk_e2e-test-key');
});

test('the helper app card in settings shows the version and installs the update', async ({
  context,
  extensionId,
}) => {
  const worker = context.serviceWorkers()[0]!;
  await installFakeHost(worker, { installed: true });
  const page = await context.newPage();
  await fakePermissions(page, true);
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  const helper = page.locator('.ew-helper');
  await expect(helper.locator('.ew-status-pill')).toHaveText('Bağlı');
  await expect(helper).toContainText('Sürüm 0.1.0 · Linux (x64)');
  await expect(helper).toContainText('Kayıtlı tarayıcılar: Firefox, Chrome');
  await expect(helper).toContainText('Sürüm 0.2.0 hazır.');
  await page.screenshot({
    path: 'test-results/options-helper-light.png',
    fullPage: true,
    animations: 'disabled',
  });
  await helper.getByRole('button', { name: 'Güncelle' }).click();
  await expect(helper).toContainText('Sürüm 0.2.0 kuruldu.');
  await expect(helper).toContainText('Sürüm 0.2.0 · Linux (x64)');

  // Turning the check off is saved and the update line disappears.
  await helper.getByRole('switch').uncheck();
  await page.reload();
  await expect(page.locator('.ew-helper').getByRole('switch')).not.toBeChecked();
  await expect(page.locator('.ew-helper')).not.toContainText('hazır.');

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.ew-helper').getByText('Nasıl kaldırılır?').click();
  expect(await page.evaluate(noHorizontalScroll)).toBe(true);
  await page.screenshot({
    path: 'test-results/options-helper-narrow-dark.png',
    fullPage: true,
    animations: 'disabled',
  });
});
