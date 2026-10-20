import { ok } from '@writehand/contracts';
import { browser, defineBackground } from '#imports';

import { reportDiagnostic } from '../src/platform/diagnostics';
import {
  addRuntimeMessageListener,
  isOwnExtensionPage,
  localSettingsArea,
  connectAiHost,
  extensionId,
  openOptionsPage,
  openWelcomePage,
} from '../src/platform/extension-browser';
import { createAiHandlers } from '../src/platform/ai-background';
import { createAiSenderPolicy } from '../src/platform/ai-sender-policy';
import { createNativeClient } from '../src/platform/native-client';
import { isSupportedUrl } from '../src/platform/extension-client';
import { createRuntimeHandler, toMessageListener } from '../src/platform/runtime-messaging';
import { createSettingsStore } from '../src/platform/settings-store';

/**
 * Validated message routing for setup/settings and the local AI connection.
 * Generation text stays in memory only for the duration of a request; OAuth
 * tokens never reach this context. If the worker restarts, a pending request fails.
 */
export default defineBackground(() => {
  const settings = createSettingsStore(localSettingsArea);
  const native = createNativeClient(connectAiHost);

  browser.runtime.onInstalled.addListener((details) => {
    // On first install the welcome wizard explains how to install and connect the helper app.
    if (details.reason === 'install') void openWelcomePage();
    void settings.ensureInitialized().then((stored) => {
      if (stored.issue === 'invalid' || stored.issue === 'newer-schema') {
        reportDiagnostic({ code: 'SETTINGS_INVALID', area: 'background' });
      }
    });
  });

  const handle = createRuntimeHandler(
    {
      ...createAiHandlers({ sendNative: native.send, openOptions: openOptionsPage }),
      GET_SETTINGS: async () => ok({ settings: (await settings.read()).settings }),
      // Writes are processed in order; success is returned only once storage completes.
      PATCH_SETTINGS: async (payload) => ok(await settings.patch(payload.expectedRevision, payload.changes)),
    },
    {
      context: 'background',
      isAllowedSender: createAiSenderPolicy({
        extensionId: extensionId(),
        isOwnPage: isOwnExtensionPage,
        isMailUrl: isSupportedUrl,
      }),
    },
  );
  addRuntimeMessageListener(toMessageListener(handle));
});
