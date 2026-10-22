import '@writehand/ui/styles/panel.css';

import { createOutlookWebConnector } from '@writehand/outlook-web';
import { defineContentScript } from '#imports';

import { OWN_UI_SELECTOR } from '../src/bootstrap/mail-provider';
import { locationChanges, startMailSession } from '../src/bootstrap/start-mail-session';
import { OUTLOOK_WEB_MATCHES } from '../src/bootstrap/supported-sites';

export default defineContentScript({
  matches: [...OUTLOOK_WEB_MATCHES],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const outlook = createOutlookWebConnector({
      document,
      ownUiSelector: OWN_UI_SELECTOR,
      subscribeLocation: locationChanges(ctx),
    });
    await startMailSession(ctx, {
      siteId: 'outlook-web',
      connector: outlook.connector,
      locateLauncherAnchors: outlook.locateLauncherAnchors,
      selectorReport: outlook.selectorReport,
      readTheme: outlook.readTheme,
    });
  },
});
