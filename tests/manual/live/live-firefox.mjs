// Prepares the persistent-profile Firefox used for real Outlook and Gmail inspection.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

import {
  firefoxVersion,
  isBidiListening,
  launchFirefox,
  resolveFirefox,
  stopFirefoxWithProfile,
} from '../../support/firefox/firefox-process.mjs';
import { LIVE_BIDI_PORT, LIVE_PROFILE, OUTLOOK_MAIL_URL } from './live-config.mjs';

/**
 * Uses Firefox if it is already running, otherwise starts it with `urls` (Outlook by default).
 * With `restart`, only the Firefox running with this profile is closed and reopened (e.g. if
 * the window was closed or an unfinished automation session blocks new connections).
 */
export async function ensureLiveFirefox({ restart = false, urls = [OUTLOOK_MAIL_URL] } = {}) {
  if (await isBidiListening(LIVE_BIDI_PORT)) {
    if (!restart) {
      return { started: false, version: null };
    }
    await stopFirefoxWithProfile(LIVE_PROFILE, LIVE_BIDI_PORT);
  }
  mkdirSync(LIVE_PROFILE, { recursive: true, mode: 0o700 });
  const { firefox } = await launchFirefox({ profile: LIVE_PROFILE, port: LIVE_BIDI_PORT, urls });
  return { started: true, version: firefoxVersion(firefox) };
}

/**
 * Opens the same profile without WebDriver BiDi, for signing in. Google refuses to sign in to a
 * browser that is under remote control; the session it leaves in the profile works afterwards
 * in the inspection window. Quit this window before starting the inspection window.
 */
export async function openProfileForSignIn(urls) {
  if (await isBidiListening(LIVE_BIDI_PORT)) {
    throw new Error('The inspection Firefox is running with this profile. Quit it first (Cmd+Q / Alt+F4).');
  }
  mkdirSync(LIVE_PROFILE, { recursive: true, mode: 0o700 });
  const firefox = resolveFirefox();
  const args = ['--no-remote', '--profile', LIVE_PROFILE, ...urls];
  if (firefox.kind === 'mac-app') {
    execFileSync('open', ['-n', '-a', firefox.app, '--args', ...args]);
  } else {
    spawn(firefox.binary, args, { stdio: 'ignore', detached: true }).unref();
  }
  return { version: firefoxVersion(firefox) };
}
