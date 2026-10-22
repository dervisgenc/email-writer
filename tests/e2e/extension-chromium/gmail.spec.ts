import type { Page } from '@playwright/test';

import { expect, FIXTURE_URL, GMAIL_FIXTURE_URL, test } from './extension-fixture';

/** The toolbar of the inline reply: the one that offers "Yanıt yaz" (Write reply). */
const replyToolbar = (page: Page) =>
  page
    .getByRole('toolbar', { name: 'Writehand' })
    .filter({ has: page.getByRole('button', { name: 'Yanıt yaz', exact: true }) });

/**
 * The extension's flow on the synthetic Gmail page. Passing it does not mean the real Gmail page
 * is verified; the two results are reported separately.
 */

test('Gmail: a button by the conversation and a toolbar on each draft, nothing added to Gmail’s DOM tree', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto(GMAIL_FIXTURE_URL);

  // The conversation button, the inline reply and the compose window.
  await expect(page.locator('writehand-launcher')).toHaveCount(3);
  await expect(page.locator('[role="main"] writehand-launcher')).toHaveCount(0);
  await expect(page.getByRole('toolbar', { name: 'Writehand' })).toHaveCount(2);
});

test('Gmail: "Düzelt" (Revise) changes only the selected words of the reply, keeps the signature, and can be undone', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto(GMAIL_FIXTURE_URL);
  const editor = page.locator('[data-fixture="reply-editor"]');
  const firstLine = editor.locator('div').first();

  await firstLine.evaluate((line) => {
    const text = line.firstChild!;
    const start = text.textContent!.indexOf('toplantı odası');
    const range = document.createRange();
    range.setStart(text, start);
    range.setEnd(text, start + 'toplantı odası'.length);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
  });
  // The toolbars float at the end of the body in no fixed order; the reply's offers "Yanıt yaz".
  await replyToolbar(page).getByRole('button', { name: 'Düzelt' }).click();

  const card = page.getByRole('dialog', { name: 'Düzeltme önerisi' });
  await expect(card.getByLabel('Sonuç', { exact: true })).toHaveValue('Toplantıyı yarın yapabiliriz.');
  await card.getByRole('button', { name: 'Taslağa uygula' }).click();
  await expect(card.getByRole('status')).toContainText('Metin taslağa yerleştirildi');
  await expect(firstLine).toHaveText(
    'Toplantı odası olarak B-204 uygun, Toplantıyı yarın yapabiliriz. rezervasyonunu ben yaparım.',
  );
  await expect(editor.locator('.gmail_signature')).toHaveText('Ayşe Kaya');
  // The quote stays trimmed outside the editor, behind Gmail's toggle.
  await expect(page.locator('[data-fixture="trimmed-toggle"]')).toHaveCount(1);

  await card.getByRole('button', { name: 'Son uygulamayı geri al' }).click();
  await expect(firstLine).toHaveText(
    'Toplantı odası olarak B-204 uygun, toplantı odası rezervasyonunu ben yaparım.',
  );
});

test('Gmail: "Yaz" (Write) in a new message writes the result above the signature', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(GMAIL_FIXTURE_URL);
  const editor = page.locator('[data-fixture="new-editor"]');

  // Only the new message's toolbar offers "Yaz" (Write); the reply's offers "Yanıt yaz".
  await page.getByRole('button', { name: 'Yaz', exact: true }).click();
  const card = page.getByRole('dialog', { name: 'E-posta taslağı' });
  await card.getByRole('textbox').fill('Ekibe perşembe toplantısını öner');
  await card.getByRole('textbox').press('Enter');
  await expect(card.getByLabel('Sonuç', { exact: true })).toHaveValue(
    /Perşembe 14:00 için kısa bir toplantı/,
  );

  await card.getByRole('button', { name: 'Taslağa uygula' }).click();
  await expect(card.getByRole('status')).toContainText('Metin taslağa yerleştirildi');
  await expect(editor).toContainText('Perşembe 14:00 için kısa bir toplantı önermek istiyorum.');
  await expect(editor.locator('.gmail_signature')).toHaveText('Ayşe Kaya');
});

test('Gmail: the conversation button reads the expanded messages and reports the collapsed one', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto(GMAIL_FIXTURE_URL);

  await page.getByRole('button', { name: 'Bu konuşma için yanıt hazırla ve bağlamı incele' }).click();
  const panel = page.getByRole('dialog', { name: 'Yazma yardımcısı' });
  await expect(panel.getByRole('radio', { name: 'Yanıt hazırla' })).toHaveAttribute('aria-checked', 'true');
  await expect(panel.getByText('2/2 mesaj kullanılıyor')).toBeVisible();
  await expect(panel.getByText('1 mesaj kapalı; içerikleri okunmadı.')).toBeVisible();
  // The address in Gmail's sender markup never reaches the panel.
  await expect(panel.getByText('example.com')).toHaveCount(0);
});

test('Gmail: turning Gmail off in the settings removes the buttons from Gmail only', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(GMAIL_FIXTURE_URL);
  await expect(page.locator('writehand-launcher')).toHaveCount(3);

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  const gmailSwitch = options.getByRole('switch', { name: /Gmail üzerinde yazma yardımcısını göster/ });
  const outlookSwitch = options.getByRole('switch', {
    name: /Outlook Web üzerinde yazma yardımcısını göster/,
  });
  await expect(gmailSwitch).toBeChecked();
  await expect(outlookSwitch).toBeChecked();
  await gmailSwitch.uncheck();
  await options.getByRole('button', { name: 'Kaydet' }).click();
  await expect(options.getByText('Ayarlar kaydedildi.')).toBeVisible();

  await expect(page.locator('writehand-launcher')).toHaveCount(0);
  await expect(outlookSwitch).toBeChecked();
});

/** The skin attribute on the extension UI's root inside the first launcher's shadow root. */
const launcherSkin = (page: Page) =>
  page.evaluate(
    () =>
      (
        document
          .querySelector('writehand-launcher')
          ?.shadowRoot?.querySelector('.ew-root') as HTMLElement | null
      )?.dataset.skin ?? null,
  );

const center = (box: { x: number; y: number; width: number; height: number }) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

test('Gmail: the conversation button sits in the subject row before Gmail’s buttons, looks like Gmail, and can be dragged out of the way', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto(GMAIL_FIXTURE_URL);
  const button = page.getByRole('button', { name: 'Bu konuşma için yanıt hazırla ve bağlamı incele' });
  const panel = page.getByRole('dialog', { name: 'Yazma yardımcısı' });
  await expect(button).toBeVisible();

  // Default place: inside the subject row, right before Gmail's print and new-window buttons.
  const row = (await page.locator('[data-fixture="subject-row"]').boundingBox())!;
  const print = (await page.locator('[data-fixture="print-all"]').boundingBox())!;
  const home = (await button.boundingBox())!;
  expect(home.x + home.width).toBeLessThanOrEqual(print.x);
  expect(print.x - (home.x + home.width)).toBeLessThan(24);
  expect(home.y).toBeGreaterThanOrEqual(row.y);
  expect(home.y + home.height).toBeLessThanOrEqual(row.y + row.height);
  expect(await launcherSkin(page)).toBe('material');

  // Dragging moves it and does not open the panel.
  const start = center(home);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x - 300, start.y + 200, { steps: 8 });
  await page.mouse.up();
  await expect(panel).toHaveCount(0);
  const moved = (await button.boundingBox())!;
  expect(Math.abs(moved.x - (home.x - 300))).toBeLessThan(3);
  expect(Math.abs(moved.y - (home.y + 200))).toBeLessThan(3);

  // The place is remembered on this site after a reload.
  await page.reload();
  await expect(button).toBeVisible();
  const reloaded = (await button.boundingBox())!;
  expect(Math.abs(reloaded.x - moved.x)).toBeLessThan(3);
  expect(Math.abs(reloaded.y - moved.y)).toBeLessThan(3);

  // A plain click still opens the panel.
  await button.click();
  await expect(panel).toBeVisible();
  await panel.press('Escape');
  await expect(panel).toHaveCount(0);

  // Dropped close to its default place, it snaps back there.
  const from = center(reloaded);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 290, from.y - 190, { steps: 8 });
  await page.mouse.up();
  // The button settles in the next animation frame.
  await expect
    .poll(async () => {
      const snapped = (await button.boundingBox())!;
      return Math.max(Math.abs(snapped.x - home.x), Math.abs(snapped.y - home.y));
    })
    .toBeLessThan(3);
  // …and stays there after a reload: the moved place was forgotten.
  await page.reload();
  await expect(button).toBeVisible();
  const afterReload = (await button.boundingBox())!;
  expect(Math.abs(afterReload.x - home.x)).toBeLessThan(3);
});

test('Outlook keeps its Fluent look', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(FIXTURE_URL);
  await expect(page.locator('writehand-launcher').first()).toBeAttached();
  await expect.poll(() => launcherSkin(page)).toBe('fluent');
});
