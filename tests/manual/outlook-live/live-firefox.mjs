// Gerçek Outlook incelemesinde kullanılan kalıcı profilli Firefox'u hazırlar.
import { mkdirSync } from 'node:fs';

import {
  firefoxVersion,
  isBidiListening,
  launchFirefox,
  stopFirefoxWithProfile,
} from '../../support/firefox/firefox-process.mjs';
import { LIVE_BIDI_PORT, LIVE_PROFILE, OUTLOOK_MAIL_URL } from './live-config.mjs';

/**
 * Firefox açıksa onu kullanır, değilse Outlook ile başlatır. `restart` verilirse
 * yalnızca bu profille çalışan Firefox kapatılıp yeniden açılır (ör. pencere
 * kapandıysa veya yarım kalmış bir otomasyon oturumu yeni bağlantıyı engelliyorsa).
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
