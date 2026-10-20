// Shared harness for the store assets: serves the demo mailbox locally, opens the
// extension's demo build in Chromium and replaces the helper app with a fake one that
// returns the texts from the story. Nothing connects to a real AI or account.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';

import { chromium } from '@playwright/test';

export const ROOT = resolve(import.meta.dirname, '../..');
/** Images to upload to the stores; intermediate output stays under `.output/`. */
export const STORE_DIR = resolve(ROOT, 'store');
export const WORK_DIR = resolve(import.meta.dirname, '.output');
export const EXTENSION_PATH = resolve(ROOT, 'apps/browser-extension/.output/chrome-mv3-demo');
const MAILBOX_DIR = resolve(import.meta.dirname, 'demo-mailbox');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

/** Demo mailbox and template pages. The extension's demo build supports 127.0.0.1. */
export async function startServer(port = 4519) {
  const roots = {
    '/mail/': MAILBOX_DIR,
    '/frames/': resolve(import.meta.dirname, 'frames'),
    '/brand/': resolve(ROOT, 'assets/brand'),
  };
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    const prefix = Object.keys(roots).find((candidate) => path.startsWith(candidate));
    const relative = prefix === undefined ? '' : path.slice(prefix.length) || 'index.html';
    if (prefix === undefined || relative.includes('..')) {
      response.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(resolve(roots[prefix], relative));
      response.writeHead(200, {
        'content-type': `${TYPES[extname(relative)] ?? 'application/octet-stream'}; charset=utf-8`,
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(port, '127.0.0.1', done));
  return { origin: `http://127.0.0.1:${port}`, close: () => new Promise((done) => server.close(done)) };
}

/**
 * Fake helper app (runs in the service worker). An `AI_GENERATE` request is matched
 * against the story's rules: the operation, the "change the result" instruction if any,
 * and the target language.
 */
function installDemoHost({ responses, delayMs, status }) {
  const pick = (input) =>
    responses.find(
      (rule) =>
        rule.operation === input.operation &&
        (rule.refinement ?? null) === (input.refinement?.instruction ?? null) &&
        (rule.language === undefined || rule.language === input.targetLanguage),
    )?.text ?? 'No demo text for this request.';
  globalThis.chrome.permissions.contains = async () => true;
  globalThis.chrome.permissions.request = async () => true;
  globalThis.chrome.runtime.connectNative = () => {
    let receive = () => undefined;
    const reply = (request, payload, wait) =>
      setTimeout(
        () =>
          receive({
            protocolVersion: request.protocolVersion,
            requestId: request.requestId,
            ok: true,
            payload,
          }),
        wait,
      );
    return {
      onMessage: { addListener: (listener) => (receive = listener) },
      onDisconnect: { addListener: () => undefined },
      disconnect: () => undefined,
      postMessage(request) {
        if (request.type === 'AI_GENERATE')
          return reply(request, { text: pick(request.payload.input) }, delayMs);
        if (request.type === 'HOST_INFO')
          return reply(
            request,
            {
              version: '0.1.0',
              os: 'macos',
              arch: 'arm64',
              browsers: ['chrome', 'edge', 'firefox'],
              development: false,
            },
            0,
          );
        if (request.type === 'HOST_UPDATE_CHECK')
          return reply(request, { current: '0.1.0', latest: '0.1.0', available: false }, 0);
        return reply(request, status, 0);
      },
    };
  };
}

/** AI status reported by the helper app: one account connected with a ChatGPT plan. */
const CONNECTED_STATUS = {
  mode: 'chatgpt',
  accounts: [
    {
      id: 'personal',
      label: 'Personal',
      email: 'alex.morgan@lumenlabs.example',
      verified: true,
      connected: true,
      planEnabled: true,
    },
  ],
  activeAccountId: 'personal',
  apiKeyConfigured: false,
  models: [{ id: 'gpt-5', label: 'GPT-5' }],
  selectedModel: 'gpt-5',
  ready: true,
  signingIn: false,
  needsPlanAcknowledgement: false,
  claudeCode: null,
  error: null,
};

/**
 * Opens the extension's demo build. `scale` is the device pixel ratio; images are captured
 * at 2× and scaled down so they stay sharp.
 */
export async function launch({
  viewport,
  scale = 2,
  locale = 'en-US',
  responses = [],
  delayMs = 900,
  recordVideo,
}) {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    locale,
    viewport,
    deviceScaleFactor: scale,
    colorScheme: 'light',
    recordVideo,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--hide-scrollbars',
    ],
  });
  let [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent('serviceworker');
  await worker.evaluate(installDemoHost, { responses, delayMs, status: CONNECTED_STATUS });
  // Keep permission checks on pages consistent with the fake helper (Playwright cannot approve the prompt).
  await context.addInitScript(() => {
    if (globalThis.chrome?.permissions) {
      globalThis.chrome.permissions.contains = async () => true;
      globalThis.chrome.permissions.request = async () => true;
    }
  });
  return { context, worker, extensionId: new URL(worker.url()).host };
}
