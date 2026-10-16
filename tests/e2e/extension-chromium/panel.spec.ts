import { expect, FIXTURE_URL, test } from './extension-fixture';

/**
 * Sentetik Outlook örnek sayfasında eklentinin bütün akışı. Bu test gerçek
 * Outlook sayfasının doğrulandığı anlamına gelmez; iki sonuç ayrı raporlanır.
 */

test('arka plan service worker olarak çalışır ve ayarlar ekranı açılır', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  await expect(page.getByRole('heading', { name: 'Email Writer ayarları' })).toBeVisible();
  // Varsayılan çeviri dili adıyla gösterilir; kayıtta kod (`en`) tutulur.
  await expect(page.getByLabel('Varsayılan çeviri dili')).toHaveValue('İngilizce');
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

test('taslaktaki "Düzelt" düğmesi seçili metni doğrudan işler; sonuç kartta yalnızca o seçime uygulanır ve geri alınır', async ({
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
  const toolbar = page.getByRole('toolbar', { name: 'Email Writer' });
  await toolbar.getByRole('button', { name: 'Düzelt' }).click();

  // Panel açılmaz; sonuç taslağın yanındaki kartta görünür.
  const card = page.getByRole('dialog', { name: 'Düzeltme önerisi' });
  await expect(card).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Yazma yardımcısı' })).toHaveCount(0);
  await expect(card.getByLabel('Örnek sonuç — geliştirme modu')).toBeVisible();
  await expect(card.getByLabel('Sonuç', { exact: true })).toHaveValue('Toplantıyı yarın yapabiliriz.');

  await card.getByRole('button', { name: 'Taslağa uygula' }).click();
  await expect(card.getByRole('status')).toContainText('Metin taslağa yerleştirildi');
  await expect(firstLine).toHaveText('Toplantı yarın olsun mu, Toplantıyı yarın yapabiliriz. hazır.');
  await expect(page.locator('#Signature')).toContainText('Deneme Kullanıcı');
  await expect(page.locator('#divRplyFwdMsg')).toContainText('Ayşe Kaya');

  await card.getByRole('button', { name: 'Son uygulamayı geri al' }).click();
  await expect(firstLine).toHaveText('Toplantı yarın olsun mu, toplantı odası hazır.');

  // "Panelde aç" aynı çalışmayı sağdaki panelde sürdürür.
  await card.getByRole('button', { name: 'Panelde aç' }).click();
  const panel = page.getByRole('dialog', { name: 'Yazma yardımcısı' });
  await expect(panel.getByLabel('Metin', { exact: true })).toHaveValue('toplantı odası');
  await expect(card).toHaveCount(0);
});

test('konuşma düğmesi yanıt modunda açılır, tıklanan konuşmanın açık mesajlarını okur ve kapsamı açıklar', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto(FIXTURE_URL);

  const threadLauncher = page.getByRole('button', {
    name: 'Bu konuşma için yanıt hazırla ve bağlamı incele',
  });
  await threadLauncher.click();

  const panel = page.getByRole('dialog', { name: 'Yazma yardımcısı' });
  await expect(panel.getByRole('radio', { name: 'Yanıt hazırla' })).toHaveAttribute('aria-checked', 'true');
  await expect(panel.getByText('2/2 mesaj kullanılıyor')).toBeVisible();
  await expect(panel.getByText('1 mesaj kapalı; içerikleri okunmadı.')).toBeVisible();
  await expect(panel.getByText('mesajların tamamına erişildiği doğrulanamıyor')).toBeVisible();
  // Aktif mesaj güvenle belirlenemediği için kullanıcıdan seçmesi istenir.
  await expect(panel.getByText('Yanıt verilecek mesajı seçin')).toBeVisible();

  await panel.getByRole('radio', { name: 'Bu mesaja yanıt ver' }).last().check();
  await panel.getByLabel('Yanıt talimatı').fill('Perşembe uygun, faturayı sonra konuşalım de.');
  await panel.locator('.ew-prepare').getByRole('button', { name: 'Yanıt hazırla' }).click();
  await expect(panel.getByLabel('Sonuç', { exact: true })).toHaveValue(/Mesajınız için teşekkürler/);

  // Escape paneli kapatır; aynı sayfada yeniden açınca girilen talimat korunur.
  await panel.press('Escape');
  await expect(panel).toHaveCount(0);
  await threadLauncher.click();
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

  const toolbar = page.getByRole('toolbar', { name: 'Email Writer' });
  await toolbar.getByRole('button', { name: 'Yazma yardımcısını panelde aç' }).click();
  await page
    .getByRole('dialog', { name: 'Yazma yardımcısı' })
    .getByLabel('Metin', { exact: true })
    .pressSequentially('rn');
  await page.getByRole('dialog', { name: 'Yazma yardımcısı' }).press('Escape');

  // Taslak kartındaki talimat alanı da Outlook kısayollarını tetiklemez.
  await toolbar.getByRole('button', { name: 'Yanıt yaz' }).click();
  await page.getByRole('dialog', { name: 'Yanıt taslağı' }).getByRole('textbox').pressSequentially('rn');

  expect(await page.evaluate(() => (window as unknown as { keys: string[] }).keys)).toEqual([]);
});

test('"Yanıt yaz" kartı: yanıtlanan mesaj belirsizse panelde seçtirir, talimat korunur ve yanıt hazırlanır', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto(FIXTURE_URL);

  await page
    .getByRole('toolbar', { name: 'Email Writer' })
    .getByRole('button', { name: 'Yanıt yaz' })
    .click();
  const card = page.getByRole('dialog', { name: 'Yanıt taslağı' });
  await expect(card.getByRole('button', { name: /Bağlam · \d+ mesaj/ })).toBeVisible();
  // Örnek sayfada iki açık mesaj var; hangisinin yanıtlandığı tahmin edilmez.
  const warning = card.locator('.ew-alert--warning');
  await expect(warning).toContainText('Yanıt verilecek mesajı seçin');
  await card.getByRole('textbox').fill('Perşembe uygun de');
  await card.getByRole('textbox').press('Enter');
  await card.getByRole('alert').getByRole('button', { name: 'Panelde aç' }).click();

  const panel = page.getByRole('dialog', { name: 'Yazma yardımcısı' });
  await expect(panel.getByLabel('Yanıt talimatı')).toHaveValue('Perşembe uygun de');
  await panel.getByRole('radio', { name: 'Bu mesaja yanıt ver' }).last().check();
  await panel.locator('.ew-prepare').getByRole('button', { name: 'Yanıt hazırla' }).click();
  await expect(panel.getByLabel('Sonuç', { exact: true })).toHaveValue(/Mesajınız için teşekkürler/);
});

test('"Tablo yap" sonucu biçimli gösterir ve taslağa gerçek tablo olarak yazar; imza ve alıntı korunur, geri alınabilir', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto(FIXTURE_URL);
  const editor = page.locator('[data-fixture="reply-editor"]');
  // Seçim yok: taslağın kullanıcının yazdığı bölümü bütünüyle işlenir.
  await page.evaluate(() => document.getSelection()?.removeAllRanges());
  await page.getByRole('toolbar', { name: 'Email Writer' }).getByRole('button', { name: 'Düzelt' }).click();

  const card = page.getByRole('dialog', { name: 'Düzeltme önerisi' });
  await expect(card.getByLabel('Sonuç', { exact: true })).toHaveValue('Toplantıyı yarın yapabiliriz.');
  await card.getByRole('button', { name: 'Tablo yap' }).click();

  // Biçimli sonuç e-postada görüneceği gibi önizlenir.
  const paper = card.getByRole('document', { name: 'Sonuç' });
  await expect(paper.locator('table td').first()).toHaveText('Lisans');
  await expect(paper.locator('table th').nth(1)).toHaveText('Tutar');

  await card.getByRole('button', { name: 'Taslağa uygula' }).click();
  await expect(card.getByRole('status')).toContainText('Metin taslağa yerleştirildi');
  await expect(editor.locator('table td').first()).toHaveText('Lisans');
  await expect(editor.locator('table td').nth(1)).toHaveText('40.000 TL');
  // Son satır ("Saygılarımla") imzanın ilk satırıyla birleşmez.
  await expect(page.locator('#Signature > div').first()).toHaveText('--');
  await expect(page.locator('#Signature')).toContainText('Deneme Kullanıcı');
  await expect(page.locator('#divRplyFwdMsg')).toContainText('Ayşe Kaya');

  await card.getByRole('button', { name: 'Son uygulamayı geri al' }).click();
  await expect(editor.locator('table')).toHaveCount(0);
  await expect(editor).toContainText('toplantı odası hazır');
  await expect(page.locator('#Signature')).toContainText('Deneme Kullanıcı');
});

test('çok satırlı düz metin taslağın tamamına yazılırken son satır imzaya karışmaz', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(FIXTURE_URL);
  const editor = page.locator('[data-fixture="reply-editor"]');
  await page.evaluate(() => document.getSelection()?.removeAllRanges());
  await page.getByRole('toolbar', { name: 'Email Writer' }).getByRole('button', { name: 'Düzelt' }).click();

  const card = page.getByRole('dialog', { name: 'Düzeltme önerisi' });
  const result = card.getByLabel('Sonuç', { exact: true });
  await expect(result).toHaveValue('Toplantıyı yarın yapabiliriz.');
  await result.fill('Birinci satır.\n\nİkinci paragraf.\nSaygılarımla');
  await card.getByRole('button', { name: 'Taslağa uygula' }).click();

  await expect(card.getByRole('status')).toContainText('Metin taslağa yerleştirildi');
  await expect(editor).toContainText('Saygılarımla');
  await expect(page.locator('#Signature > div').first()).toHaveText('--');
  await expect(editor.getByText('Saygılarımla--')).toHaveCount(0);
});
