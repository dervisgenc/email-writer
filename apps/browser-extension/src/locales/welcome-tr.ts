import { PRODUCT_NAME } from '@email-writer/contracts';

import type { WelcomeText } from './extension-text';

export const welcomeTr: WelcomeText = {
  title: 'Hoş geldiniz',
  subtitle: `${PRODUCT_NAME} dört kısa adımda hazır`,
  stepsLabel: 'Kurulum adımları',
  steps: ['Hoş geldiniz', 'Uygulama', 'Bağlantı', 'Deneyin'],
  back: 'Geri',
  next: 'Devam',
  intro: {
    title: 'Neden yardımcı uygulama?',
    lead: `${PRODUCT_NAME} Outlook Web’in içinde çalışır. Bir tarayıcı eklentisinin tek başına yapamadığı işi bilgisayarınızdaki küçük bir yardımcı uygulama yapar.`,
    reasons: [
      'ChatGPT ile giriş, bilgisayarınızda bir dönüş adresi ister; eklenti bunu sağlayamaz.',
      'Oturum bilgileriniz ve API anahtarlarınız tarayıcıda değil, bilgisayarınızda korunur.',
      'Açık kaynaktır: kodunun her satırını inceleyebilirsiniz.',
    ],
    source: 'GitHub’daki kaynak kodu',
    doesTitle: 'Ne yapar?',
    does: [
      'Siz istediğinizde, seçtiğiniz metni seçtiğiniz sağlayıcıya iletir.',
      'ChatGPT, OpenAI veya Claude bağlantınızı saklar.',
    ],
    doesNotTitle: 'Ne yapmaz?',
    doesNot: [
      'E-posta göndermez.',
      'Posta kutunuzu arka planda okumaz.',
      'Hiçbir şeyi bizim sunucumuza göndermez; böyle bir sunucu yok.',
    ],
  },
  install: {
    title: 'Yardımcı uygulamayı kurun',
    lead: 'Tek komut onu kullanıcı hesabınıza kurar. Yönetici izni gerekmez.',
    system: 'Sisteminiz',
    command: 'Kurulum komutu',
    terminal: {
      darwin: 'Terminal’i açın (Uygulamalar → İzlenceler), komutu yapıştırıp Return’e basın.',
      linux: 'Bir terminal açın (çoğu masaüstünde Ctrl+Alt+T), komutu yapıştırıp Enter’a basın.',
      windows: 'PowerShell’i açın (Başlat’a sağ tıklayıp Terminal’i seçin), komutu yapıştırıp Enter’a basın.',
    },
    waiting: 'Yardımcı uygulama bekleniyor… Komut bittikten birkaç saniye sonra burada görünür.',
    connected: (version) => `Yardımcı uygulama bağlandı (sürüm ${version}).`,
    whatTitle: 'Komut ne yapar?',
    what: [
      'GitHub’daki son sürümden sisteminize uygun programı indirir.',
      'SHA-256 sağlamasını denetler; tutmazsa durur.',
      'Programı yönetici izni olmadan kullanıcı klasörünüze kurar.',
      'Bu eklentinin ulaşabilmesi için onu Firefox, Chrome, Edge ve Brave’e kaydeder.',
    ],
  },
  tryIt: {
    title: 'Deneyin',
    lead: 'Her şeyin çalıştığını uydurma bir e-postayı düzelterek görün. Metin yalnızca seçtiğiniz sağlayıcıya gider; e-posta olarak hiçbir şey gönderilmez.',
    sampleLabel: 'Örnek e-posta',
    sample:
      'Merhaba Deniz,\n\nmesajın için teşekürler. Raporu perşembe gönderebilirim ama önce ekibinden son rakamlar lazım. Çarşambaya kadar paylaşabilirmisin?\n\nSevgiler,\nAlex',
    run: 'Örneği düzelt',
    running: 'Düzeltiliyor…',
    success: 'Her şey çalışıyor. Outlook’ta bir taslak açın; araç çubuğu taslağın yanında görünür.',
    resultLabel: 'Sonuç',
    openOutlook: 'Outlook’u aç',
    personalOutlook: 'Outlook.com (kişisel)',
    openSettings: 'Ayarlar',
  },
};
