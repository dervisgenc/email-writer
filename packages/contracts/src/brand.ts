/**
 * Ürünün kullanıcıya görünen adı ve dış kimlikleri. Eklenti, yardımcı uygulama ve
 * kurulum bu değerleri yalnızca buradan alır. İç paket adları (`@email-writer/*`) ve
 * depo adı ürün adından bağımsızdır.
 */
export const PRODUCT_NAME = 'Writehand';

/** Yerel yardımcı uygulamanın tarayıcılara kaydedildiği native messaging adı. */
export const NATIVE_HOST_NAME = 'com.dervisgenc.writehand';

/** Firefox (AMO) eklenti kimliği. Yayından sonra değiştirilirse mağaza güncellemeleri kopar. */
export const FIREFOX_EXTENSION_ID = 'writehand@dervisgenc.com';

/**
 * Mağazalardaki Chromium eklenti kimlikleri (Chrome Web Store, Edge Add-ons). Yardımcı
 * uygulama Chromium tarayıcılarında yalnızca bu kimliklere ve kurulumda `--extension-id`
 * ile verilenlere bağlantı izni verir. Mağaza kimliği alındığında eklenecek tek yer
 * burasıdır; ardından yeni bir sürüm yayımlanır (bkz. docs/GELISTIRICI_REHBERI.md).
 */
export const CHROMIUM_EXTENSION_IDS: readonly string[] = [];

/** Yardımcı uygulamanın program adı; kurulum ve veri klasörleri de bu adı taşır. */
export const HELPER_COMMAND = 'writehand';

/** Kaynak kodun ve sürümlerin bulunduğu GitHub deposu (`sahip/ad`). */
export const REPOSITORY = 'dervisgenc/email-writer';
export const REPOSITORY_URL = `https://github.com/${REPOSITORY}`;
