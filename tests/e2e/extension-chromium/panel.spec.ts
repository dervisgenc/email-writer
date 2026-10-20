import { expect, FIXTURE_URL, test } from './extension-fixture';

/**
 * The extension's full flow on the synthetic Outlook fixture page. Passing it
 * does not mean the real Outlook page is verified; the two results are reported separately.
 */

test('the background runs as a service worker and the settings page opens', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  await expect(page.getByRole('heading', { name: 'Writehand ayarları' })).toBeVisible();
  // The default translation language is shown by name; the stored value is the code (`en`).
  await expect(page.getByLabel('Varsayılan çeviri dili')).toHaveValue('İngilizce');
});

test('launchers are added once, only to recognized areas, and the page does not change by itself', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto(FIXTURE_URL);

  await expect(page.locator('writehand-launcher')).toHaveCount(2);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // The extension adds no buttons to Outlook's DOM tree; the launchers sit at the end of the body.
  await expect(page.locator('#ReadingPaneContainerId writehand-launcher')).toHaveCount(0);
});

test('the draft "Düzelt" (Revise) button processes the selected text directly; the card result applies only to that selection and can be undone', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto(FIXTURE_URL);
  const editor = page.locator('[data-fixture="reply-editor"]');
  const firstLine = editor.locator('div').first();

  // The user selects the phrase "toplantı odası" in the draft.
  await firstLine.evaluate((line) => {
    const text = line.firstChild!;
    const start = text.textContent!.indexOf('toplantı odası');
    const range = document.createRange();
    range.setStart(text, start);
    range.setEnd(text, start + 'toplantı odası'.length);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
  });
  const toolbar = page.getByRole('toolbar', { name: 'Writehand' });
  await toolbar.getByRole('button', { name: 'Düzelt' }).click();

  // The panel does not open; the result appears in the card next to the draft.
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

  // "Panelde aç" (Open in panel) continues the same work in the side panel.
  await card.getByRole('button', { name: 'Panelde aç' }).click();
  const panel = page.getByRole('dialog', { name: 'Yazma yardımcısı' });
  await expect(panel.getByLabel('Metin', { exact: true })).toHaveValue('toplantı odası');
  await expect(card).toHaveCount(0);
});

test('the conversation button opens in reply mode, reads the expanded messages of the clicked conversation and explains the coverage', async ({
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
  // The active message cannot be determined reliably, so the user is asked to pick it.
  await expect(panel.getByText('Yanıt verilecek mesajı seçin')).toBeVisible();

  await panel.getByRole('radio', { name: 'Bu mesaja yanıt ver' }).last().check();
  await panel.getByLabel('Yanıt talimatı').fill('Perşembe uygun, faturayı sonra konuşalım de.');
  await panel.locator('.ew-prepare').getByRole('button', { name: 'Yanıt hazırla' }).click();
  await expect(panel.getByLabel('Sonuç', { exact: true })).toHaveValue(/Mesajınız için teşekkürler/);

  // Escape closes the panel; reopening it on the same page keeps the entered instruction.
  await panel.press('Escape');
  await expect(panel).toHaveCount(0);
  await threadLauncher.click();
  await expect(page.getByRole('dialog').getByLabel('Yanıt talimatı')).toHaveValue(
    'Perşembe uygun, faturayı sonra konuşalım de.',
  );
});

test('typing in the panel leaks no keyboard events to Outlook shortcuts', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(FIXTURE_URL);
  await page.evaluate(() => {
    (window as unknown as { keys: string[] }).keys = [];
    document.addEventListener('keydown', (event) =>
      (window as unknown as { keys: string[] }).keys.push(event.key),
    );
  });

  const toolbar = page.getByRole('toolbar', { name: 'Writehand' });
  await toolbar.getByRole('button', { name: 'Yazma yardımcısını panelde aç' }).click();
  await page
    .getByRole('dialog', { name: 'Yazma yardımcısı' })
    .getByLabel('Metin', { exact: true })
    .pressSequentially('rn');
  await page.getByRole('dialog', { name: 'Yazma yardımcısı' }).press('Escape');

  // The instruction field in the draft card does not trigger Outlook shortcuts either.
  await toolbar.getByRole('button', { name: 'Yanıt yaz' }).click();
  await page.getByRole('dialog', { name: 'Yanıt taslağı' }).getByRole('textbox').pressSequentially('rn');

  expect(await page.evaluate(() => (window as unknown as { keys: string[] }).keys)).toEqual([]);
});

test('"Yanıt yaz" (Write reply) card: when the replied-to message is ambiguous it is picked in the panel, the instruction is kept and the reply is prepared', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto(FIXTURE_URL);

  await page.getByRole('toolbar', { name: 'Writehand' }).getByRole('button', { name: 'Yanıt yaz' }).click();
  const card = page.getByRole('dialog', { name: 'Yanıt taslağı' });
  await expect(card.getByRole('button', { name: /Bağlam · \d+ mesaj/ })).toBeVisible();
  // The fixture page has two expanded messages; the extension does not guess which one is being replied to.
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

test('"Tablo yap" (Make a table) shows the result formatted and writes a real table to the draft, keeping the signature and quote, and can be undone', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto(FIXTURE_URL);
  const editor = page.locator('[data-fixture="reply-editor"]');
  // No selection: the whole user-written part of the draft is processed.
  await page.evaluate(() => document.getSelection()?.removeAllRanges());
  await page.getByRole('toolbar', { name: 'Writehand' }).getByRole('button', { name: 'Düzelt' }).click();

  const card = page.getByRole('dialog', { name: 'Düzeltme önerisi' });
  await expect(card.getByLabel('Sonuç', { exact: true })).toHaveValue('Toplantıyı yarın yapabiliriz.');
  await card.getByRole('button', { name: 'Tablo yap' }).click();

  // The formatted result is previewed as it will appear in the email.
  const paper = card.getByRole('document', { name: 'Sonuç' });
  await expect(paper.locator('table td').first()).toHaveText('Lisans');
  await expect(paper.locator('table th').nth(1)).toHaveText('Tutar');

  await card.getByRole('button', { name: 'Taslağa uygula' }).click();
  await expect(card.getByRole('status')).toContainText('Metin taslağa yerleştirildi');
  await expect(editor.locator('table td').first()).toHaveText('Lisans');
  await expect(editor.locator('table td').nth(1)).toHaveText('40.000 TL');
  // The last line ("Saygılarımla") does not merge with the first line of the signature.
  await expect(page.locator('#Signature > div').first()).toHaveText('--');
  await expect(page.locator('#Signature')).toContainText('Deneme Kullanıcı');
  await expect(page.locator('#divRplyFwdMsg')).toContainText('Ayşe Kaya');

  await card.getByRole('button', { name: 'Son uygulamayı geri al' }).click();
  await expect(editor.locator('table')).toHaveCount(0);
  await expect(editor).toContainText('toplantı odası hazır');
  await expect(page.locator('#Signature')).toContainText('Deneme Kullanıcı');
});

test('when multi-line plain text replaces the whole draft, the last line does not run into the signature', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto(FIXTURE_URL);
  const editor = page.locator('[data-fixture="reply-editor"]');
  await page.evaluate(() => document.getSelection()?.removeAllRanges());
  await page.getByRole('toolbar', { name: 'Writehand' }).getByRole('button', { name: 'Düzelt' }).click();

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
