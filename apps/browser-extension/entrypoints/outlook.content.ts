import '@writehand/ui/styles/panel.css';

import type { TextProcessor } from '@writehand/contracts';
import { createOutlookWebConnector } from '@writehand/outlook-web';
import { defineContentScript } from '#imports';

import { createExtensionSession } from '../src/bootstrap/create-extension-session';
import { OWN_UI_SELECTOR } from '../src/bootstrap/mail-provider';
import { OUTLOOK_WEB_MATCHES } from '../src/bootstrap/supported-sites';
import { reportDiagnostic } from '../src/platform/diagnostics';
import { createConnectedProcessor } from '../src/platform/connected-processor';
import { localSettingsArea, sendToBackground } from '../src/platform/extension-browser';
import { createSettingsStore } from '../src/platform/settings-store';

/**
 * Regular and development builds use the real AI connection.
 * Only the test build has labeled sample results; this module is
 * stripped from the production bundle at build time.
 */
async function loadTextProcessor(): Promise<TextProcessor | null> {
  if (import.meta.env.MODE !== 'test') {
    const settings = createSettingsStore(localSettingsArea);
    return createConnectedProcessor(sendToBackground, async () => ({
      standingInstructions: (await settings.read()).settings.writingInstructions,
    }));
  }
  const { createFixtureProcessor } = await import('../src/development/fixture-results');
  return createFixtureProcessor();
}

export default defineContentScript({
  matches: [...OUTLOOK_WEB_MATCHES],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const outlook = createOutlookWebConnector({
      document,
      ownUiSelector: OWN_UI_SELECTOR,
      subscribeLocation: (listener) => {
        // A location change only triggers rediscovery; it does not identify the right conversation.
        // WXT removes the listener itself when the context is invalidated.
        let active = true;
        ctx.addEventListener(window, 'wxt:locationchange', () => {
          if (active) {
            listener();
          }
        });
        return () => {
          active = false;
        };
      },
    });

    try {
      await createExtensionSession({
        ctx,
        provider: {
          siteId: 'outlook-web',
          connector: outlook.connector,
          locateLauncherAnchors: outlook.locateLauncherAnchors,
          selectorReport: outlook.selectorReport,
          readTheme: outlook.readTheme,
        },
        processor: await loadTextProcessor(),
      });
    } catch {
      // An extension failure must not break normal use of the mail app.
      outlook.connector.dispose();
      reportDiagnostic({ code: 'UNEXPECTED', area: 'content-script' });
    }
  },
});
