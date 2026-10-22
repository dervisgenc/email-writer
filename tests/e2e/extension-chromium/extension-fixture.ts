import { resolve } from 'node:path';

import { chromium, test as base, type BrowserContext, type Page, type Worker } from '@playwright/test';

export const FIXTURE_URL = 'http://127.0.0.1:4517/mail/inbox';
/** The synthetic Gmail page, with a conversation open (Gmail routes with the URL hash). */
/** The synthetic Gmail inbox with a reply opened from the list, without opening the email. */
export const GMAIL_LIST_REPLY_URL =
  'http://127.0.0.1:4517/gmail/mail/u/0/list#inbox?compose=fixture-compose-3';
export const GMAIL_FIXTURE_URL =
  'http://127.0.0.1:4517/gmail/mail/u/0/#inbox/FMfcgzQXJWDsKmBvTkRbHnPLvXqZcwTt';

/** The test build: includes the local fixture page origin and the labeled sample result source. */
const EXTENSION_PATH = resolve(process.cwd(), 'apps/browser-extension/.output/chrome-mv3-test');

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      // The UI language follows the browser language by default; the tests assert the Turkish texts.
      locale: 'tr-TR',
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent('serviceworker');
    await use(new URL(worker.url()).host);
  },
});

export const expect = test.expect;

/**
 * A fake local helper app that replaces `connectNative` in the background. While `installed`
 * is false the connection drops at once (no helper app); while true it gives fixed answers to
 * HOST_*, AI_STATUS and AI_GENERATE requests. Tests change its state through `globalThis.fakeHost`.
 */
export async function installFakeHost(worker: Worker, options: { installed: boolean }): Promise<void> {
  await worker.evaluate((installed) => {
    const host = {
      installed,
      info: {
        version: '0.1.0',
        os: 'linux',
        arch: 'x64',
        browsers: ['firefox', 'chrome'],
        development: false,
      },
      latest: '0.2.0',
      status: {
        mode: 'claude-code',
        accounts: [],
        activeAccountId: null,
        apiKeyConfigured: false,
        models: [{ id: 'sonnet', label: 'Claude Sonnet' }],
        selectedModel: 'sonnet',
        ready: true,
        signingIn: false,
        needsPlanAcknowledgement: false,
        claudeCode: {
          installed: true,
          loggedIn: true,
          subscription: true,
          plan: 'max',
          account: 'demo@example.test',
          organization: null,
        },
        error: null,
      },
    };
    (globalThis as unknown as { fakeHost: typeof host }).fakeHost = host;
    const runtime = (globalThis as unknown as { chrome: { runtime: { connectNative: () => unknown } } })
      .chrome.runtime;
    runtime.connectNative = () => {
      let receive: (message: unknown) => void = () => undefined;
      let disconnect: () => void = () => undefined;
      const payloadFor = (type: string): unknown => {
        if (type === 'HOST_INFO') return host.info;
        if (type === 'HOST_UPDATE_CHECK')
          return {
            current: host.info.version,
            latest: host.latest,
            available: host.latest !== host.info.version,
          };
        if (type === 'HOST_UPDATE') {
          host.info = { ...host.info, version: host.latest };
          return { version: host.latest };
        }
        if (type === 'AI_GENERATE')
          return {
            text: 'Hi Sam,\n\nThanks for your message. I can send the report on Thursday, but I need the latest numbers from your team first. Could you share them by Wednesday?\n\nBest,\nAlex',
          };
        return host.status;
      };
      return {
        onMessage: { addListener: (listener: (message: unknown) => void) => (receive = listener) },
        onDisconnect: { addListener: (listener: () => void) => (disconnect = listener) },
        disconnect: () => undefined,
        postMessage(request: { protocolVersion: number; requestId: string; type: string }) {
          setTimeout(() => {
            // Without the helper app the browser closes the port at once.
            if (!host.installed) return disconnect();
            receive({
              protocolVersion: request.protocolVersion,
              requestId: request.requestId,
              ok: true,
              payload: structuredClone(payloadFor(request.type)),
            });
          }, 0);
        },
      };
    };
  }, options.installed);
}

/**
 * Fakes the optional permissions in the page (native messaging, access to an API key provider),
 * since Playwright cannot accept the browser's permission prompt.
 */
export async function fakePermissions(page: Page, granted = false): Promise<void> {
  await page.addInitScript((initial) => {
    let allowed = initial;
    const permissions = (globalThis as unknown as { chrome: { permissions: Record<string, unknown> } }).chrome
      .permissions;
    permissions.contains = async () => allowed;
    permissions.request = async () => (allowed = true);
  }, granted);
}

/**
 * Groq's API in the background: the model list and a streamed answer, recording every request
 * without its body. The browser's permission for the provider is reported as granted.
 */
export async function installFakeGroq(worker: Worker): Promise<void> {
  await worker.evaluate(() => {
    const requests: { url: string; authorization: string | null }[] = [];
    (globalThis as unknown as { fakeGroq: { requests: typeof requests } }).fakeGroq = { requests };
    const answer =
      'Hi Sam,\n\nThanks for your message. I can send the report on Thursday, but I need the latest numbers from your team first. Could you share them by Wednesday?\n\nBest,\nAlex';
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, authorization: new Headers(init?.headers).get('Authorization') });
      if (url.endsWith('/models'))
        return new Response(
          JSON.stringify({
            data: [
              { id: 'llama-3.3-70b-versatile', active: true },
              { id: 'openai/gpt-oss-120b', active: true },
              { id: 'whisper-large-v3', active: true },
            ],
          }),
        );
      if (url.endsWith('/chat/completions')) {
        const events = [
          { choices: [{ delta: { content: answer }, finish_reason: null }] },
          { choices: [{ delta: {}, finish_reason: 'stop' }] },
        ];
        return new Response(
          events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('') + 'data: [DONE]\n\n',
        );
      }
      return new Response('{}', { status: 404 });
    };
    const permissions = (globalThis as unknown as { chrome: { permissions: Record<string, unknown> } }).chrome
      .permissions;
    permissions.contains = async () => true;
  });
}
