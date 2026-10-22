// Shared plumbing for the live inspection tools: a probe bundle that runs the extension's
// reading code in WebDriver BiDi's isolated sandbox on the real mail page, and a client that
// calls it. Output stays masked; the probe never returns real text (see docs/DEVELOPMENT.md).
import { build } from 'vite';

import { unwrapScriptResult, withBidiSession } from '../../support/firefox/bidi-client.mjs';
import { isBidiListening } from '../../support/firefox/firefox-process.mjs';
import { LIVE_BIDI_PORT } from './live-config.mjs';

const PROBE_GLOBAL = '__emailWriterProbe';
const SANDBOX = 'writehand-live-probe';

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export async function waitUntil(check, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) {
      return true;
    }
    await sleep(200);
  }
  return false;
}

/** Exits with a hint when the inspection Firefox is not running. */
export async function requireLiveFirefox() {
  if (!(await isBidiListening(LIVE_BIDI_PORT))) {
    console.error(`Firefox BiDi ${LIVE_BIDI_PORT} is not listening. Start it first: pnpm outlook:firefox`);
    process.exit(1);
  }
}

async function bundleProbe(entry) {
  const output = await build({
    configFile: false,
    logLevel: 'warn',
    build: {
      write: false,
      minify: false,
      target: 'firefox140',
      lib: { entry, formats: ['iife'], name: PROBE_GLOBAL, fileName: 'probe' },
    },
  });
  return (Array.isArray(output) ? output[0] : output).output[0].code;
}

async function findMailContext(bidi, tab, missing) {
  const { contexts } = await bidi.send('browsingContext.getTree', { maxDepth: 0 });
  const found = contexts.find((context) => tab.test(context.url));
  if (found === undefined) {
    throw new Error(missing);
  }
  return found.context;
}

function createProbeClient(bidi, context) {
  const target = { context, sandbox: SANDBOX };
  return {
    async install(code) {
      unwrapScriptResult(
        await bidi.send('script.evaluate', { expression: code, target, awaitPromise: false }),
      );
    },
    /**
     * Calls a function inside the sandbox; the result is carried as JSON. An omitted
     * argument stays `undefined` so that the function's default value applies.
     */
    async call(name, ...args) {
      const serialized = args.map((arg) => (arg === undefined ? 'undefined' : JSON.stringify(arg)));
      const call = `${PROBE_GLOBAL}.${name}(${serialized.join(', ')})`;
      const result = unwrapScriptResult(
        await bidi.send('script.evaluate', {
          expression: `Promise.resolve(${call}).then((value) => JSON.stringify(value ?? null))`,
          target,
          awaitPromise: true,
        }),
      );
      return JSON.parse(result.value);
    },
  };
}

/**
 * Finds the mail tab whose URL matches `tab`, installs the probe built from `probe` in its
 * sandbox and runs `work` with it.
 */
export async function withMailProbe({ tab, missing, probe }, work) {
  await withBidiSession(LIVE_BIDI_PORT, async (bidi) => {
    const context = await findMailContext(bidi, tab, missing);
    const client = createProbeClient(bidi, context);
    await client.install(await bundleProbe(probe));
    await work(bidi, context, client);
  });
}

export async function clickAt(bidi, context, { x, y }) {
  await bidi.send('input.performActions', {
    context,
    actions: [
      {
        type: 'pointer',
        id: 'writehand-mouse',
        parameters: { pointerType: 'mouse' },
        actions: [
          { type: 'pointerMove', x, y, origin: 'viewport' },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ],
  });
  await bidi.send('input.releaseActions', { context });
}

export function explainLiveError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /Maximum number of active sessions/.test(message)
    ? 'Firefox is holding an unfinished automation session. Restart it: pnpm outlook:firefox --restart'
    : message;
}
