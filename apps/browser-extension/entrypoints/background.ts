import { ok } from '@email-writer/contracts';
import { browser, defineBackground } from '#imports';

import { reportDiagnostic } from '../src/platform/diagnostics';
import {
  addRuntimeMessageListener,
  isOwnExtensionPage,
  localSettingsArea,
} from '../src/platform/extension-browser';
import { createRuntimeHandler, toMessageListener } from '../src/platform/runtime-messaging';
import { createSettingsStore } from '../src/platform/settings-store';

/**
 * Arka plan kodu yalnızca kurulum, ayar okuma/yazma ve ayar geçişlerini
 * yönetir. E-posta metinlerini saklamaz; Chrome'un service worker'ı
 * durdurup yeniden başlatması panel oturumunu etkilemez.
 */
export default defineBackground(() => {
  const settings = createSettingsStore(localSettingsArea);

  browser.runtime.onInstalled.addListener(() => {
    void settings.ensureInitialized().then((stored) => {
      if (stored.issue === 'invalid' || stored.issue === 'newer-schema') {
        reportDiagnostic({ code: 'SETTINGS_INVALID', area: 'background' });
      }
    });
  });

  const handle = createRuntimeHandler(
    {
      GET_SETTINGS: async () => ok({ settings: (await settings.read()).settings }),
      // Yazma istekleri sıralı işlenir; başarı ancak depolama tamamlanınca döner.
      PATCH_SETTINGS: async (payload) => ok(await settings.patch(payload.expectedRevision, payload.changes)),
    },
    { context: 'background', isAllowedSender: isOwnExtensionPage },
  );
  addRuntimeMessageListener(toMessageListener(handle));
});
