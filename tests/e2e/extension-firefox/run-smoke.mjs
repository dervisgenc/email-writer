// Firefox duman testi (WebDriver BiDi). Playwright'ın eklenti desteği Chromium
// ile sınırlı olduğu için Firefox paketi gerçek Firefox'ta ayrıca denenir.
// Başsız Firefox açılır, test derlemesi geçici eklenti olarak yüklenir ve
// sentetik Outlook örnek sayfasında seç → Düzelt → örnek sonuç → taslağa uygula
// akışı denenir. Bu test gerçek Outlook sayfasının doğrulandığı anlamına gelmez.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { connectBidi } from '../../support/firefox/bidi-client.mjs';
import { firefoxVersion, launchFirefox } from '../../support/firefox/firefox-process.mjs';

const root = resolve(import.meta.dirname, '../../..');
const extensionPath = resolve(root, 'apps/browser-extension/.output/firefox-mv3-test');
const fixtureUrl = 'http://127.0.0.1:4517/mail/inbox';
const bidiPort = Number(process.env.FIREFOX_BIDI_PORT ?? 9333);

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function waitFor(check, label, timeoutMs = 10_000) {
  const started = Date.now();
  for (;;) {
    const value = await check();
    if (value) {
      return value;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Zaman aşımı: ${label}`);
    }
    await sleep(200);
  }
}

async function isServing() {
  try {
    return (await fetch(fixtureUrl)).ok;
  } catch {
    return false;
  }
}

const steps = [];
function record(name, ok, detail = '') {
  steps.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

let server;
let firefox;
let bidi;
const profile = mkdtempSync(join(tmpdir(), 'email-writer-firefox-'));
// Arayüz dili varsayılan olarak tarayıcı dilini izler; duman testi Türkçe metinleri doğrular.
writeFileSync(join(profile, 'user.js'), 'user_pref("intl.accept_languages", "tr-TR, tr");\n');

try {
  if (!(await isServing())) {
    server = spawn(process.execPath, [resolve(root, 'scripts/serve-fixtures.mjs')], { stdio: 'ignore' });
    await waitFor(isServing, 'örnek sayfa sunucusu');
  }

  firefox = await launchFirefox({ profile, port: bidiPort, headless: true });
  console.log(`Tarayıcı: ${firefoxVersion(firefox.firefox)}`);

  bidi = await waitFor(() => connectBidi(bidiPort).catch(() => null), 'WebDriver BiDi bağlantısı', 20_000);

  await bidi.send('session.new', { capabilities: {} });
  const installed = await bidi.send('webExtension.install', {
    extensionData: { type: 'path', path: extensionPath },
  });
  record(
    'Firefox MV3 test paketi geçici eklenti olarak yüklendi',
    Boolean(installed.extension),
    installed.extension,
  );

  const tree = await bidi.send('browsingContext.getTree', {});
  const context = tree.contexts[0].context;
  await bidi.send('browsingContext.navigate', { context, url: fixtureUrl, wait: 'complete' });

  const evaluate = async (expression) => {
    const result = await bidi.send('script.evaluate', {
      expression,
      target: { context },
      awaitPromise: true,
    });
    if (result.type === 'exception') {
      throw new Error(result.exceptionDetails.text);
    }
    return result.result.value;
  };

  const launchers = await waitFor(async () => {
    const count = await evaluate(`document.querySelectorAll('email-writer-launcher').length`);
    return count >= 2 ? count : 0;
  }, 'başlatıcı düğmeler').catch(() => 0);
  record(
    'Content script çalıştı; konuşma ve taslak başlatıcıları eklendi',
    launchers === 2,
    `${launchers} başlatıcı`,
  );

  await evaluate(`(() => {
    const line = document.querySelector('[data-fixture="reply-editor"] div');
    const text = line.firstChild;
    const start = text.textContent.indexOf('toplantı odası');
    const range = document.createRange();
    range.setStart(text, start);
    range.setEnd(text, start + 'toplantı odası'.length);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    const host = [...document.querySelectorAll('email-writer-launcher')]
      .find((element) => element.shadowRoot?.querySelector('.ew-compose-bar'));
    [...host.shadowRoot.querySelectorAll('.ew-compose-bar button')]
      .find((button) => button.textContent.trim() === 'Düzelt')
      .click();
    return true;
  })()`);

  // "Düzelt" işlemi doğrudan yapar; sonuç taslağın yanındaki kartta görünür.
  const cardQuery = `[...document.querySelectorAll('email-writer-launcher')].map((host) => host.shadowRoot?.querySelector('.ew-card')).find(Boolean)`;
  const preview = await waitFor(
    () => evaluate(`${cardQuery}?.querySelector('.ew-rich-preview__source')?.value ?? ''`),
    'sonuç kartı',
  ).catch(() => '');
  record(
    'Taslaktaki "Düzelt" düğmesi seçimi işledi; etiketli örnek sonuç kartta göründü',
    preview === 'Toplantıyı yarın yapabiliriz.',
    JSON.stringify(preview),
  );

  await evaluate(
    `[...${cardQuery}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Taslağa uygula').click()`,
  );
  const applied = await waitFor(async () => {
    const text = await evaluate(`document.querySelector('[data-fixture="reply-editor"] div').textContent`);
    return text.includes('Toplantıyı yarın yapabiliriz.') ? text : '';
  }, 'taslağa yazma').catch(() => '');
  const signature = await evaluate(
    `document.getElementById('Signature').textContent.includes('Deneme Kullanıcı')`,
  );
  record(
    'Sonuç yalnızca seçili bölüme yazıldı; imza korundu',
    applied === 'Toplantı yarın olsun mu, Toplantıyı yarın yapabiliriz. hazır.' && signature,
    JSON.stringify(applied),
  );

  // Biçimli içerik: taslağın tamamı düzeltilir, sonuç "Tablo yap" ile tabloya çevrilip yazılır.
  await bidi.send('browsingContext.navigate', { context, url: fixtureUrl, wait: 'complete' });
  await waitFor(async () => {
    const count = await evaluate(`document.querySelectorAll('email-writer-launcher').length`);
    return count >= 2 ? count : 0;
  }, 'başlatıcı düğmeler');
  const clickIn = (selector, label) =>
    evaluate(`(() => {
      const roots = [...document.querySelectorAll('email-writer-launcher')].map((host) => host.shadowRoot).filter(Boolean);
      const button = roots.flatMap((root) => [...root.querySelectorAll('${selector} button')])
        .find((element) => element.textContent.trim() === ${JSON.stringify(label)});
      button?.click();
      return Boolean(button);
    })()`);
  await evaluate(`getSelection().removeAllRanges(), true`);
  await clickIn('.ew-compose-bar', 'Düzelt');
  await waitFor(
    () => evaluate(`${cardQuery}?.querySelector('.ew-rich-preview__source')?.value ?? ''`),
    'düzeltme sonucu',
  );
  await clickIn('.ew-card', 'Tablo yap');
  const previewTable = await waitFor(
    () => evaluate(`${cardQuery}?.querySelector('.ew-rich-preview__paper table td')?.textContent ?? ''`),
    'tablo önizlemesi',
  ).catch(() => '');
  await clickIn('.ew-card', 'Taslağa uygula');
  const written = await waitFor(
    () => evaluate(`document.querySelector('[data-fixture="reply-editor"] table td')?.textContent ?? ''`),
    'tablonun taslağa yazılması',
  ).catch(() => '');
  const signatureFirstLine = await evaluate(`document.querySelector('#Signature > div')?.textContent ?? ''`);
  const outcome = await waitFor(
    () =>
      evaluate(
        `[...(${cardQuery}?.querySelectorAll('[role=status], [role=alert]') ?? [])].map((node) => node.textContent.trim()).join(' / ')`,
      ),
    'yazma sonucu',
  ).catch(() => '');
  record(
    'Biçimli sonuç tablo olarak önizlendi ve taslağa tablo olarak yazıldı; imza bozulmadı',
    previewTable === 'Lisans' &&
      written === 'Lisans' &&
      signatureFirstLine === '--' &&
      outcome.includes('yerleştirildi'),
    JSON.stringify({ previewTable, written, signatureFirstLine, outcome }),
  );
} catch (error) {
  record('Duman testi tamamlanamadı', false, error instanceof Error ? error.message : String(error));
} finally {
  try {
    await bidi?.send('session.end', {});
  } catch {
    // Oturum zaten kapanmış olabilir.
  }
  bidi?.close();
  firefox?.stop();
  server?.kill('SIGTERM');
  await sleep(300);
  // Windows'ta kapanan Firefox'un alt süreçleri profil dosyalarını kısa bir süre daha tutabilir.
  rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}

const failed = steps.filter((step) => !step.ok);
console.log(
  failed.length === 0
    ? '\nFirefox duman testi geçti.'
    : `\nFirefox duman testinde ${failed.length} adım başarısız.`,
);
process.exit(failed.length === 0 ? 0 : 1);
