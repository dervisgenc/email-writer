import '@email-writer/ui/styles/panel.css';

import type { TextProcessor } from '@email-writer/contracts';
import { createOutlookWebConnector } from '@email-writer/outlook-web';
import { defineContentScript } from '#imports';

import { createExtensionSession } from '../src/bootstrap/create-extension-session';
import { OWN_UI_SELECTOR } from '../src/bootstrap/mail-provider';
import { OUTLOOK_WEB_MATCHES } from '../src/bootstrap/supported-sites';
import { reportDiagnostic } from '../src/platform/diagnostics';
import { createConnectedProcessor } from '../src/platform/connected-processor';
import { sendToBackground } from '../src/platform/extension-browser';

/**
 * Normal ve geliştirme derlemeleri gerçek AI bağlantısını kullanır.
 * Yalnızca test derlemesinde etiketli örnek sonuçlar vardır; bu modül
 * üretim paketinden derleme sırasında çıkarılır.
 */
async function loadTextProcessor(): Promise<TextProcessor | null> {
  if (import.meta.env.MODE !== 'test') {
    return createConnectedProcessor(sendToBackground);
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
        // Konum değişikliği yeniden keşif işaretidir; doğru konuşmayı tek başına belirlemez.
        // WXT dinleyiciyi bağlam geçersiz olduğunda kendisi kaldırır.
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
      // Eklenti hatası e-posta uygulamasının normal kullanımını bozmamalı.
      outlook.connector.dispose();
      reportDiagnostic({ code: 'UNEXPECTED', area: 'content-script' });
    }
  },
});
