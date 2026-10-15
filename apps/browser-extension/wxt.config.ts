import { defineConfig } from 'wxt';

import { DEVELOPMENT_MATCHES, OUTLOOK_WEB_MATCHES } from './src/bootstrap/supported-sites';

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
    name: 'Email Writer',
    description: 'Outlook Web içinde e-posta metnini düzeltme, çevirme ve yanıt hazırlama yardımcısı.',
    permissions: ['storage', 'nativeMessaging'],
    action: { default_title: 'Email Writer' },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              // Mağaza kaydından önce kalıcı kimlik kararı verilmeli (bkz. docs/GELISTIRICI_REHBERI.md).
              id: 'email-writer@example.invalid',
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
  hooks: {
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
