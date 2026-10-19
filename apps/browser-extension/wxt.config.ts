import { FIREFOX_EXTENSION_ID, HELPER_COMMAND } from '@email-writer/contracts';
import { defineConfig } from 'wxt';

import { version } from '../../package.json';
import { DEVELOPMENT_MATCHES, OUTLOOK_WEB_MATCHES } from './src/bootstrap/supported-sites';
import { manifestMessages } from './src/locales';

/**
 * Aynı kaynak koddan Chromium (service worker) ve Firefox (background script)
 * için Manifest V3 paketleri üretilir. WXT'de Firefox varsayılanı MV2 olduğu
 * için komutlarda `--mv3` açıkça verilir (bkz. package.json).
 *
 * İzinler bilinçli olarak dardır: `storage`, `nativeMessaging` ve desteklenen Outlook
 * adreslerine statik content script eşleşmeleri. `<all_urls>`, `tabs`,
 * `scripting`, `activeTab`, `cookies`, `webRequest`, `clipboardRead` istenmez.
 */
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  imports: false,
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    // Ad ve açıklama arayüz dillerinde `_locales` dosyalarından gelir (aşağıdaki hook).
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    // Tek sürüm kaynağı kök package.json'dır; yardımcı uygulama da aynı sürümü taşır.
    version,
    permissions: ['storage', 'nativeMessaging'],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: FIREFOX_EXTENSION_ID,
              // Yerleşik veri paylaşımı beyanı Firefox 140 ile geldi.
              strict_min_version: '140.0',
              // Yalnızca kullanıcı üretim istediğinde seçilen metin OpenAI'a gönderilir.
              data_collection_permissions: { required: ['personalCommunications', 'authenticationInfo'] },
            },
            gecko_android: { strict_min_version: '142.0' },
          },
        }
      : {}),
  }),
  zip: {
    // Mağaza paketleri: writehand-<sürüm>-chrome.zip (Chrome, Edge, Brave) ve -firefox.zip. AMO'nun
    // istediği kaynak arşivi bütün monorepoyu kapsamalı; sürüm iş akışı onu `git archive` ile üretir.
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
    // Yerel test sayfası yalnızca geliştirme/test derlemesinde desteklenen origin olur.
    // Eşleşmeler manifest yerine giriş noktası seçeneklerine eklenir: `wxt` (dev)
    // MV3'te content script'i manifeste yazmaz, bu seçeneklerle çalışma anında
    // kaydeder. Manifestteki content script, host izni ve gölge kök stilinin
    // web_accessible_resources eşleşmeleri de aynı seçeneklerden üretilir.
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
