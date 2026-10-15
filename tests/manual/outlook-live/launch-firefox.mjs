// Gerçek Outlook incelemesi için kalıcı profilli Firefox'u BiDi açık başlatır.
// Outlook'a bu pencerede bir kez giriş yapılır; oturum profilde kalır.
// Eklentiyi de bu pencerede çalıştırmak için: pnpm outlook:dev
// Kullanım: pnpm outlook:firefox [--restart]
//   --restart  açık olan inceleme Firefox'unu kapatıp yeniden başlatır (ör. pencere
//              kapandıysa veya yarım kalmış bir otomasyon oturumu yeni bağlantıyı engelliyorsa)
import { parseArgs } from 'node:util';

import { LIVE_BIDI_PORT, LIVE_PROFILE } from './live-config.mjs';
import { ensureLiveFirefox } from './live-firefox.mjs';

const { values } = parseArgs({ options: { restart: { type: 'boolean', default: false } } });
const { started, version } = await ensureLiveFirefox({ restart: values.restart });

if (started) {
  console.log(`${version} açıldı (BiDi ${LIVE_BIDI_PORT}).`);
  console.log(`Profil: ${LIVE_PROFILE}`);
  console.log('Outlook oturumu bu profilde kalır. Pencereyi kapatmak oturumu silmez.');
} else {
  console.log(
    `Firefox zaten açık (BiDi ${LIVE_BIDI_PORT}). Yeniden başlatmak için: pnpm outlook:firefox --restart`,
  );
}
