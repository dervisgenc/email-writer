// Firefox duman testi (WebDriver BiDi). Playwright'ın eklenti desteği Chromium
// ile sınırlı olduğu için Firefox paketi gerçek Firefox'ta ayrıca denenir.
// Başsız Firefox açılır, test derlemesi geçici eklenti olarak yüklenir ve
// sentetik Outlook örnek sayfasında seç → Düzelt → örnek sonuç → taslağa uygula
// akışı denenir. Bu test gerçek Outlook sayfasının doğrulandığı anlamına gelmez.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const extensionPath = resolve(root, 'apps/browser-extension/.output/firefox-mv3-test');
const firefoxBinary = process.env.FIREFOX_BIN ?? 'firefox';
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

function connect(url) {
  const socket = new WebSocket(url);
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    const waiter = pending.get(message.id);
    if (waiter !== undefined) {
      pending.delete(message.id);
      if (message.type === 'error') {
        waiter.reject(new Error(`${message.error}: ${message.message}`));
      } else {
        waiter.resolve(message.result);
      }
    }
  });
  const opened = new Promise((done, fail) => {
    socket.addEventListener('open', done, { once: true });
    socket.addEventListener('error', fail, { once: true });
  });
  return {
    opened,
    send(method, params = {}) {
      nextId += 1;
      const id = nextId;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolveResult, reject) => pending.set(id, { resolve: resolveResult, reject }));
    },
    close: () => socket.close(),
  };
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

try {
  if (!(await isServing())) {
    server = spawn(process.execPath, [resolve(root, 'scripts/serve-fixtures.mjs')], { stdio: 'ignore' });
    await waitFor(isServing, 'örnek sayfa sunucusu');
  }

  firefox = spawn(
    firefoxBinary,
    ['--headless', '--no-remote', '--profile', profile, `--remote-debugging-port=${bidiPort}`],
    {
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  );
  const version = await new Promise((done) => {
    const probe = spawn(firefoxBinary, ['--version']);
    let out = '';
    probe.stdout.on('data', (chunk) => (out += chunk));
    probe.on('close', () => done(out.trim()));
  });
  console.log(`Tarayıcı: ${version}`);

  await waitFor(
    async () => {
      try {
        bidi = connect(`ws://127.0.0.1:${bidiPort}/session`);
        await bidi.opened;
        return true;
      } catch {
        return false;
      }
    },
    'WebDriver BiDi bağlantısı',
    20_000,
  );

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
      .find((element) => element.shadowRoot?.querySelector('.ew-launcher__quick'));
    host.shadowRoot.querySelector('.ew-launcher__quick').click();
    return true;
  })()`);

  const panelQuery = `document.querySelector('email-writer-panel')?.shadowRoot`;
  const source = await waitFor(
    () => evaluate(`${panelQuery}?.querySelector('[role="dialog"] textarea')?.value ?? ''`),
    'panel ve kaynak metin',
  ).catch(() => '');
  record(
    'Panel açıldı; taslaktaki seçim kaynak olarak alındı',
    source === 'toplantı odası',
    JSON.stringify(source),
  );

  await evaluate(`${panelQuery}.querySelector('.ew-prepare button').click()`);
  const preview = await waitFor(
    () => evaluate(`${panelQuery}.querySelectorAll('textarea')[1]?.value ?? ''`),
    'örnek sonuç',
  ).catch(() => '');
  record(
    'Etiketli örnek sonuç önizlemeye geldi',
    preview === 'Toplantıyı yarın yapabiliriz.',
    JSON.stringify(preview),
  );

  await evaluate(
    `[...${panelQuery}.querySelectorAll('.ew-apply__buttons button')].find((b) => b.textContent.trim() === 'Taslağa uygula').click()`,
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
} catch (error) {
  record('Duman testi tamamlanamadı', false, error instanceof Error ? error.message : String(error));
} finally {
  try {
    await bidi?.send('session.end', {});
  } catch {
    // Oturum zaten kapanmış olabilir.
  }
  bidi?.close();
  firefox?.kill('SIGTERM');
  server?.kill('SIGTERM');
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}

const failed = steps.filter((step) => !step.ok);
console.log(
  failed.length === 0
    ? '\nFirefox duman testi geçti.'
    : `\nFirefox duman testinde ${failed.length} adım başarısız.`,
);
process.exit(failed.length === 0 ? 0 : 1);
