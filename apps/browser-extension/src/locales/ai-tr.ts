import { PRODUCT_NAME } from '@email-writer/contracts';
import type { AiText } from '@email-writer/ui';

export const aiTr: AiText = {
  title: 'AI bağlantısı',
  description:
    'E-postalarınızı ChatGPT planınızla, kendi OpenAI API anahtarınızla veya bilgisayarınızdaki Claude Code ile hazırlayın.',
  chatgpt: 'ChatGPT üyeliği',
  apiKey: 'OpenAI API anahtarı',
  claudeCode: 'Claude aboneliği',
  methodHints: {
    chatgpt: 'Plus veya Pro planınızla',
    'api-key': 'Kullandıkça ödenir',
    'claude-code': 'Claude Code ile, bu bilgisayarda',
  },
  methodLabel: 'Bağlantı yöntemi',
  recommended: 'Önerilen',
  experimental: 'Deneysel',
  statusReady: 'Hazır',
  statusSetup: 'Kurulum gerekli',
  statusAction: 'Bağlantı gerekli',
  guide: {
    title: 'Bağlantı rehberi',
    intro:
      'Metin üretmek için aşağıdaki yöntemlerden birini kurun. Her yöntem için ne gerektiğini ve adımları buradan izleyebilirsiniz.',
    requirementsLabel: 'Gerekenler',
    stepsLabel: 'Adımlar',
    notesLabel: 'Bilmeniz gerekenler',
    current: 'Seçili',
    methods: {
      chatgpt: {
        title: 'ChatGPT üyeliği',
        summary: 'ChatGPT Plus veya Pro planınızın kullanım hakkıyla üretir.',
        requirements: [
          'ChatGPT Plus veya Pro aboneliği. Ücretsiz hesaplar plan kullanımını desteklemez.',
          `Bu bilgisayarda ${PRODUCT_NAME} yardımcı uygulaması.`,
        ],
        steps: [
          'Yöntem olarak ChatGPT üyeliği’ni seçin.',
          '“Continue with ChatGPT” düğmesine basın. Tarayıcıda açılan sayfada hesabınızı seçip izin verin.',
          'Bu sayfaya dönün; hesap “Bağlı · Metin üretmeye hazır” görünür. Ardından modeli seçin.',
        ],
        notes: [
          'Kullanım ChatGPT planınızın limitlerinden düşer. ChatGPT → Ayarlar → Usage bölümünden takip edebilirsiniz.',
          'Planınızı yeni yükselttiyseniz etkinleşmesi birkaç dakika sürebilir.',
          'OpenAI şu an yalnızca Plus ve Pro planlarını destekliyor. İş hesaplarında (Business, Enterprise) kuruluş politikası bağlantıyı engelleyebilir.',
          'Erişimi istediğiniz zaman ChatGPT → Ayarlar → Security and login → Sign in with ChatGPT bölümünden kaldırabilirsiniz.',
        ],
      },
      'api-key': {
        title: 'OpenAI API anahtarı',
        summary: 'Kendi OpenAI Platform hesabınızla, kullandığınız kadar ödeyerek üretir.',
        requirements: [
          'OpenAI Platform hesabı ve bir API anahtarı.',
          `Bu bilgisayarda ${PRODUCT_NAME} yardımcı uygulaması.`,
        ],
        steps: [
          'OpenAI Platform’da bir API anahtarı oluşturun.',
          'Yöntem olarak OpenAI API anahtarı’nı seçin, anahtarı yapıştırıp “Anahtarı bağla”ya basın.',
          'Listeden modeli seçin.',
        ],
        notes: [
          'API kullanımı ChatGPT aboneliğinden ayrıdır ve OpenAI tarafından ücretlendirilir.',
          'Anahtar yalnızca bu bilgisayardaki yardımcı uygulamada saklanır; tarayıcıya geri gönderilmez.',
        ],
        linkLabel: 'API anahtarı oluştur',
      },
      'claude-code': {
        title: 'Claude aboneliği',
        summary: 'Bilgisayarınızdaki Claude Code’u kendi Claude hesabınızla kullanır.',
        requirements: [
          'Claude Pro, Max, Team veya Enterprise aboneliği.',
          'Bu bilgisayarda kurulu ve Claude hesabınızla oturum açılmış Claude Code.',
          `${PRODUCT_NAME} yardımcı uygulaması. Claude Code’dan sonra kurulursa Claude Code’u kendiliğinden bulur.`,
        ],
        steps: [
          'Claude Code’u Anthropic’in resmî kurulum adımlarıyla kurun.',
          'Terminalde `claude` yazın ve `/login` ile Claude hesabınıza giriş yapın.',
          'Yardımcı uygulamayı kurun; daha önce kurduysanız Claude Code’dan sonra yeniden kurun.',
          'Yöntem olarak Claude aboneliği’ni seçin. Hesabınız ve planınız burada görünür.',
        ],
        notes: [
          `${PRODUCT_NAME} Claude şifrenizi veya oturum bilgilerinizi görmez ve saklamaz; giriş ve çıkış Claude Code üzerinden yapılır.`,
          'Kullanım, Claude Code ile ortak olan plan limitinizden düşer.',
          'Pro ve Max planlarında Claude gizlilik ayarlarından model eğitimini kapatmadıysanız içerik eğitimde kullanılabilir. Team ve Enterprise planları ticari koşullara tabidir.',
          'Claude Code bir API anahtarıyla oturum açmışsa kullanım o API hesabından ücretlendirilir.',
          'Bu yöntem Anthropic’in üçüncü taraf uygulama kurallarına bağlıdır ve deneysel olarak sunulur. Kurallar değişirse kullanılamayabilir.',
        ],
        linkLabel: 'Claude Code kurulum rehberi',
      },
    },
    helper: {
      title: 'Yardımcı uygulama nedir?',
      summary: 'Bütün yöntemler için gereken, bilgisayarınızda çalışan küçük bir uygulama.',
      requirements: ['macOS, Linux veya Windows. Başka bir yazılım gerekmez.'],
      steps: [
        'Ayarlar → Yardımcı uygulama bölümünden kurulum sihirbazını açın ve gösterdiği tek satırlık komutu çalıştırın.',
        'Yardımcı uygulama birkaç saniye içinde bağlı görünür; ardından burada bir yöntem seçin.',
      ],
      notes: [
        'Giriş bilgileri ve API anahtarları tarayıcıda değil, yalnızca sizin erişebildiğiniz korumalı bir dosyada tutulur.',
        'Yardımcı uygulama yalnızca siz üretim istediğinizde çalışır; arka planda e-posta okumaz veya göndermez.',
      ],
    },
  },
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
  claudeNote: `Bilgisayarınızda kurulu Claude Code, kendi Claude hesabınızla çalıştırılır; kullanım Claude planınızın limitlerinden düşer. ${PRODUCT_NAME} Claude hesap bilgilerinize erişmez ve bunları saklamaz. Giriş ve çıkış Claude Code üzerinden yapılır.`,
  claudeAccount: 'Claude Code hesabı',
  claudeNotInstalled:
    'Claude Code bu bilgisayarda bulunamadı. Claude Code’u kurun, ardından yardımcı uygulamanın kurulum komutunu yeniden çalıştırıp Yenile’ye basın.',
  claudeNotLoggedIn:
    'Claude Code’da oturum açık değil. Terminalde claude komutunu çalıştırıp /login ile giriş yapın, ardından Yenile’ye basın.',
  claudeApiBilling:
    'Claude Code şu an Claude aboneliği yerine API anahtarı gibi başka bir yöntemle oturum açmış; kullanım o hesaptan ücretlendirilir.',
  claudePrivacy:
    'Üretim istediğinizde metniniz, talimatınız ve seçtiğiniz bağlam Claude Code üzerinden Anthropic’e gönderilir. Claude Code araçsız çalışır, dosyalarınıza erişmez ve oturum kaydı tutmaz. Pro ve Max planları Anthropic’in tüketici koşullarına tabidir: Claude gizlilik ayarlarından model eğitimini kapatmadıysanız içerik eğitimde kullanılabilir. Team ve Enterprise planları ticari koşullara tabidir.',
  apiKeyLabel: 'API anahtarı',
  saveKey: 'Anahtarı bağla',
  removeKey: 'Anahtarı kaldır',
  keySaved: 'API anahtarı yardımcı uygulamada kayıtlı.',
  manageUsage: 'Kullanımı yönet',
  connectionHelp:
    'ChatGPT bağlantınızı Ayarlar → Security and login → Sign in with ChatGPT bölümünden yönetin. Bu bağlantı Plugins listesinde görünmez. İş hesabında kuruluş politikası ve plan uygunluğu ayrıca geçerlidir.',
  welcome: 'ChatGPT planınızı kullanıyorsunuz',
  welcomeBody: `${PRODUCT_NAME} içindeki uygun üretimler ChatGPT planınızın veya kullanılabilir kredilerinizin limitlerini kullanır. Uygulamanın kullanımını ChatGPT ayarlarından yönetebilirsiniz.`,
  gotIt: 'Anladım',
  privacy:
    'Üretim istediğinizde metniniz, talimatınız ve seçtiğiniz bağlam OpenAI’a gönderilir. Eklenti bunları diske kaydetmez. ChatGPT sohbet geçmişinize erişilmez.',
  usePlan: 'ChatGPT planı kullanılıyor',
  useApi: 'OpenAI API kullanılıyor',
  useClaude: 'Claude aboneliği kullanılıyor',
  openSettings: 'AI ayarları',
  notReady: 'Üretim için AI hesabınızı bağlayın',
};
