import '@email-writer/ui/styles/panel.css';

import type { TextProcessor } from '@email-writer/contracts';
import { createOutlookWebConnector } from '@email-writer/outlook-web';
import { defineContentScript } from '#imports';

import { createExtensionSession } from '../src/bootstrap/create-extension-session';
import { OWN_UI_SELECTOR } from '../src/bootstrap/mail-provider';
import { OUTLOOK_WEB_MATCHES } from '../src/bootstrap/supported-sites';
import { reportDiagnostic } from '../src/platform/diagnostics';

/**
 * Normal derlemede metin işleme bağlantısı yoktur. Geliştirme ve test
 * derlemesinde, açıkça etiketlenmiş örnek sonuç kaynağı bağlanır; üretim
 * paketinde bu dal ve modül derleme sırasında tamamen çıkarılır.
 */
async function loadTextProcessor(): Promise<TextProcessor | null> {
  if (import.meta.env.MODE === 'production') {
    return null;
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
