import { expect, fakeNativeMessagingPermission, installFakeHost, test } from './extension-fixture';

const DOWNLOAD = 'https://github.com/dervisgenc/email-writer/releases/latest/download';
const noHorizontalScroll = () => document.documentElement.scrollWidth <= window.innerWidth;

test('ilk kurulumda karşılama sihirbazı kendiliğinden açılır', async ({ context, extensionId }) => {
  await expect
    .poll(() => context.pages().map((page) => page.url()))
    .toContain(`chrome-extension://${extensionId}/welcome.html`);
});

test('sihirbaz: izin, tek komutla kurulum, yöntem ve deneme sahte yardımcı uygulamayla tamamlanır', async ({
  context,
  extensionId,
}) => {
  test.setTimeout(60_000);
  const worker = context.serviceWorkers()[0]!;
  await installFakeHost(worker, { installed: false });
  const page = await context.newPage();
  await fakeNativeMessagingPermission(page);
  await page.goto(`chrome-extension://${extensionId}/welcome.html`);

  await expect(page.getByRole('heading', { name: 'Hoş geldiniz', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Neden yardımcı uygulama?' })).toBeVisible();
  await expect(page.getByText('E-posta göndermez.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'GitHub’daki kaynak kodu' })).toHaveAttribute(
    'href',
    'https://github.com/dervisgenc/email-writer',
  );
  await page.screenshot({ path: 'test-results/welcome-1-light.png', fullPage: true, animations: 'disabled' });

  await page.getByRole('button', { name: 'Devam' }).click();
  await expect(page.getByRole('heading', { name: 'Yardımcı uygulamayı kurun' })).toBeVisible();
  // İzin verilmeden tarayıcı yardımcı uygulamaya bağlanmaz; izin bu adımda istenir.
  await page.getByRole('button', { name: 'İzin ver' }).click();
  await expect(page.getByRole('button', { name: 'İzin ver' })).toHaveCount(0);
  await expect(page.getByText('Yardımcı uygulama bekleniyor')).toBeVisible();
  // Tarayıcının çalıştığı sistem önceden seçilir; paketlenmemiş eklentinin kimliği komuta eklenir.
  await expect(page.getByRole('radio', { name: 'Linux' })).toBeChecked();
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

  // Kullanıcı komutu çalıştırınca yardımcı uygulama birkaç saniye içinde bağlı görünür.
  await worker.evaluate(() => {
    (globalThis as unknown as { fakeHost: { installed: boolean } }).fakeHost.installed = true;
  });
  await expect(page.getByText('Yardımcı uygulama bağlandı (sürüm 0.1.0).')).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Devam' }).click();
  await expect(page.getByRole('heading', { name: 'AI bağlantısı' })).toBeVisible();
  await expect(page.locator('.ew-method[data-mode="chatgpt"]')).toContainText('Önerilen');
  await expect(page.locator('.ew-method[data-mode="claude-code"]')).toContainText('Deneysel');
  await expect(page.locator('.ew-ai-settings .ew-status-pill')).toHaveText('Hazır');

  await page.getByRole('button', { name: 'Devam' }).click();
  await page.getByRole('button', { name: 'Örneği düzelt' }).click();
  await expect(page.getByText('Thanks for your message.', { exact: false })).toBeVisible();
  await expect(page.getByText('Her şey çalışıyor.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Outlook’u aç' })).toHaveAttribute(
    'href',
    'https://outlook.office.com/mail/',
  );
  // Son adım geçerli adım olarak kalır; önceki üçü tamamlandı.
  await expect(page.locator('.ew-steps__item[data-state="done"]')).toHaveCount(3);
  await page.screenshot({ path: 'test-results/welcome-4-light.png', fullPage: true, animations: 'disabled' });

  // Koyu tema (Otomatik ayarı sistem tercihini izler) ve telefon genişliği: yatay kaydırma yok.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  for (let step = 0; step < 4; step++) {
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

test('ayarlardaki yardımcı uygulama kartı sürümü gösterir ve güncellemeyi kurar', async ({
  context,
  extensionId,
}) => {
  const worker = context.serviceWorkers()[0]!;
  await installFakeHost(worker, { installed: true });
  const page = await context.newPage();
  await fakeNativeMessagingPermission(page, true);
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

  // Denetim kapatılınca kaydedilir ve güncelleme satırı kalkar.
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
