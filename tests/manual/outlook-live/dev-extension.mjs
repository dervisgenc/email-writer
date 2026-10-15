// Eklentiyi, Outlook oturumu açık olan inceleme Firefox'unda canlı yenilemeyle çalıştırır.
//
// WXT geliştirme sunucusu tarayıcı açmadan başlatılır ve geliştirme derlemesi
// WebDriver BiDi ile geçici eklenti olarak yüklenir. Arka plan betiği sunucuya
// bağlanınca WXT içerik betiğini kaydeder ve Outlook sekmesini yeniler; kod
// değiştikçe eklenti kendiliğinden yenilenir. `pnpm dev:firefox` ile aynı çıktı
// klasörünü kullandığı için ikisi aynı anda çalıştırılmaz.
//
// Kullanım: pnpm outlook:dev [--restart]     Ctrl+C eklentiyi kaldırır ve sunucuyu durdurur.
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { withBidiSession } from '../../support/firefox/bidi-client.mjs';
import { isPortInUse } from '../../support/firefox/firefox-process.mjs';
import { LIVE_BIDI_PORT } from './live-config.mjs';
import { ensureLiveFirefox } from './live-firefox.mjs';

const extensionRoot = resolve(import.meta.dirname, '../../../apps/browser-extension');
// WXT'nin geliştirme modu çıktı klasörü: {{browser}}-mv{{manifestVersion}}-dev
const devOutput = resolve(extensionRoot, '.output/firefox-mv3-dev');
// `pnpm dev` (3000) ile çakışmaması için ayrı bağlantı noktası.
const devServerPort = Number(process.env.OUTLOOK_DEV_PORT ?? 3123);

/** WXT eklenti paketinin bağımlılığıdır; o paketin bağlamından çözümlenir. */
async function loadWxt() {
  const require = createRequire(resolve(extensionRoot, 'package.json'));
  return import(pathToFileURL(require.resolve('wxt')).href);
}

const installExtension = () =>
  withBidiSession(LIVE_BIDI_PORT, async (bidi) => {
    const result = await bidi.send('webExtension.install', {
      extensionData: { type: 'path', path: devOutput },
    });
    return result.extension;
  });

const uninstallExtension = (extension) =>
  withBidiSession(LIVE_BIDI_PORT, (bidi) => bidi.send('webExtension.uninstall', { extension }));

const { values } = parseArgs({ options: { restart: { type: 'boolean', default: false } } });

// İki oturum aynı çıktı klasörüne derler ve aynı kimlikle eklenti yükler; birbirini bozar.
if (await isPortInUse(devServerPort)) {
  console.error(
    `Başka bir "pnpm outlook:dev" zaten çalışıyor (port ${devServerPort}). Onu kullanın veya önce Ctrl+C ile durdurun.`,
  );
  process.exit(1);
}
const firefox = await ensureLiveFirefox({ restart: values.restart });
if (firefox.started) {
  console.log(`${firefox.version} açıldı. Outlook oturumu açık değilse önce giriş yapın.`);
}

const { createServer } = await loadWxt();
/** İlk yüklemeden sonraki her derlemede eklenti diskten baştan yüklenir. */
let reinstallAfterBuild = () => {};

const server = await createServer({
  root: extensionRoot,
  browser: 'firefox',
  manifestVersion: 3,
  webExt: { disabled: true },
  dev: { server: { port: devServerPort } },
  hooks: {
    'build:done': () => reinstallAfterBuild(),
  },
});
await server.start();
if (!existsSync(resolve(devOutput, 'manifest.json'))) {
  await server.stop();
  throw new Error(`Geliştirme derlemesi bulunamadı: ${devOutput}`);
}

const extension = await installExtension();
console.log(`Eklenti inceleme Firefox'una yüklendi (${extension}). Outlook sekmesi yenilenecek.`);
console.log('Kod değiştikçe eklenti kendiliğinden yenilenir. Durdurmak için Ctrl+C.');

// WXT'nin içerik betiği yenilemesi Firefox'ta güvenilir değil: sekme yenilense de
// önceki içerik betiği çalışmaya devam edebiliyor. Bu yüzden her derlemeden sonra
// eklenti diskten baştan yüklenir; arka plan betiği sunucuya bağlanınca WXT içerik
// betiğini kaydeder ve Outlook sekmesini yeniler.
let reinstallTimer = null;
reinstallAfterBuild = () => {
  clearTimeout(reinstallTimer);
  reinstallTimer = setTimeout(() => {
    installExtension()
      .then(() => console.log('Eklenti yeniden yüklendi; Outlook sekmesi yenileniyor.'))
      .catch((error) => console.error(`Eklenti yeniden yüklenemedi: ${error.message}`));
  }, 300);
};

let stopping = false;
async function stop() {
  if (stopping) {
    return;
  }
  stopping = true;
  // Geçici eklenti Firefox kapanınca da kalkar; Firefox açık kalıyorsa burada kaldırılır.
  await uninstallExtension(extension).catch(() => {});
  await server.stop();
  // Sayfa kendiliğinden yenilenmez: yazılmakta olan bir taslak kaybolabilir.
  console.log('\nEklenti kaldırıldı. Sayfada kalan düğmeler Outlook sekmesi yenilenince kalkar.');
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
