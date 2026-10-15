import type { AiText } from '@email-writer/ui';

export const aiTr: AiText = {
  title: 'AI bağlantısı',
  description: 'E-postalarınızı ChatGPT planınızla veya kendi OpenAI API anahtarınızla hazırlayın.',
  chatgpt: 'ChatGPT üyeliği',
  apiKey: 'OpenAI API anahtarı',
  connect: 'Continue with ChatGPT',
  addAccount: 'Farklı hesap veya çalışma alanı ekle',
  reconnect: 'Yeniden bağlan',
  disconnect: 'Bağlantıyı kes',
  account: 'ChatGPT hesabı',
  activeAccount: 'Kullanımdaki hesap',
  useAccount: 'Bu hesabı kullan',
  savedConnection: 'Hesap bağlı. Üretimde kullanmak için Bu hesabı kullan’a basın.',
  renameAccount: 'Yeniden adlandır',
  accountName: 'Bağlantı adı',
  accountNameHint:
    'Örneğin Kişisel veya İş · Şirket adı. Ad yalnızca bu cihazda kullanılır; en fazla 80 karakter.',
  saveAccountName: 'Adı kaydet',
  removeAccount: 'Hesabı kaldır',
  removeAccountTitle: 'Bu bağlantı kaldırılsın mı?',
  removeAccountBody:
    'Bu cihazdaki hesap kaydı ve oturum bilgileri silinir; varsa oturumun OpenAI tarafında iptali denenir. Bekleyen giriş iptal edilir. Yeniden kullanmak için hesabı tekrar eklemeniz gerekir. ChatGPT hesabınız silinmez.',
  confirmRemoveAccount: 'Kaldır',
  savedAccountHint:
    'Listeden bir kayıt seçerek adını değiştirebilir veya kaldırabilirsiniz. Giriş düğmeleri seçili kaydın hesabını ve çalışma alanını kullanır. Başka bir hesap için aşağıdaki ekleme düğmesini kullanın.',
  model: 'Model',
  refresh: 'Yenile',
  checking: 'Bağlantı kontrol ediliyor…',
  signingIn: 'Tarayıcıda açılan ChatGPT girişini tamamlayın.',
  cancel: 'İptal',
  connected: 'Bağlı · Metin üretmeye hazır',
  disconnected: 'Oturum kapalı',
  registrationIncomplete:
    'Hesap bağlantısı tamamlanmadı; bu kaydın hesap bilgisi henüz doğrulanamadı. Continue with ChatGPT ile ilk denemedeki hesap ve çalışma alanını kullanarak yeniden deneyin.',
  generationUnavailable:
    'Hesap doğrulandı ve plan izni alındı; metin üretimi henüz hazır değil. Model listesini yeniden yüklemek için Yenile’ye basın.',
  planDisabled:
    'Hesap doğrulandı; üretim izni yok. Planla üretim için uygun bir Plus/Pro hesabı ve plan kullanım izni gerekir. Ücretsiz hesapla giriş yapmak üretim hakkı sağlamaz.',
  planNote:
    'Uygun Plus ve Pro hesapları plan limitlerini kullanabilir. Kullanılabilirlik hesabınıza, çalışma alanınıza ve OpenAI erişimine bağlıdır.',
  apiNote:
    'API kullanımı OpenAI tarafından ayrıca ücretlendirilir. ChatGPT aboneliğinden bağımsızdır; bu yönteme otomatik geçilmez.',
  apiKeyLabel: 'API anahtarı',
  saveKey: 'Anahtarı bağla',
  removeKey: 'Anahtarı kaldır',
  keySaved: 'API anahtarı yerel bağlantıda kayıtlı.',
  manageUsage: 'Kullanımı yönet',
  connectionHelp:
    'ChatGPT bağlantınızı Ayarlar → Security and login → Sign in with ChatGPT bölümünden yönetin. Bu bağlantı Plugins listesinde görünmez. İş hesabında kuruluş politikası ve plan uygunluğu ayrıca geçerlidir.',
  welcome: 'ChatGPT planınızı kullanıyorsunuz',
  welcomeBody:
    'Email Writer içindeki uygun üretimler ChatGPT planınızın veya kullanılabilir kredilerinizin limitlerini kullanır. Uygulamanın kullanımını ChatGPT ayarlarından yönetebilirsiniz.',
  gotIt: 'Anladım',
  privacy:
    'Üretim istediğinizde metniniz, talimatınız ve seçtiğiniz bağlam OpenAI’a gönderilir. Eklenti bunları diske kaydetmez. ChatGPT sohbet geçmişinize erişilmez.',
  setup: 'Yerel bağlantı kurulumu',
  setupBody:
    'ChatGPT bağlantısı için Email Writer yerel uygulaması gerekir (macOS / Linux, Node.js 22+). Projedeki docs/AI_BAGLANTISI.md rehberini izleyin. Hesap anahtarları tarayıcı yerine cihazınızdaki korumalı dosyada saklanır.',
  extensionId: 'Kurulum için eklenti kimliği:',
  usePlan: 'ChatGPT planı kullanılıyor',
  useApi: 'OpenAI API kullanılıyor',
  openSettings: 'AI ayarları',
  notReady: 'Üretim için AI hesabınızı bağlayın',
};
