import '@writehand/ui/styles/panel.css';

import { createGmailWebConnector } from '@writehand/gmail-web';
import { defineContentScript } from '#imports';

import { OWN_UI_SELECTOR } from '../src/bootstrap/mail-provider';
import { locationChanges, startMailSession } from '../src/bootstrap/start-mail-session';
import { GMAIL_WEB_MATCHES } from '../src/bootstrap/supported-sites';

export default defineContentScript({
  matches: [...GMAIL_WEB_MATCHES],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const gmail = createGmailWebConnector({
      document,
      ownUiSelector: OWN_UI_SELECTOR,
      // Gmail routes with the URL hash; WXT reports those changes as location changes too.
      subscribeLocation: locationChanges(ctx),
    });
    await startMailSession(ctx, {
      siteId: 'gmail-web',
      connector: gmail.connector,
      locateLauncherAnchors: gmail.locateLauncherAnchors,
      selectorReport: gmail.selectorReport,
      readTheme: gmail.readTheme,
      skin: 'material',
    });
  },
});
