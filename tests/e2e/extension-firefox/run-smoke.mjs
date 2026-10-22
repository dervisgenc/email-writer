// Firefox smoke test (WebDriver BiDi). Playwright's extension support is limited
// to Chromium, so the Firefox package is tried separately in a real Firefox.
// A headless Firefox starts, the test build is loaded as a temporary add-on, and
// the select → Revise → sample result → apply to draft flow is tried on the
// synthetic Outlook and Gmail fixture pages. Passing it does not mean the real Outlook or
// Gmail page is verified.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { connectBidi } from '../../support/firefox/bidi-client.mjs';
import { firefoxVersion, launchFirefox } from '../../support/firefox/firefox-process.mjs';

const root = resolve(import.meta.dirname, '../../..');
const extensionPath = resolve(root, 'apps/browser-extension/.output/firefox-mv3-test');
const fixtureUrl = 'http://127.0.0.1:4517/mail/inbox';
const gmailFixtureUrl = 'http://127.0.0.1:4517/gmail/mail/u/0/#inbox/FMfcgzQXJWDsKmBvTkRbHnPLvXqZcwTt';
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
      throw new Error(`Timed out: ${label}`);
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
const profile = mkdtempSync(join(tmpdir(), 'writehand-firefox-'));
// The UI language follows the browser language by default; the smoke test asserts the Turkish texts.
writeFileSync(join(profile, 'user.js'), 'user_pref("intl.accept_languages", "tr-TR, tr");\n');

try {
  if (!(await isServing())) {
    server = spawn(process.execPath, [resolve(root, 'scripts/serve-fixtures.mjs')], { stdio: 'ignore' });
    await waitFor(isServing, 'fixture page server');
  }

  firefox = await launchFirefox({ profile, port: bidiPort, headless: true, systemAccess: true });
  console.log(`Browser: ${firefoxVersion(firefox.firefox)}`);

  bidi = await waitFor(() => connectBidi(bidiPort).catch(() => null), 'WebDriver BiDi connection', 20_000);

  await bidi.send('session.new', { capabilities: {} });
  const installed = await bidi.send('webExtension.install', {
    extensionData: { type: 'path', path: extensionPath },
  });
  record(
    'Firefox MV3 test package loaded as a temporary add-on',
    Boolean(installed.extension),
    installed.extension,
  );

  // On first install the extension opens the welcome wizard in its own tab.
  const welcome = await waitFor(async () => {
    const { contexts } = await bidi.send('browsingContext.getTree', {});
    return contexts.find((item) => /^moz-extension:\/\/[^/]+\/welcome\.html$/.test(item.url));
  }, 'welcome wizard tab').catch(() => null);
  record('Welcome wizard opened on first install', welcome !== null, welcome?.url ?? '');

  // The API key method runs in Firefox's background without the helper app: it keeps a
  // non-extractable key in the extension's IndexedDB, and no provider is reachable until the
  // user allows it. The wizard page shares the background's origin and storage.
  if (welcome !== null) {
    const result = await bidi.send('script.evaluate', {
      target: { context: welcome.context },
      awaitPromise: true,
      expression: `(async () => {
        const open = () => new Promise((resolve, reject) => {
          const request = indexedDB.open('writehand-smoke', 1);
          request.onupgradeneeded = () => request.result.createObjectStore('keys');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const run = async (mode, operation) => {
          const database = await open();
          return new Promise((resolve, reject) => {
            const transaction = database.transaction('keys', mode);
            const request = operation(transaction.objectStore('keys'));
            transaction.oncomplete = () => { database.close(); resolve(request.result); };
            transaction.onabort = () => reject(transaction.error);
          });
        };
        const created = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        await run('readwrite', (store) => store.put(created, 'key'));
        const key = await run('readonly', (store) => store.get('key'));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode('secret'));
        const opened = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, sealed));
        const exportable = await crypto.subtle.exportKey('raw', key).then(() => true, () => false);
        indexedDB.deleteDatabase('writehand-smoke');
        const status = await browser.runtime.sendMessage({ protocolVersion: 1, requestId: 'smoke', type: 'AI_STATUS', payload: {} });
        return JSON.stringify({
          stored: key instanceof CryptoKey && !key.extractable && opened === 'secret' && !exportable,
          optional: browser.runtime.getManifest().optional_host_permissions,
          granted: await browser.permissions.contains({ origins: ['https://api.groq.com/*'] }),
          mode: status.payload?.mode,
          provider: status.payload?.apiKey?.provider,
          access: status.payload?.apiKey?.access,
        });
      })()`,
    });
    const checks = result.type === 'success' ? JSON.parse(result.result.value) : {};
    record(
      'API key method: a non-extractable key persists in the extension IndexedDB; providers stay unreachable until allowed',
      checks.stored === true &&
        checks.optional?.length === 3 &&
        checks.granted === false &&
        checks.mode === 'api-key' &&
        checks.provider === 'groq' &&
        checks.access === false,
      result.type === 'success' ? result.result.value : result.exceptionDetails?.text,
    );
  }

  const tree = await bidi.send('browsingContext.getTree', {});
  // Use the test's own tab, not the wizard's.
  const context = tree.contexts.find((item) => !item.url.startsWith('moz-extension://')).context;
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
    const count = await evaluate(`document.querySelectorAll('writehand-launcher').length`);
    return count >= 2 ? count : 0;
  }, 'launcher buttons').catch(() => 0);
  record(
    'Content script ran; conversation and draft launchers were added',
    launchers === 2,
    `${launchers} launchers`,
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
    const host = [...document.querySelectorAll('writehand-launcher')]
      .find((element) => element.shadowRoot?.querySelector('.ew-compose-bar'));
    [...host.shadowRoot.querySelectorAll('.ew-compose-bar button')]
      .find((button) => button.textContent.trim() === 'Düzelt')
      .click();
    return true;
  })()`);

  // "Düzelt" (Revise) runs directly; the result appears in the card next to the draft.
  const cardQuery = `[...document.querySelectorAll('writehand-launcher')].map((host) => host.shadowRoot?.querySelector('.ew-card')).find(Boolean)`;
  const preview = await waitFor(
    () => evaluate(`${cardQuery}?.querySelector('.ew-rich-preview__source')?.value ?? ''`),
    'result card',
  ).catch(() => '');
  record(
    'The draft "Düzelt" (Revise) button processed the selection; the labeled sample result appeared in the card',
    preview === 'Toplantıyı yarın yapabiliriz.',
    JSON.stringify(preview),
  );

  await evaluate(
    `[...${cardQuery}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Taslağa uygula').click()`,
  );
  const applied = await waitFor(async () => {
    const text = await evaluate(`document.querySelector('[data-fixture="reply-editor"] div').textContent`);
    return text.includes('Toplantıyı yarın yapabiliriz.') ? text : '';
  }, 'writing to the draft').catch(() => '');
  const signature = await evaluate(
    `document.getElementById('Signature').textContent.includes('Deneme Kullanıcı')`,
  );
  record(
    'The result was written only to the selected part; the signature was kept',
    applied === 'Toplantı yarın olsun mu, Toplantıyı yarın yapabiliriz. hazır.' && signature,
    JSON.stringify(applied),
  );

  // Rich content: the whole draft is revised, and "Tablo yap" (Make a table) turns the result into a table before writing it.
  await bidi.send('browsingContext.navigate', { context, url: fixtureUrl, wait: 'complete' });
  await waitFor(async () => {
    const count = await evaluate(`document.querySelectorAll('writehand-launcher').length`);
    return count >= 2 ? count : 0;
  }, 'launcher buttons');
  const clickIn = (selector, label) =>
    evaluate(`(() => {
      const roots = [...document.querySelectorAll('writehand-launcher')].map((host) => host.shadowRoot).filter(Boolean);
      const button = roots.flatMap((root) => [...root.querySelectorAll('${selector} button')])
        .find((element) => element.textContent.trim() === ${JSON.stringify(label)});
      button?.click();
      return Boolean(button);
    })()`);
  await evaluate(`getSelection().removeAllRanges(), true`);
  await clickIn('.ew-compose-bar', 'Düzelt');
  await waitFor(
    () => evaluate(`${cardQuery}?.querySelector('.ew-rich-preview__source')?.value ?? ''`),
    'revision result',
  );
  await clickIn('.ew-card', 'Tablo yap');
  const previewTable = await waitFor(
    () => evaluate(`${cardQuery}?.querySelector('.ew-rich-preview__paper table td')?.textContent ?? ''`),
    'table preview',
  ).catch(() => '');
  await clickIn('.ew-card', 'Taslağa uygula');
  const written = await waitFor(
    () => evaluate(`document.querySelector('[data-fixture="reply-editor"] table td')?.textContent ?? ''`),
    'table written to the draft',
  ).catch(() => '');
  const signatureFirstLine = await evaluate(`document.querySelector('#Signature > div')?.textContent ?? ''`);
  const outcome = await waitFor(
    () =>
      evaluate(
        `[...(${cardQuery}?.querySelectorAll('[role=status], [role=alert]') ?? [])].map((node) => node.textContent.trim()).join(' / ')`,
      ),
    'write outcome',
  ).catch(() => '');
  record(
    'The rich result was previewed and written to the draft as a table; the signature stayed intact',
    previewTable === 'Lisans' &&
      written === 'Lisans' &&
      signatureFirstLine === '--' &&
      outcome.includes('yerleştirildi'),
    JSON.stringify({ previewTable, written, signatureFirstLine, outcome }),
  );

  // Gmail: the content script for Gmail runs on its page; a selection in the inline reply is revised.
  await bidi.send('browsingContext.navigate', { context, url: gmailFixtureUrl, wait: 'complete' });
  const gmailLaunchers = await waitFor(async () => {
    const count = await evaluate(`document.querySelectorAll('writehand-launcher').length`);
    return count >= 3 ? count : 0;
  }, 'Gmail launcher buttons').catch(() => 0);
  await evaluate(`(() => {
    const line = document.querySelector('[data-fixture="reply-editor"] div');
    const text = line.firstChild;
    const start = text.textContent.indexOf('toplantı odası');
    const range = document.createRange();
    range.setStart(text, start);
    range.setEnd(text, start + 'toplantı odası'.length);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    // The reply's toolbar is the one that offers "Yanıt yaz" (Write reply).
    const bar = [...document.querySelectorAll('writehand-launcher')]
      .map((host) => host.shadowRoot?.querySelector('.ew-compose-bar'))
      .find((element) => element && [...element.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Yanıt yaz'));
    [...bar.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Düzelt').click();
    return true;
  })()`);
  await waitFor(
    () => evaluate(`${cardQuery}?.querySelector('.ew-rich-preview__source')?.value ?? ''`),
    'Gmail result card',
  ).catch(() => '');
  await clickIn('.ew-card', 'Taslağa uygula');
  const gmailApplied = await waitFor(async () => {
    const text = await evaluate(`document.querySelector('[data-fixture="reply-editor"] div').textContent`);
    return text.includes('Toplantıyı yarın yapabiliriz.') ? text : '';
  }, 'writing to the Gmail draft').catch(() => '');
  const gmailKept = await evaluate(`(() => {
    const editor = document.querySelector('[data-fixture="reply-editor"]');
    return editor.querySelector('.gmail_signature')?.textContent === 'Ayşe Kaya' &&
      Boolean(document.querySelector('[data-fixture="trimmed-toggle"]'));
  })()`);
  record(
    'Gmail: launchers were added and the selection in the inline reply was revised; the signature was kept',
    gmailLaunchers === 3 &&
      gmailApplied ===
        'Toplantı odası olarak B-204 uygun, Toplantıyı yarın yapabiliriz. rezervasyonunu ben yaparım.' &&
      gmailKept,
    JSON.stringify({ gmailLaunchers, gmailApplied, gmailKept }),
  );
} catch (error) {
  record('The smoke test could not finish', false, error instanceof Error ? error.message : String(error));
} finally {
  try {
    await bidi?.send('session.end', {});
  } catch {
    // The session may already be closed.
  }
  bidi?.close();
  firefox?.stop();
  server?.kill('SIGTERM');
  await sleep(300);
  // On Windows, child processes of a closing Firefox may hold the profile files for a little longer.
  rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}

const failed = steps.filter((step) => !step.ok);
console.log(
  failed.length === 0
    ? '\nFirefox smoke test passed.'
    : `\nFirefox smoke test: ${failed.length} step(s) failed.`,
);
process.exit(failed.length === 0 ? 0 : 1);
