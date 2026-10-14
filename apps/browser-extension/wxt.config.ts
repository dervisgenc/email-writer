import { defineConfig } from 'wxt';

import { DEVELOPMENT_MATCHES, OUTLOOK_WEB_MATCHES } from './src/bootstrap/supported-sites';

/**
 * Aynı kaynak koddan Chromium (service worker) ve Firefox (background script)
 * için Manifest V3 paketleri üretilir. WXT'de Firefox varsayılanı MV2 olduğu
 * için komutlarda `--mv3` açıkça verilir (bkz. package.json).
 *
 * İzinler bilinçli olarak dardır: yalnızca `storage` ve desteklenen Outlook
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
    permissions: ['storage'],
    action: { default_title: 'Email Writer' },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              // Mağaza kaydından önce kalıcı kimlik kararı verilmeli (bkz. docs/GELISTIRICI_REHBERI.md).
              id: 'email-writer@example.invalid',
              // Yerleşik veri paylaşımı beyanı Firefox 140 ile geldi.
              strict_min_version: '140.0',
              // Bu aşamada eklenti hiçbir veriyi dışarı aktarmaz; beyan bunu yansıtır.
              // Metin işleme bağlantısı eklendiğinde bu beyan güncellenmek zorundadır.
              data_collection_permissions: { required: ['none'] },
            },
            gecko_android: { strict_min_version: '142.0' },
          },
        }
      : {}),
  }),
  hooks: {
    // Yerel test sayfası yalnızca geliştirme/test derlemesinde desteklenen origin olur.
    'build:manifestGenerated': (wxt, manifest) => {
      if (wxt.config.mode === 'production') {
        return;
      }
      const withDevelopmentMatches = (matches: string[]) =>
        matches.some((pattern) => (OUTLOOK_WEB_MATCHES as readonly string[]).includes(pattern))
          ? [...matches, ...DEVELOPMENT_MATCHES]
          : matches;
      for (const script of manifest.content_scripts ?? []) {
        script.matches = withDevelopmentMatches(script.matches ?? []);
      }
      // Gölge kökün stil dosyası yerel test sayfasından da yüklenebilmeli.
      for (const resource of manifest.web_accessible_resources ?? []) {
        if (typeof resource !== 'string' && resource.matches !== undefined) {
          resource.matches = withDevelopmentMatches(resource.matches);
        }
      }
    },
  },
});
