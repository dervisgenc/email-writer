import { FIREFOX_EXTENSION_ID, HELPER_COMMAND } from '@writehand/contracts';
import { defineConfig } from 'wxt';

import { version } from '../../package.json';
import { DEVELOPMENT_MATCHES, OUTLOOK_WEB_MATCHES } from './src/bootstrap/supported-sites';
import { manifestMessages } from './src/locales';

/**
 * Builds Manifest V3 packages for Chromium (service worker) and Firefox
 * (background script) from the same source. WXT defaults to MV2 for Firefox,
 * so the commands pass `--mv3` explicitly (see package.json).
 *
 * Permissions are deliberately narrow: `storage`, optional `nativeMessaging`, and static
 * content script matches for the supported Outlook addresses. `<all_urls>`, `tabs`,
 * `scripting`, `activeTab`, `cookies`, `webRequest` and `clipboardRead` are not requested.
 */
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  imports: false,
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    // Name and description come from the `_locales` files in each UI language (hook below).
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    // The root package.json is the single version source; the helper app carries the same version.
    version,
    permissions: ['storage'],
    // The helper app permission is not requested at install; the welcome wizard asks for it with a reason.
    optional_permissions: ['nativeMessaging'],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: FIREFOX_EXTENSION_ID,
              // The built-in data collection declaration arrived in Firefox 140.
              strict_min_version: '140.0',
              // Selected text is sent to OpenAI only when the user requests a generation.
              data_collection_permissions: { required: ['personalCommunications', 'authenticationInfo'] },
            },
            gecko_android: { strict_min_version: '142.0' },
          },
        }
      : {}),
  }),
  zip: {
    // Store packages: writehand-<version>-chrome.zip (Chrome, Edge, Brave) and -firefox.zip. The source
    // archive AMO requires must cover the whole monorepo; the release workflow builds it with `git archive`.
    artifactTemplate: `${HELPER_COMMAND}-{{version}}-{{browser}}.zip`,
    zipSources: false,
  },
  hooks: {
    'build:publicAssets': (_wxt, files) => {
      for (const [language, messages] of Object.entries(manifestMessages())) {
        files.push({
          relativeDest: `_locales/${language}/messages.json`,
          contents: `${JSON.stringify(messages, null, 2)}\n`,
        });
      }
    },
    // The local test page is a supported origin only in development/test builds.
    // The matches are added to the entrypoint options rather than the manifest: in MV3
    // `wxt` (dev) does not write the content script to the manifest but registers it at
    // runtime from these options. The manifest's content script, host permissions and the
    // shadow root stylesheet's web_accessible_resources matches are generated from them too.
    'entrypoints:resolved': (wxt, entrypoints) => {
      if (wxt.config.mode === 'production') {
        return;
      }
      for (const entry of entrypoints) {
        if (entry.type !== 'content-script') {
          continue;
        }
        const { matches } = entry.options;
        if (matches?.some((pattern) => (OUTLOOK_WEB_MATCHES as readonly string[]).includes(pattern))) {
          entry.options.matches = [...matches, ...DEVELOPMENT_MATCHES];
        }
      }
    },
  },
});
