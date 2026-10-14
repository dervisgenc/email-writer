import { expect, FIXTURE_URL, test } from './extension-fixture';

/**
 * Sentetik Outlook örnek sayfasında eklentinin bütün akışı. Bu test gerçek
 * Outlook sayfasının doğrulandığı anlamına gelmez; iki sonuç ayrı raporlanır.
 */

test('arka plan service worker olarak çalışır ve ayarlar ekranı açılır', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  await expect(page.getByRole('heading', { name: 'Email Writer ayarları' })).toBeVisible();
  await expect(page.getByLabel('Varsayılan hedef dil')).toHaveValue('en');
});

test('başlatıcılar yalnızca tanınan bölgelere bir kez eklenir; sayfa kendiliğinden değişmez', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto(FIXTURE_URL);

  await expect(page.locator('email-writer-launcher')).toHaveCount(2);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Eklenti Outlook'un DOM ağacına düğme eklemez; başlatıcılar gövdenin sonundadır.
  await expect(page.locator('#ReadingPaneContainerId email-writer-launcher')).toHaveCount(0);
});

test('taslakta seçili metni "Düzelt" ile işler, örnek sonucu yalnızca o seçime uygular ve geri alır', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto(FIXTURE_URL);
  const editor = page.locator('[data-fixture="reply-editor"]');
  const firstLine = editor.locator('div').first();

  // Kullanıcı taslakta "toplantı odası" ifadesini seçer.
  await firstLine.evaluate((line) => {
    const text = line.firstChild!;
    const start = text.textContent!.indexOf('toplantı odası');
    const range = document.createRange();
    range.setStart(text, start);
    range.setEnd(text, start + 'toplantı odası'.length);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
  });
  await page.locator('email-writer-launcher').getByRole('button', { name: 'Düzelt' }).click();

  const panel = page.getByRole('dialog', { name: 'Yazma yardımcısı' });
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel('Metin', { exact: true })).toHaveValue('toplantı odası');
  await expect(panel.getByText('Seçili metin', { exact: false }).first()).toBeVisible();

  await panel.locator('.ew-prepare').getByRole('button', { name: 'Düzelt' }).click();
  await expect(panel.getByText('Örnek sonuç — geliştirme modu')).toBeVisible();
  await expect(panel.getByLabel('Sonuç')).toHaveValue('Toplantıyı yarın yapabiliriz.');

  await panel.getByRole('button', { name: 'Taslağa uygula' }).click();
  await expect(panel.getByRole('status')).toContainText('Metin taslağa yerleştirildi');
  await expect(firstLine).toHaveText('Toplantı yarın olsun mu, Toplantıyı yarın yapabiliriz. hazır.');
  await expect(page.locator('#Signature')).toContainText('Deneme Kullanıcı');
  await expect(page.locator('#divRplyFwdMsg')).toContainText('Ayşe Kaya');

  await panel.getByRole('button', { name: 'Son uygulamayı geri al' }).click();
  await expect(firstLine).toHaveText('Toplantı yarın olsun mu, toplantı odası hazır.');
});

test('konuşma düğmesi yanıt modunda açılır, tıklanan konuşmanın açık mesajlarını okur ve kapsamı açıklar', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto(FIXTURE_URL);

  // İlk başlatıcı konuşma bölmesine aittir (hızlı işlem düğmesi yoktur).
  const threadLauncher = page
    .locator('email-writer-launcher')
    .filter({ hasNot: page.getByRole('button', { name: 'Düzelt' }) });
  await threadLauncher.getByRole('button', { name: 'Yazma yardımcısını aç' }).click();

  const panel = page.getByRole('dialog', { name: 'Yazma yardımcısı' });
  await expect(panel.getByRole('radio', { name: 'Yanıt hazırla' })).toHaveAttribute('aria-checked', 'true');
  await expect(panel.getByText('Bağlamda 2 mesaj var.')).toBeVisible();
  await expect(panel.getByText('1 mesaj kapalı; içerikleri okunmadı.')).toBeVisible();
  await expect(panel.getByText('mesajların tamamına erişildiği doğrulanamıyor')).toBeVisible();
  // Aktif mesaj güvenle belirlenemediği için kullanıcıdan seçmesi istenir.
  await expect(panel.getByText('Yanıt verilecek mesajı seçin')).toBeVisible();

  await panel.getByRole('radio', { name: 'Bu mesaja yanıt ver' }).last().check();
  await panel.getByLabel('Yanıt talimatı').fill('Perşembe uygun, faturayı sonra konuşalım de.');
  await panel.locator('.ew-prepare').getByRole('button', { name: 'Yanıt hazırla' }).click();
  await expect(panel.getByLabel('Sonuç')).toHaveValue(/Mesajınız için teşekkürler/);

  // Escape paneli kapatır; aynı sayfada yeniden açınca girilen talimat korunur.
  await panel.press('Escape');
  await expect(panel).toHaveCount(0);
  await threadLauncher.getByRole('button', { name: 'Yazma yardımcısını aç' }).click();
  await expect(page.getByRole('dialog').getByLabel('Yanıt talimatı')).toHaveValue(
    'Perşembe uygun, faturayı sonra konuşalım de.',
  );
});

test('panelde yazarken Outlook kısayollarına klavye olayı sızmaz', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(FIXTURE_URL);
  await page.evaluate(() => {
    (window as unknown as { keys: string[] }).keys = [];
    document.addEventListener('keydown', (event) =>
      (window as unknown as { keys: string[] }).keys.push(event.key),
    );
  });

  await page.locator('email-writer-launcher').getByRole('button', { name: 'Çevir' }).click();
  await page.getByRole('dialog').getByLabel('Metin', { exact: true }).pressSequentially('rn');

  expect(await page.evaluate(() => (window as unknown as { keys: string[] }).keys)).toEqual([]);
});
