// Runs the extension with live reload in the inspection Firefox that holds the mail session.
//
// The WXT dev server starts without opening a browser, and the development build is
// loaded as a temporary add-on over WebDriver BiDi. Once the background script connects
// to the server, WXT registers the content scripts and reloads the mail tabs; the
// extension reloads itself as the code changes. It uses the same output folder as
// `pnpm dev:firefox`, so the two cannot run at the same time.
//
// Usage: pnpm outlook:dev [--restart]     Ctrl+C removes the extension and stops the server.
//        pnpm gmail:dev [--restart]       the same, opening Gmail if Firefox is started
import { existsSync, watch } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { withBidiSession } from '../../support/firefox/bidi-client.mjs';
import { isPortInUse } from '../../support/firefox/firefox-process.mjs';
import { GMAIL_MAIL_URL, LIVE_BIDI_PORT, OUTLOOK_MAIL_URL } from './live-config.mjs';
import { ensureLiveFirefox } from './live-firefox.mjs';

const extensionRoot = resolve(import.meta.dirname, '../../../apps/browser-extension');
// WXT's dev mode output folder: {{browser}}-mv{{manifestVersion}}-dev
const devOutput = resolve(extensionRoot, '.output/firefox-mv3-dev');
// A separate port so it does not clash with `pnpm dev` (3000).
const devServerPort = Number(process.env.OUTLOOK_DEV_PORT ?? 3123);

/** WXT is a dependency of the extension package, so it is resolved from that package. */
async function loadWxt() {
  const require = createRequire(resolve(extensionRoot, 'package.json'));
  return import(pathToFileURL(require.resolve('wxt')).href);
}

const installExtension = () =>
  withBidiSession(LIVE_BIDI_PORT, async (bidi) => {
    const result = await bidi.send('webExtension.install', {
      extensionData: { type: 'path', path: devOutput },
    });
    return result.extension;
  });

const uninstallExtension = (extension) =>
  withBidiSession(LIVE_BIDI_PORT, (bidi) => bidi.send('webExtension.uninstall', { extension }));

const { values } = parseArgs({
  options: {
    restart: { type: 'boolean', default: false },
    gmail: { type: 'boolean', default: false },
  },
});
const mail = values.gmail ? 'Gmail' : 'Outlook';

// Two sessions build into the same output folder and install the same extension ID, breaking each other.
if (await isPortInUse(devServerPort)) {
  console.error(
    `Another "pnpm outlook:dev" is already running (port ${devServerPort}). Use it or stop it first with Ctrl+C.`,
  );
  process.exit(1);
}
const firefox = await ensureLiveFirefox({
  restart: values.restart,
  urls: [values.gmail ? GMAIL_MAIL_URL : OUTLOOK_MAIL_URL],
});
if (firefox.started) {
  console.log(`${firefox.version} started. If you are not signed in to ${mail}, sign in first.`);
}

const { createServer } = await loadWxt();

const server = await createServer({
  root: extensionRoot,
  browser: 'firefox',
  manifestVersion: 3,
  webExt: { disabled: true },
  dev: { server: { port: devServerPort } },
});
await server.start();
if (!existsSync(resolve(devOutput, 'manifest.json'))) {
  await server.stop();
  throw new Error(`Development build not found: ${devOutput}`);
}

const extension = await installExtension();
console.log(`Extension installed in the inspection Firefox (${extension}). The ${mail} tab will reload.`);
console.log('The extension reloads itself as the code changes. Press Ctrl+C to stop.');

// WXT's content script reload is unreliable in Firefox: even after the tab reloads,
// the previous content script can keep running. So after every build the extension is
// reinstalled from disk; once the background script connects to the server, WXT
// registers the content script and reloads the mail tab. WXT calls its `build:done` hook
// only for full builds, not for the partial rebuilds of dev mode, so the output folder
// itself is watched.
let reinstallTimer = null;
const reinstallAfterBuild = () => {
  clearTimeout(reinstallTimer);
  reinstallTimer = setTimeout(() => {
    installExtension()
      .then(() => console.log(`Extension reinstalled; reloading the ${mail} tab.`))
      .catch((error) => console.error(`Could not reinstall the extension: ${error.message}`));
  }, 500);
};
const outputWatcher = watch(devOutput, { recursive: true }, reinstallAfterBuild);

let stopping = false;
async function stop() {
  if (stopping) {
    return;
  }
  stopping = true;
  outputWatcher.close();
  // A temporary add-on also goes away when Firefox closes; if Firefox stays open, it is removed here.
  await uninstallExtension(extension).catch(() => {});
  await server.stop();
  // The page is not reloaded automatically: a draft being written could be lost.
  console.log(`\nExtension removed. Buttons left on the page go away when the ${mail} tab reloads.`);
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
