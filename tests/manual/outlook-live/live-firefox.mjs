// Prepares the persistent-profile Firefox used for real Outlook inspection.
import { mkdirSync } from 'node:fs';

import {
  firefoxVersion,
  isBidiListening,
  launchFirefox,
  stopFirefoxWithProfile,
} from '../../support/firefox/firefox-process.mjs';
import { LIVE_BIDI_PORT, LIVE_PROFILE, OUTLOOK_MAIL_URL } from './live-config.mjs';

/**
 * Uses Firefox if it is already running, otherwise starts it with Outlook. With `restart`,
 * only the Firefox running with this profile is closed and reopened (e.g. if the window
 * was closed or an unfinished automation session blocks new connections).
 */
export async function ensureLiveFirefox({ restart = false } = {}) {
  if (await isBidiListening(LIVE_BIDI_PORT)) {
    if (!restart) {
      return { started: false, version: null };
    }
    await stopFirefoxWithProfile(LIVE_PROFILE, LIVE_BIDI_PORT);
  }
  mkdirSync(LIVE_PROFILE, { recursive: true, mode: 0o700 });
  const { firefox } = await launchFirefox({
    profile: LIVE_PROFILE,
    port: LIVE_BIDI_PORT,
    urls: [OUTLOOK_MAIL_URL],
  });
  return { started: true, version: firefoxVersion(firefox) };
}
