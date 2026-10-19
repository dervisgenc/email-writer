# AI bağlantısı: ChatGPT, OpenAI API ve Claude Code

Son kontrol: 16 Ekim 2026. Entegrasyon, OpenAI'ın belgelenmiş **Sign in with ChatGPT / ChatGPT plan usage** akışını kullanır. Eklenti ChatGPT çerezlerini veya başka bir uygulamanın oturum dosyasını okumaz; özel `backend-api` uçlarına bağlanmaz.

## Kapsam ve erişim koşulları

Uygun ChatGPT Plus/Pro hesapları, izin verdikleri uygulamada kendi plan limitlerini veya kullanılabilir kredilerini kullanabilir. Kimlikle giriş yapmak tek başına üretim izni değildir: token yanıtında `chatgpt.tokens.use.direct` kapsamı aranır. Kullanım hesabın ve çalışma alanının erişimine tabidir.

Ücretsiz kişisel hesapla giriş/izin e-postası alınması, üyelik kotasıyla metin üretilebildiği anlamına gelmez. Business Premium veya başka bir iş planının bu OSS akışına uygun olduğu varsayılmaz; yönetici olmak kuruluş politikasını veya ürünün plan uygunluğunu kendiliğinden değiştirmez. [Güncel kullanıcı kapsamı ve bağlantı ayarları](https://learn.chatgpt.com/docs/sign-in-with-chatgpt).

OpenAI bu akışı açık kaynak ve yerelde çalışan uygulamalar için belgeliyor. Özel/ticari veya uzakta barındırılan dağıtımlar için ayrıca uygunluk/erişim gerekebilir. Reponun ileride açık kaynak yapılacak olması, bugünkü özel dağıtımın otomatik onaylandığı anlamına gelmez. Bu değişiklik repoyu yayımlamaz veya lisans belirlemez. [Kapsam](https://developers.openai.com/siwc/token-sharing-open-source), [erişim durumu](https://developers.openai.com/siwc/quickstart).

## Neden yerel uygulama gerekiyor?

Belgelenen OSS OAuth dönüşü `http://127.0.0.1:<port>/auth/callback` adresidir. Access/refresh/ID token'ları tarayıcı depolamasında tutulmamalıdır. Bir tarayıcı eklentisi port dinleyemez ve program çalıştıramaz; bu yüzden küçük bir native messaging uygulaması (Writehand yardımcı uygulaması) kullanılır. Tarayıcı bu süreci ihtiyaç duyulduğunda başlatır; sürekli açık bir HTTP üretim servisi bulunmaz. Yalnızca giriş sırasında, rastgele bir loopback portunda beş dakika süreli OAuth dinleyicisi açılır. İleride eklenecek API sağlayıcılarının anahtarları da yardımcı uygulamada kalır, tarayıcıya taşınmaz. [Giriş protokolü](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [oturum güvenliği](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions).

Yardımcı uygulama, Node.js gerektirmeyen **tek bir programdır** (Node.js tek dosyalık uygulama, SEA). macOS (Apple Silicon ve Intel), Linux (x64, arm64) ve Windows (x64; Arm'lı Windows'ta öykünmeyle) için her sürümde derlenir. Windows desteği 16 Ekim 2026'da Windows 11'de Chrome, Edge, Brave ve Firefox ile doğrulandı (aşağıda "Windows'ta kurulum").

## Yardımcı uygulamanın kurulumu

Kullanıcı, eklentinin karşılama sihirbazında (ilk kurulumda açılır; **Ayarlar → Yardımcı uygulama → Kurulum sihirbazını aç**) gösterilen tek satırlık komutu çalıştırır:

```sh
curl -fsSL https://github.com/dervisgenc/email-writer/releases/latest/download/install.sh | sh
```

```powershell
irm https://github.com/dervisgenc/email-writer/releases/latest/download/install.ps1 | iex
```

Betik sistemi ve işlemciyi algılar, son sürümden uygun arşivi ve `SHA256SUMS`'ı indirir, SHA-256'yı karşılaştırır (tutmazsa hiçbir şey kurmadan durur), programı geçici klasörde açar ve `writehand install` ile kendini kurmasını sağlar. Yönetici izni istenmez. `curl` ve `Invoke-WebRequest` ile indirilen dosyalara karantina (macOS) veya Mark-of-the-Web (Windows) işareti konmadığından program uyarısız başlar; macOS programı ücretsiz ad-hoc imzalıdır (Apple Silicon imzasız program çalıştırmaz).

Mağaza kimliği yardımcı uygulamaya henüz yazılmamış bir Chromium eklentisinde (ör. paketlenmemiş geliştirme derlemesi) sihirbaz kimliği komuta kendisi ekler: `… | sh -s -- --extension-id=KIMLIK`, PowerShell'de `$env:WRITEHAND_EXTENSION_ID='KIMLIK'; irm … | iex`.

**Program komutları** (kurulu program: macOS/Linux `~/.local/share/writehand/writehand`, Windows `%LOCALAPPDATA%\Programs\writehand\writehand.exe`):

| Komut | Ne yapar |
| --- | --- |
| *(komutsuz veya tarayıcının argümanlarıyla)* | Native messaging host olarak çalışır. Terminalde komutsuz çalıştırılırsa yardım gösterir. |
| `install [--extension-id=ID]... [--dev]` | Çalışan programı kurulum klasörüne kopyalar; Firefox, Chrome, Edge ve Brave'i tek seferde kaydeder; `config.json`'u yazar. Firefox yerleşik kimliği kullanır; Chromium tarayıcıları bir kimlik bilindiğinde (mağaza kimlikleri veya `--extension-id`) kaydedilir. Önceki kayıtlardaki kimlikler korunur. |
| `uninstall [--delete-data]` | Bütün tarayıcı kayıtlarını ve programı siler. `--delete-data` ChatGPT oturumlarını iptal etmeyi dener ve kimlik bilgilerini siler. |
| `status` | Sürüm, sistem, kayıtlı tarayıcılar ve Claude Code'un hazır olup olmadığı. Hesap veya token bilgisi yazdırılmaz. |
| `update [--check]` | Daha yeni sürüm varsa imzasını ve sağlamasını doğrulayıp kurar; `--check` yalnızca denetler. |
| `version` | Sürümü yazar. |

Kaldırma için betikler de kullanılabilir: `curl -fsSL …/install.sh | sh -s -- uninstall` veya `& ([scriptblock]::Create((irm …/install.ps1))) -Uninstall` (sonuna `--delete-data` / `-DeleteData`).

| | macOS / Linux | Windows |
| --- | --- | --- |
| Program | `~/.local/share/writehand/writehand` | `%LOCALAPPDATA%\Programs\writehand\writehand.exe` |
| Kurulumda kaydedilen ayarlar | Programın yanında `config.json` | Programın yanında `config.json` |
| Tarayıcı manifesti | Tarayıcının `NativeMessagingHosts` klasöründe `com.dervisgenc.writehand.json` | Program klasöründe `com.dervisgenc.writehand.<tarayıcı>.json` |
| Tarayıcının manifesti bulması | Klasörün kendisi | `HKCU\Software\<konum>\NativeMessagingHosts\com.dervisgenc.writehand` anahtarının varsayılan değeri |
| Kimlik bilgileri | `~/.config/writehand/` (dizin `0700`, dosya `0600`) | `%LOCALAPPDATA%\writehand\` (yalnızca kullanıcı ve SYSTEM erişebilir) |

**Başlatıcı yoktur:** manifest doğrudan programı gösterir. Tarayıcı programı kısıtlı bir ortamla başlattığı için kurulum, terminalde bulunanları `config.json`'a yazar: Claude Code'un yolu, `CLAUDE_CONFIG_DIR` ve npm ile kurulmuş Claude Code için `node` klasörü. Host başlarken bunları kendi ortamına ekler; `USER` yoksa `os.userInfo()` kullanılır (macOS'ta Claude Code anahtar zinciri girişini kullanıcı adıyla bulur). Bozuk veya daha yeni bir sürümün yazdığı `config.json` varsayılanlara döner; host her durumda başlar.

İşletim sistemi farklarının tamamı `apps/ai-companion/src/platform.ts` içindedir (ESLint başka yerde `process.platform`'u reddeder). Kurulum saf bir plandan (`install-plan.ts`, `host-config.ts`) ve bunu uygulayan ince katmandan (`install.ts`) oluşur; her sistemin planı her makinede birim testle sınanır.

**İzin:** Eklentide `nativeMessaging` isteğe bağlı izindir; kurulumda "yerel uygulamalarla iletişim" uyarısı çıkmaz. Karşılama sihirbazının 2. adımı izni bir düğmeyle ister. İzin yokken tarayıcı `connectNative`'i sunmaz ve arka plan yardımcı uygulamayı "bağlı değil" bildirir.

### Geliştirici kurulumu

Kaynak koddan geliştirirken aynı kurulum kodu Node.js ile çalışır:

```sh
pnpm install
pnpm ai:build                                  # apps/ai-companion/dist/cli.mjs
pnpm ai:install                                # = node dist/cli.mjs install --dev
pnpm ai:install --extension-id=EKLENTI_KIMLIGI # paketlenmemiş Chromium derlemesi için
```

Geliştirme kurulumu betiği (`cli.mjs`) kopyalar ve onu Node.js ile çalıştıran küçük bir başlatıcı yazar (macOS/Linux `writehand` sh betiği, Windows `writehand.cmd`); `config.json`'da `development: true` olarak işaretlenir ve kendini **güncellemez**. Kaldırmak için kurulu programın `uninstall` komutu kullanılır. Firefox geliştirme ve mağaza kimliği aynıdır (`writehand@dervisgenc.com`). Paketlenmemiş Chromium eklentisinin kimliği klasör yolundan türetilir; `.output/chrome-mv3`, `-dev`, `-test` klasörleri farklı kimlik alır. Chrome 137 ve sonrası `--load-extension` komut satırı bayrağını yok sayar: paketlenmemiş eklentiyi `chrome://extensions` → Geliştirici modu → Paketlenmemiş öğe yükle ile yükleyin.

### Windows'ta kurulum

| Tarayıcı | Kayıt anahtarı (`HKCU\Software\…\NativeMessagingHosts`) | Not |
| --- | --- | --- |
| Chrome | `Google\Chrome` | |
| Edge | `Microsoft\Edge` | Kendi anahtarı yoksa Chromium, sonra Chrome anahtarına bakar ([Microsoft](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/native-messaging)). |
| Brave | `Chromium` | Resmî belge yok. Gerçek denemede (Brave 1.97) Brave önce `Chromium`, sonra `Google\Chrome` anahtarını okudu ve ilk bulduğu manifestte durdu; `BraveSoftware\Brave-Browser` anahtarını okumadı. `Chromium` anahtarı Chrome kaydıyla çakışmaz. |
| Firefox | `Mozilla` | |
| Opera | Kurucuda yok | Opera 137 de önce `Chromium`, sonra `Google\Chrome` anahtarını okur (gerçek deneme), kendi anahtarını okumaz. Mağaza kimlikleri sabitlendiğinde aynı manifest Chrome, Brave ve Opera'yı birlikte karşılar. |

Kararlar ve gerekçeleri:

- **Konumlar:** Program `%LOCALAPPDATA%\Programs\` altındadır; bu, Windows'un kullanıcıya özel program klasörüdür (yönetici izni gerekmez). Kimlik bilgileri `%APPDATA%` (Roaming) yerine `%LOCALAPPDATA%` altındadır: dolaşan profillerde token'lar sunucuya ve başka bilgisayarlara kopyalanmaz, iki bilgisayar aynı refresh token'ı döndürmeye çalışmaz.
- **İzinler:** Windows'ta `chmod` etkisizdir. Profil klasörünün varsayılan izni (`icacls`) kullanıcı, SYSTEM ve Administrators'tır; bu tek başına diğer kullanıcılara kapalıdır. Yine de kimlik klasörü ilk oluşturulduğunda `icacls` ile devralma kaldırılır ve yalnızca kullanıcı ile SYSTEM tam yetkili kalır; dosyalar bu izni devralır. Kısıtlama yapılamazsa klasör silinir ve sır yazılmaz. Kontrol: `icacls "%LOCALAPPDATA%\writehand"`.
- **Kilit ve atomik yazım:** Aynı `proper-lockfile` kilidi ve geçici dosya + yeniden adlandırma kullanılır. Windows'ta virüs tarayıcısı veya arama dizini yeni yazılan dosyayı kısa süre tutabildiği için değiştirme birkaç kez (toplam ~1,5 sn) yeniden denenir.
- **Çalışan programın değiştirilmesi:** Windows çalışan bir `.exe`'yi silemez ama yeniden adlandırabilir. Kurulum ve güncelleme çalışan programı önce `writehand.exe.<rastgele>.old` adıyla kenara alır, yenisini yerine koyar; kenara alınan kopya yardımcı uygulama bir sonraki başladığında silinir. `uninstall` kendi klasörünü, program kapandıktan sonra çalışan gizli bir Windows PowerShell süreciyle siler. Node, başlattığı süreçleri kendisi kapanınca sonlandırdığı (libuv'un iş nesnesi) ve `detached` süreçlere konsol vermediği için önce kısa ömürlü gizli bir PowerShell başlatılır; o da silmeyi `Start-Process -WindowStyle Hidden` ile ayrı bir süreç olarak başlatır. Betik `-EncodedCommand` ile, klasör yolu ve süreç kimliği ortam değişkeniyle verilir; hiçbir yol komut satırı olarak ayrıştırılmaz. PowerShell 7'den başlatılan Windows PowerShell'e PowerShell 7'nin `PSModulePath`'i aktarılmaz (aksi hâlde kendi modüllerini yükleyemez).
- **Geliştirme başlatıcısı (`.cmd`):** Yalnızca `--dev` kurulumunda vardır. `cmd.exe` toplu iş dosyalarını konsol kod sayfasıyla (ör. 437) okuduğu için dosya UTF-8 yazılır ve `chcp 65001` ile başlar; yollardaki `%` kaçışlanır.
- **Tarayıcı açma:** `rundll32.exe url.dll,FileProtocolHandler <URL>`, kabuk olmadan; URL tek argümandır ve `&` korunur. Yalnızca `https://` adresleri açılır (bu yöntem yerel dosyaları da başlatabilir). Windows araçları (`reg`, `icacls`, `whoami`, `rundll32`, `tar`, `powershell`) PATH'ten değil `%SystemRoot%\System32` altındaki tam yollarıyla çağrılır.

Bilinen sınırlar: Chrome ve Edge, `.exe` olsa bile hostu `cmd.exe /d /s /c` ile başlatır; `cmd.exe` yoldaki `%AD%` biçimindeki parçaları ortam değişkeni olarak açar. Geliştirme başlatıcısında Firefox `.cmd` yolunu yalnızca boşluk içeriyorsa tırnaklar; kullanıcı klasörü boşluksuz ve `&` veya `^` içeriyorsa Firefox başlatıcıyı başlatamaz. Grup ilkesi (`NativeMessagingUserLevelHosts`) kullanıcı düzeyindeki hostları kapatabilir; bu durumda yönetici kurulumu gerekir ve desteklenmez.

### Güncellemeler

Yardımcı uygulama en son yayımlanmış sürümü GitHub API'sinden (`releases/latest`) günde en fazla bir kez öğrenir ve cevabı programın yanında (`update-check.json`) saklar. İstek yalnızca sürüm numarasını alır; e-posta veya hesap bilgisi taşımaz. Ayarlardaki **Güncellemeleri denetle** anahtarı (varsayılan açık) kapalıysa eklenti bu denetimi hiç istemez.

**Güncelle** düğmesi (`HOST_UPDATE`, yalnızca eklentinin kendi sayfalarından kabul edilir) şunları yapar: o sürümün `SHA256SUMS`, `SHA256SUMS.sig` ve sisteme uygun arşivini **yalnızca bu deponun** sürüm adresinden indirir; imzayı programın içindeki Ed25519 açık anahtarla (`apps/ai-companion/release-key.json`, `node:crypto`) ve arşivin SHA-256'sını doğrular; açılan programın bildirdiği sürümün sürüm adıyla aynı olduğunu denetler; yeni programın `install` komutunu çalıştırır. Yeni program aynı ortamı devraldığı için Claude Code ayarlarını yeniden kaydeder ve tarayıcı kayıtlarını mevcut eklenti kimlikleriyle yeniler. Yanıttan sonra eski host kapanır; tarayıcının sonraki isteği yeni programı başlatır. Doğrulanamayan sürüm kurulmaz (`HOST_UPDATE_UNVERIFIED`).

Eklentinin kendi güncellemeleri mağazalardan gelir. Sürüm uyumu kuralı: [Geliştirici rehberi → Sürümleme ve yayın](./GELISTIRICI_REHBERI.md#sürümleme-ve-yayın).

## ChatGPT ile bağlanma

1. Eklentinin **Ayarlar → AI bağlantısı** bölümünü açın.
2. **Continue with ChatGPT** düğmesine basın. Sistem tarayıcısında hesabınızı/çalışma alanınızı seçin ve plan kullanımına izin verin.
3. Ayarlarda bağlı hesabı ve o hesap için OpenAI'dan alınan modelleri görün. İlk bağlantıda plan kullanımı bildirimi çıkar.
4. Modeli seçin. Outlook'ta bir taslağı **Düzelt**, **Çevir**, **Yanıt yaz** veya **Yaz** ile işleyin. Sonuç önce önizlemededir; gönderme işlemi kullanıcıda kalır.

**Hesap/çalışma alanı değiştirme:** Kayıtlı hesabın **Continue with ChatGPT / Yeniden bağlan** düğmesi, aynı kullanıcı ve çalışma alanına bağlı uygulama kaydını sürdürür. Kişisel hesaptan Business hesabına veya başka bir çalışma alanına geçerken **Farklı hesap veya çalışma alanı ekle** kullanın; OpenAI ekranında hedef hesabı/çalışma alanını seçin. Bu işlem önceki kaydın kimlik ipuçlarını kullanmaz, mevcut hesapları silmez ve yeni kimlik doğrulanmadan etkin hesabı değiştirmez. Önceki deneme bir OpenAI hata sayfasında bekliyorsa yeni hesap düğmesi o denemeyi iptal edip yeni kayıt akışını başlatır. [OpenAI hesap ve kayıt sınırları](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions).

`pnpm dev`, `pnpm dev:firefox` ve `pnpm outlook:dev` gerçek AI bağlantısını kullanır. **Yalnızca `pnpm build:test`** sabit örnek sonuç üretir. Test paketini canlı üretim denemesi için kullanmayın. Chromium geliştirme/test/üretim klasörleri farklı eklenti kimlikleri alabilir; kurduğunuz kimliğin kullandığınız paketle aynı olduğunu kontrol edin.

## Hesapları adlandırma ve kaldırma

**Ayarlar → AI bağlantısı** listesinden bir kayıt seçmek giriş başlatmaz veya üretimdeki hesabı değiştirmez. Başka bir bağlı hesabı etkinleştirmek için **Bu hesabı kullan** düğmesine basın. Kullanımdaki hesap ayrıca gösterilir.

- **Yeniden adlandır** ile `Kişisel` veya `İş · Şirket adı` gibi, bu cihazda kullanılan bir ad verin. Ad 1–80 karakter olmalı ve başka bir bağlantıyla aynı olmamalıdır. Elle verilen ad yeniden girişte korunur.
- İlk doğrulanmış girişte profil adı, yoksa e-posta kullanılır. Aynı adlı kayıtlar `(2)`, `(3)` gibi eklerle ayrılır. Kimliği doğrulanmamış kayıtlarda `ChatGPT` kullanılır; şirket/çalışma alanı adı e-postadan tahmin edilmez. Eski `ChatGPT 1` türü varsayılan adlar başarılı yeniden girişte güncellenir.
- **Hesabı kaldır**, onaydan sonra seçili bağlantı kaydını ve token'larını bu cihazdan siler. Yarım kalmış kayıtlar da kaldırılabilir. Bekleyen giriş iptal edilir; geç gelen OAuth yanıtı kaldırılan hesabı yeniden oluşturamaz. Etkin hesap kaldırılırsa başka hesaba veya API anahtarına otomatik geçilmez.
- Varsa yenilenebilir oturumu OpenAI'da iptal etme isteği gönderilir. Sunucu iptali doğrulanamazsa uyarı gösterilir; yerel kayıt yine kaldırılır. **Bağlantıyı kes** ise token'ları temizlerken adı ve uygulama kaydını yeniden giriş için saklar.

Bu işlemler ChatGPT hesabını veya OpenAI tarafındaki uygulama kaydını silmez. Hesabı kaldırdıktan sonra yeniden bağlamak yeni kayıt akışını gerektirir. Diğer tarayıcılar da aynı cihazdaki credential deposunu kullanıyorsa kaldırma onlara da yansır. [OpenAI oturum ve kayıt ayrımı](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions).

## API anahtarı seçeneği

Aynı ayarlar ekranında **OpenAI API anahtarı** seçilebilir. Anahtar, yalnızca eklentinin kendi ayarlar sayfasından yerel uygulamaya iletilir; giriş alanı hemen temizlenir ve kaydedilen anahtar arayüze geri dönmez. Bağlantı model listesi okunarak denetlenir; bu adım metin üretmez. Modeli kullanıcı seçer. Model listesinde görünen bir API modelinin Responses API'yi desteklemesi ayrıca OpenAI'a bağlıdır; reddedilirse başka bir model seçin.

API ücretlendirmesi ChatGPT aboneliğinden ayrıdır. Limit/erişim hatası bir yöntemi diğerine otomatik geçirmez. İstekler hata halinde kendiliğinden tekrarlanmaz. [Model ve üretim protokolü](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference).

## Claude aboneliği (bilgisayardaki Claude Code)

Bu yöntem, kullanıcının bilgisayarında kurulu ve **değiştirilmemiş** Claude Code'u yazdırma modunda (`claude -p`) çalıştırır. Claude girişi yalnızca Claude Code'un kendi akışıyla yapılır (terminalde `claude` → `/login`). Writehand Claude hesap bilgilerini veya oturum token'larını okumaz, saklamaz ve aracılık etmez; giriş durumunu yalnızca `claude auth status --json` çıktısından öğrenir. Kullanım, Claude planının (Claude Code ile ortak) limitlerinden düşer.

**Kural dayanağı (16 Ekim 2026'da okundu):**

- Destek makalesi: "You can still use the Claude Agent SDK, `claude -p`, and third-party apps with your subscription limits." ([kaynak](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan))
- Geliştiriciler için kurallar: ürün geliştirenler API anahtarı kullanmalı; uygulamalar kendi içinde Claude.ai girişi sunamaz, Free/Pro/Max planları üzerinden kullanıcılar adına istek yönlendiremez, Claude kimlik bilgilerini toplayamaz/saklayamaz. İstisna olarak son kullanıcı, değiştirilmemiş Claude Code'a kendi aboneliğiyle giriş yapabilir. Anthropic bu kuralları önceden haber vermeden uygulayabilir. ([kaynak](https://code.claude.com/docs/en/legal-and-compliance))
- Dağıtılan bir uygulamanın kullanıcının kendi Claude Code'unu çalıştırması bu sayfalarda açıkça ele alınmıyor. Bu yöntem varsayılan değildir, kullanıcı ayarlardan kendisi seçer. Herkese açık yayından önce Anthropic'ten yazılı teyit alınmalıdır. Ürün adında "Claude Code" kullanılmaz.
- Max ve Team planlarının aylık API kredileri ([kaynak](https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-and-team-plans)) yalnızca bağlı Console organizasyonunun API anahtarıyla harcanır. Claude Code planla oturum açmışken bu krediler kullanılmaz.

**Güvenlik:** E-posta güvenilmeyen girdidir; Claude Code ise komut çalıştırabilen bir ajandır. Bu yüzden her üretim şu ayarlarla çalışır (`packages/ai-claude-code/src/provider.ts`):

| Ayar | Neden |
| --- | --- |
| `--tools ""`, `--restricted` | Hiçbir araç yok: komut çalıştırma, dosya okuma/yazma ve web erişimi kapalı. |
| `--restricted`, `--strict-mcp-config`, `--disable-slash-commands` | Kullanıcı/proje ayarları (hook'lar dahil), MCP sunucuları ve skill'ler yüklenmez. |
| `--no-session-persistence` | E-posta metni Claude Code'un oturum kayıtlarına yazılmaz. |
| `--system-prompt` | Claude Code'un kodlama talimatı yerine e-posta istemi (`buildTaskPrompt` sistem talimatı) kullanılır. |
| İstem stdin'den, boş geçici klasör | E-posta metni süreç listesinde görünmez; proje dosyası veya `CLAUDE.md` erişilebilir değildir. Klasör iş bitince silinir. |

stderr okunmaz; sonuç yalnızca `subtype: success` ve `stop_reason` `max_tokens` değilken kabul edilir. Hata mesajı kullanıcıya aktarılmaz, kararlı koda çevrilir. Üretim en fazla 120 saniye sürer; iptal edilen istek süreci sonlandırır.

**Gizlilik:** Üretim istendiğinde metin, talimat ve seçilen bağlam Claude Code üzerinden Anthropic'e gider. Pro ve Max planları Anthropic tüketici koşullarına tabidir: Claude gizlilik ayarlarında model eğitimi kapatılmadıysa içerik eğitimde kullanılabilir. Team ve Enterprise planları ticari koşullara tabidir.

**Kurulum:**

1. Claude Code'u kurun ve terminalde `claude` → `/login` ile giriş yapın.
2. Yardımcı uygulamanın kurulum komutunu Claude Code'u kullandığınız terminalde çalıştırın (Claude Code sonradan kurulduysa komutu yeniden çalıştırın). Kurucu `claude` yolunu, varsa `CLAUDE_CONFIG_DIR` değerini ve `node` klasörünü `config.json`'a yazar. Tarayıcı yardımcı uygulamayı kısıtlı bir ortamla başlattığı için bu gereklidir.
3. **Ayarlar → AI bağlantısı → Claude aboneliği**. Ekranda Claude Code hesabı, kuruluş ve plan görünür.
4. Model: **Claude Sonnet** (varsayılan) veya **Claude Opus**.

**Claude Code'un bulunması:** Sıra: kurulumda kaydedilen yol (`config.json` → `WRITEHAND_CLAUDE_PATH`), `PATH`, olağan kurulum yerleri. macOS/Linux'ta `~/.local/bin/claude`, `~/.claude/local/claude`, `/opt/homebrew/bin/claude`, `/usr/local/bin/claude`. Windows'ta `PATH` içinde yalnızca `claude.exe` ve `claude.cmd` aranır, ardından `%USERPROFILE%\.local\bin\claude.exe` (Anthropic'in yerel kurucusu), `%LOCALAPPDATA%\Microsoft\WinGet\Links\claude.exe` (WinGet) ve `%APPDATA%\npm\claude.cmd` (npm) denenir. Komut betikleri (`.cmd`, `.bat`) hiçbir zaman kabuk üzerinden çalıştırılmaz (`shell: true` yok): `cmd.exe` sistem talimatı argümanını yeniden yorumlardı. npm'in `claude.cmd`'si, yanındaki `node_modules\@anthropic-ai\claude-code\package.json` okunarak paketin `bin\claude.exe` programına çevrilir ve program doğrudan başlatılır. Çözülemeyen bir betik (ör. pnpm veya Yarn ile genel kurulum, kurulum betiği çalışmamış npm paketi) `AI_CLAUDE_UNSUPPORTED_INSTALL` olarak bildirilir; daha sonraki bir konumda gerçek program varsa o kullanılır.

**Komut satırı uzunluğu:** E-posta metni ve bağlam stdin'den gider. Argüman olarak yalnızca sabit sistem talimatı verilir; en uzun hali yaklaşık 3.500 karakterdir, Windows'un `CreateProcess` sınırı 32.767'dir (birim testi 16.000'in altında kaldığını denetler). Kabuk kullanılmadığı için `cmd.exe`'nin 8.191 sınırı geçerli değildir. Claude Code bu adları güncel modele çözer. Claude Haiku sunulmaz: 16 Ekim 2026 denemelerinde Türkçe yanıtlarda harf tekrarı ("bbana", "bbizim") üretti; önceden Haiku seçilmişse Sonnet kullanılır.

| Sorun | Yapılacak işlem |
| --- | --- |
| `AI_CLAUDE_NOT_INSTALLED` | Claude Code bulunamadı. Claude Code'u kurduktan sonra yardımcı uygulamanın kurulum komutunu yeniden çalıştırın; ardından ayarlarda Yenile. |
| `AI_CLAUDE_UNSUPPORTED_INSTALL` | Claude Code yalnızca kabuksuz başlatılamayan bir komut betiği (`claude.cmd`) olarak bulundu. Claude Code'u Anthropic'in yerel kurucusuyla (`irm https://claude.ai/install.ps1 \| iex`), WinGet ile veya npm ile kurun; ardından yardımcı uygulamanın kurulum komutunu yeniden çalıştırın ve ayarlarda Yenile'ye basın. |
| `AI_CLAUDE_NOT_LOGGED_IN` | Terminalde `claude` → `/login`. Birden fazla Claude yapılandırması kullanıyorsanız (`CLAUDE_CONFIG_DIR`), kurulum komutunu doğru yapılandırmanın açık olduğu terminalde yeniden çalıştırın. |
| "API anahtarı gibi başka bir yöntemle oturum açmış" uyarısı | Claude Code aboneliğiniz yerine API anahtarıyla çalışıyor; kullanım o hesaptan ücretlendirilir. |
| `AI_LIMIT_REACHED` | Claude planının limiti doldu; limit Claude Code kullanımınızla ortaktır. Limit yenilenince tekrar deneyin. |

## Ayarlardaki bağlantı rehberi

Son kullanıcı için gerekenler ve adımlar eklentinin **Ayarlar → Bağlantı rehberi** kartında, her yöntem için ayrı bölümde yer alır: Gerekenler, Adımlar ve Bilmeniz gerekenler (ChatGPT üyeliği, OpenAI API anahtarı, Claude aboneliği, yardımcı uygulama). Seçili yöntemin bölümü açık gelir. Metinler `apps/browser-extension/src/locales/ai-<dil>.ts` içindeki `guide` alanındadır; resmî bağlantılar `contracts` sabitlerinden gelir. Yardımcı uygulama kartının ve karşılama sihirbazının metinleri `helper-<dil>.ts` ve `welcome-<dil>.ts` dosyalarındadır. Kullanıcı metinlerinde geliştirici talimatı (`pnpm`, `docs/`, eklenti kimliği) bulunmaz; bir test bunu denetler.

## Dağıtım öncesi yapılacaklar

Eklenti mağazalarda dağıtılmadan önce:

1. **Yardımcı uygulama kurucusu:** ✅ Tek dosyalık program ve tek komutluk kurucular (`curl … | sh`, `irm … | iex`) hazır; sürümler `release.yml` ile imzalı taslak olarak üretilir (bkz. geliştirici rehberi).
2. **Eklenti kimlikleri ve izin:** Firefox kimliği `writehand@dervisgenc.com` olarak sabitlendi. Chrome Web Store ve Edge Add-ons kimlikleri alınınca `packages/contracts/src/brand.ts` → `CHROMIUM_EXTENSION_IDS`'e eklenip yeni sürüm yayımlanmalı. İsteğe bağlı `nativeMessaging` izni mağaza incelemesinde gerekçelendirilmelidir (yardımcı uygulama; karşılama sihirbazı kullanıcıdan ister).
3. **ChatGPT:** Depo MIT lisanslı açık kaynak olarak yayımlanıyor; OpenAI'ın açık kaynak/yerel uygulama koşulları yayından önce yeniden okunmalı. Gerekirse [ilgi formu](https://openai.com/form/sign-in-with-chatgpt-interest/) ile erişim istenir.
4. **Claude:** Kullanıcının kendi Claude Code'unu çalıştırma yöntemi için Anthropic'ten yazılı teyit alınmalı; yöntem "deneysel" olarak kalır ve ürün adında "Claude Code" kullanılmaz.
5. **Gizlilik politikası:** Mağazalar ister. Veri akışı, sağlayıcılar (OpenAI, Anthropic), günlük GitHub sürüm denetimi ve yerel saklama bu belgedeki bilgilerle yazılabilir.

## Modül sınırları ve veri akışı

```text
Outlook content script → doğrulanan background mesajı → native messaging
  → apps/ai-companion → packages/ai-openai → OpenAI Responses API
                      → packages/ai-claude-code → kullanıcının Claude Code'u (claude -p)
  ← tamamlanmış düz metin ← mevcut önizleme / kontrollü taslağa uygulama
```

| Yer | Sorumluluk |
| --- | --- |
| `packages/contracts/src/ai.ts` | Boyut sınırlı üretim girdisi, hesap/model görünümü, bağlantı komutları |
| `packages/contracts/src/ai-prompt.ts` | İki sağlayıcının ortak kullandığı sistem talimatı ve etiketli kullanıcı mesajı |
| `packages/email-format` | Modelin Markdown alt kümesini e-postaya uygun HTML'e, düz metne ve doğrulama metnine çevirme |
| `packages/ai-openai` | OAuth/PKCE/OIDC, model listesi, Responses SSE ve kararlı hata kodları |
| `packages/ai-claude-code` | Claude Code'u bulma, giriş durumunu okuma, kısıtlı `claude -p` çalıştırma ve hata eşleme |
| `apps/ai-companion` | Loopback giriş dinleyicisi, native framing, korumalı dosya, hesap seçimi, iptal ve token yenileme; işletim sistemi farkları (`platform.ts`), kurulum planı (`install-plan.ts`) ve kurucu (`install.ts`) |
| `browser-extension/src/platform/` | Gönderici yetkisi, native port, istek eşleştirme, `TextProcessor` adaptörü |
| `packages/ui` | Yalnızca görünüm verisi ve olaylar; hesap kartı ve tema stilleri |

Core/Outlook seçicileri sağlayıcı ayrıntılarını bilmez. Claude Code ikinci sağlayıcı olarak ayrı bir paketle ve companion yönlendirmesiyle eklendi; önizleme/yazma kuralları değişmedi. Sağlayıcı paketleri birbirini içe aktarmaz (ESLint denetler); ortak görev talimatı `contracts`'tadır. Henüz ihtiyaç olmayan çok sağlayıcılı kayıt sistemi oluşturulmadı.

- E-posta açmak veya bağlantı göstergesini okumak üretim isteği göndermez. Kullanıcı üretim istediğinde yalnızca seçili kaynak, talimat, ton, (çeviride) hedef dil, ayarlardaki kalıcı talimat, çıktı biçimi ve hazırlanmış bağlam gönderilir; "Sonucu değiştir"de önceki sonuç ve değişiklik isteği de eklenir. Mailbox kimlikleri, DOM hedefleri ve bağlama seçilmemiş mesajlar bu isteğe eklenmez.
- E-posta metni yalnızca işlem süresince content script, background ve companion belleğinden geçer. Uygulama bunları diske veya loglara yazmaz. OpenAI'a giden her üretimde `store: false`, `stream: true` kullanılır; bu, sağlayıcının bütün veri işleme/saklama politikalarının kapalı olduğu iddiası değildir.
- Kimlik bilgileri `~/.config/writehand/credentials.json` içinde tutulur. Dizin `0700`, atomik değiştirilen dosya `0600` iznine sahiptir. Windows'ta dosya `%LOCALAPPDATA%\writehand\credentials.json` içindedir; klasörün ACL'i devralmasızdır ve yalnızca kullanıcıya ve SYSTEM'e açıktır. Bu dosya uygulama düzeyinde şifreli değildir; işletim sistemi kullanıcı erişimiyle korunur. macOS anahtarlığı, Windows DPAPI/Kimlik Bilgisi Yöneticisi veya Linux Secret Service entegrasyonu ayrı bir geliştirme olabilir.
- Eşzamanlı Chrome/Firefox süreçleri aynı dosyada işlem yapabilir: dosya kilidi refresh token döndürme ve kaydı sıralar. Hesap/model seçimi bu cihazdaki süreçler arasında ortaktır. Başka bir tarayıcıdan değişiklik yapıldıysa ayarlarda **Yenile** kullanın; devam eden başka süreçteki istek, başladığı hesabın isteği olarak tamamlanabilir.
- OAuth access/refresh/ID token'ları eklentiye geri gönderilmez. Ayarlar hesabın kimliğini görebilir; Outlook content script'i yalnızca kullanım yöntemi/model/hazır bilgisini alır. Mevcut hesaba yeniden girişte ID token hint'i yalnızca OpenAI yetkilendirme URL'sinde kullanılır.
- Kimlik JWT imzası, issuer/audience/expiry/nonce ile doğrulanır. Yeni hesap ancak doğrulama sonrası etkinleştirilir. Kayıtlı hesap/çalışma alanları, e-posta aynı olsa bile `client_id` ile ayrı tutulur.
- `response.completed` olmadan sonuç kabul edilmez. Geç gelen veya iptal edilmiş sonuç önizlemeyi değiştirmez. Token yenileme hatalarında geçici ağ sorunu ile geçersiz oturum ayrılır.
- Üretim en fazla 120 saniye sürer; UI/host bağlantısının kaybolması başarı sayılmaz. Worker/host tekrar açılması üretimi otomatik tekrarlamaz. Bir native süreçte en fazla dört üretim aktiftir.
- Native API yalnızca kayıtlı eklentiye açıktır. Content script hesap bağlama, API anahtarı veya tam hesap durumu mesajı gönderemez; background hem göndereni hem veriyi doğrular. İptal yalnızca isteği başlatan sekmeye aittir.

## Yapay zekâya ne gönderiliyor? (istem yapısı)

İstem `buildTaskPrompt` ile üretilir; ChatGPT ve Claude aynı metni alır.

- **Sistem talimatı** bölümleri: Görev (Düzelt / Çevir / Yanıt / Yaz; iyileştirmede önceki sonucu değiştirme), Çıktı (yanıtın tamamı olduğu gibi taslağa girer; konu satırı, giriş cümlesi, açıklama veya yorum yok; ad, tutar, tarih ve saatler yeniden yorumlanmaz; bilgi uydurulmaz, eksik bilgi `[tarih]` gibi yer tutucuyla yazılır), Biçim (zengin: sınırlı Markdown ve ```chart bloğu; düz: yalnızca metin), Dil, Ton, Tercihler, Güvenlik.
- **Dil kuralları:** Düzelt kaynağın dilinde kalır; Çevir hedef dile yazar; Yanıt, yanıtlanan mesajın dilinde yazılır (talimat başka dil istemedikçe); Yaz, talimatın dilinde. İyileştirme önceki sonucun dilinde kalır; iyileştirme talimatları netlik için İngilizcedir, çeviri isteği değildir.
- **Kullanıcı mesajı** etiketlidir: `<task operation tone output_language format />`, `<instruction>`, `<standing_preferences>`, `<source>` (Düzelt/Çevir) veya `<draft>` (Yanıt/Yaz), `<conversation subject>` içinde `<message sender sent reply_target>`, iyileştirmede `<previous_result>` ve `<refinement>`.
- **Güvenlik:** Kaynak, taslak, konuşma ve önceki sonuç "güvenilmeyen veri"dir; içlerindeki talimatlar izlenmez. İçerikteki etiket taklitleri (`</source>` gibi) etkisizleştirilir.
- **Biçim seçimi:** Cümle içindeki seçime yazılacak sonuç ve gelen mesajdan alınan kaynak düz metin ister; taslak gövdesi ve boş taslak biçimli içeriğe izin verir. Model HTML üretmez; HTML eklentide ayrıştırılan yapıdan, bütün metin kaçışlanarak üretilir.

## Bağlantıyı kesme ve sorunlar

**Bağlantıyı kes**, refresh token revocation isteğini dener ve token'ları yerelden siler. Ağ/5xx sorununda bir kez gecikmeli dener; sunucu iptali doğrulanamazsa ekranda açıkça bildirir. Kullanıcı [ChatGPT ayarlarından](https://chatgpt.com/settings/usage) kullanımı, ChatGPT **Security and login → Sign in with ChatGPT** bölümünden uygulama erişimini yönetebilir. Host kimliği ve hesap/client eşleştirmesi sonraki giriş için tutulur.

| Sorun | Yapılacak işlem |
| --- | --- |
| Yardımcı uygulama bağlı değil | Ayarlar → Yardımcı uygulama kartı durumu söyler: **İzin gerekli** ise İzin ver'e basın; **Kurulu değil** ise sihirbazdaki komutu çalıştırın. Terminalde `writehand status` kayıtlı tarayıcıları gösterir. Paketlenmemiş Chromium eklentisi için komutun `--extension-id` içerdiğini kontrol edin. |
| Yardımcı uygulama bağlı değil (Windows) | `reg query "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.dervisgenc.writehand"` (Edge: `Microsoft\Edge`, Brave: `Chromium`, Firefox: `Mozilla`) manifest yolunu göstermelidir; manifestteki `allowed_origins` kullandığınız eklentinin kimliğini içermelidir. Brave, `Chromium` anahtarında başka bir kimliğe izin veren manifest bulursa Chrome anahtarına geçmez. Kurumsal grup ilkesi kullanıcı düzeyindeki hostları kapatmış olabilir. Ayrıca yukarıdaki "Bilinen sınırlar"a bakın. |
| İzin e-postası geldi, ancak bağlantı tamamlanmadı | OpenAI tarafında uygulama izni ile yerelde doğrulanmış oturum farklı adımlardır. Ayarlar, yarım kalmış kaydı açıkça gösterir; Continue with ChatGPT aynı uygulama kaydını kullanarak yeni giriş başlatır. Eski callback sekmesini yenilemeyin. |
| `AI_AUTH_EXCHANGE_FAILED` | Giriş kodu token endpoint tarafından kabul edilmedi. Kayıtlı client ID korunur; yeni bir OAuth denemesi gerekir. |
| `AI_AUTH_TOKEN_INVALID` / `AI_AUTH_IDENTITY_FAILED` | Sırasıyla token yanıt biçimi veya imzalı kimlik doğrulaması başarısız oldu. Hesap etkinleştirilmez. Bu yerel hata kodları gizli bilgi içermez; ham token/yanıt veya callback URL'si paylaşılmamalıdır. |
| `3p_delegated_access_policy_denied` / `AI_POLICY_DENIED` | OpenAI kuruluş politikası bağlantıyı reddetti. Workspace/tenant yöneticisi veya OpenAI desteğiyle Sign in with ChatGPT erişimi ve plan uygunluğu doğrulanmalıdır. Yönetici olmanız bu erişimi otomatik sağlamaz; resmî belgelerde Business Premium için doğrulanmış bir yönetim anahtarı bulunmadığından kesin bir menü yolu önerilmez. Uygulamayı yayımlamanın veya Plugins iznini değiştirmenin bu hatayı çözeceği doğrulanmış değildir. Desteğe hata kodunu ve OpenAI sayfasındaki `request_id` değerini iletin; token veya callback URL'si göndermeyin. OpenAI hata sayfası callback'e dönmezse eklenti bu kodu göremez; bekleyen giriş iptal edilebilir. |
| `3p_login_workspace_scope_denied` / `AI_WORKSPACE_MISMATCH` | Seçili uygulama kaydı giriş yapılan hesabın çalışma alanına ait değil. Aynı kayıt için ilk hesabı/çalışma alanını kullanın; başka hesap için **Farklı hesap veya çalışma alanı ekle** seçin. Bu hata, kuruluş politika reddi veya plan yükseltme gereksinimiyle aynı değildir. Yeni kayıt, kuruluş politikasını ya da plan uygunluğunu atlamaz. |
| Giriş iptali / süre dolması | Ayarlardan yeniden giriş başlatın. Eski callback bir daha kullanılmaz. |
| Hesap bağlı, plan izni yok | Önce hesabın plan uygunluğunu kontrol edin. Uygun hesapta Continue with ChatGPT ile yeniden izin verin; ücretsiz hesapla giriş yapmak üretim hakkı sağlamaz. |
| Hesap doğrulandı, üretim hazır değil | Yerel uygulama her başlatıldığında bağlı hesabın model kataloğunu bir kez kendisi yükler (yalnızca model listesi; üretim isteği yok). Yükleme başarısızsa hata ayarlarda görünür ve her sorguda tekrarlanmaz; Yenile ile tekrar deneyin. Katalog boşsa veya izin/ağ hatası varsa hesap bağlı kalsa bile üretime hazır gösterilmez. |
| Aktif Plus/Pro hesabında `subscription_sharing_user_not_eligible` / `AI_NOT_ELIGIBLE` | Giriş, plan kapsamı ve model listesi başarılı olsa bile OpenAI üretim aşamasında uygunluğu reddedebilir. Bu kod kesin olarak sağlayıcıdan gelmiştir; genel `403` yanıtından tahmin edilmez. Aynı isteği veya OAuth girişini döngüye sokmayın. OpenAI desteğine planı, başarılı giriş/model listesi adımlarını ve üretimdeki hata kodunu iletin. Uygulamayı yayımlamanın veya hesabı kaldırıp eklemenin bu reddi çözeceği doğrulanmış değildir. 16 Ekim 2026'da gözlendi: ücretsizden Plus'a geçişten hemen sonra bu hata alındı; kısa süre sonra aynı oturumla, yeniden giriş yapmadan üretim başarılı oldu ve model listesi genişledi. Plan yeni yükseltildiyse bir süre bekleyip tek bir deneme yapın. Bu gecikme OpenAI tarafından belgelenmemiştir. |
| `AI_ACCESS_DENIED` | İzin, route veya bölge gibi başka bir kontrol isteği reddetti. Tek başına `403`, aboneliğin uygun olmadığı sonucuna varmak için yeterli değildir. Bağlantı yapılandırması ve sağlayıcı erişimi incelenmelidir. |
| Uygunluk/politika hatası | Hesap, çalışma alanı ve uygulamanın OpenAI erişimini doğrulayın. Tekrar tekrar girişe zorlanmaz. |
| Kullanım limiti | ChatGPT için Kullanımı yönet; API için API kullanım limitlerini kontrol edin. Ücretli yola otomatik geçilmez. |
| Yanıt yarım kaldı | Kaynak metin korunur; isterseniz yeniden üretin. Kısmi yanıt uygulanmaz. |
| `AI_VERSION_MISMATCH` / **Güncelleme gerekli** | Yardımcı uygulama eklentiden eski; yeni isteği tanımadı. Ayarlar → Yardımcı uygulama → Güncelle (sürümünü bildiren yardımcı uygulamalar) veya sihirbazdaki kurulum komutunu yeniden çalıştırın. |
| `HOST_UPDATE_CHECK_FAILED` | GitHub'a ulaşılamadı; ağ bağlantısını kontrol edip daha sonra yeniden deneyin. Kurulu sürüm çalışmaya devam eder. |
| `HOST_UPDATE_UNVERIFIED` | İndirilen sürümün imzası veya sağlaması tutmadı; hiçbir şey kurulmadı. Sorun sürerse güvenlik bildirimi yapın (`SECURITY.md`). |
| `HOST_UPDATE_FAILED` | İndirme veya kurulum tamamlanamadı; kurulu sürüm değişmedi. Kurulum komutunu yeniden çalıştırmak da günceller. |

Kaldırmak için sihirbazdaki veya yardımcı uygulama kartındaki kaldırma komutunu çalıştırın (ya da `writehand uninstall`). Komut bütün tarayıcı kayıtlarını (Windows'ta HKCU anahtarları dahil) ve programı siler. `--delete-data` (PowerShell betiğinde `-DeleteData`) ek olarak ChatGPT oturumlarını iptal etmeyi dener ve `~/.config/writehand` (Windows: `%LOCALAPPDATA%\writehand`) klasörünü siler; bu seçenek olmadan kimlik bilgileri yerinde kalır.

Writehand, ChatGPT içine kurulan bir plugin değildir; ChatGPT hesabıyla yetkilendirilen dış uygulamadır. Bağlantıyı **Settings → Security and login → Sign in with ChatGPT**, kullanım izinlerini/limitlerini **Settings → Usage** bölümünden yönetin. Plugins listesinde bir Writehand girdisi beklenmez.

## Doğrulama sınırı ve canlı deneme

Otomatik testler sahte sağlayıcı yanıtları ve yerel OAuth callback'leri kullanır. **16 Ekim 2026 canlı kontrolü:** Kullanıcının tamamladığı kişisel hesap girişinin doğrulandığı, geçerli oturum ve `chatgpt.tokens.use.direct` izni bulunduğu görüldü. Kullanıcı Plus aboneliğinin aktif olduğunu bildirdi. `GET /v1/models` başarılı oldu; kişisel veri içermeyen tek bir minimal `POST /v1/responses` isteği `403 / subscription_sharing_user_not_eligible` ile reddedildi. Yanıt `x-request-id` taşımıyordu. Hesap/token bilgileri çıktıya veya belgelere eklenmedi; gerçek e-posta gönderilmedi.

**16 Ekim 2026 ikinci canlı kontrol** (aynı oturum, yeniden giriş yok): Kişisel veri içermeyen kısa bir `POST /v1/responses` isteği HTTP 200 ve `response.completed` ile tamamlandı. Kurulu native host üzerinden sentetik bir **Düzelt** isteği de doğru sonuç verdi. Birkaç dakika arayla alınan model listeleri 3 modelden 7 modele çıktı. İlk reddin, Plus planının OpenAI tarafında henüz etkinleşmemesinden kaynaklandığı düşünülüyor; bu bir çıkarımdır.

**16 Ekim 2026 Claude Code canlı kontrolü:** Kurulu yerel uygulama tarayıcıdakine benzer kısıtlı bir ortamla başlatıldı. Claude Code girişi (Team planı) okundu; sentetik metinle Düzelt (~3 sn) ve Yanıt (~3 sn, Claude Sonnet) doğru sonuç verdi. Oturum kayıtlarına deneme metni yazılmadığı doğrulandı.

**16 Ekim 2026 gerçek Outlook (Firefox, Claude Code):** Geçici yanıt taslağında uydurma metinle Düzelt → Tablo yap → Taslağa uygula → Geri al → yeniden uygula zinciri çalıştı; tablo Türkçe başlıklarla yazıldı, alıntı ve imza korundu, hiçbir şey gönderilmedi. Ayrıntı ve bulunan hatalar: `YAPILAN_ISLER.md` §23. Aynı gün Claude Haiku'nun Türkçe yanıtlarda harf tekrarı ürettiği görüldü; Haiku seçenekten kaldırıldı.

**16 Ekim 2026 Windows 11 canlı kontrolü** (yalnızca sentetik metin; Outlook'a girilmedi): Kurucuyla Chrome 155, Edge 155, Brave 1.97 ve Firefox 157 kaydedildi; ayrı test profillerinde ayarlar sayfasındaki "Yerel AI bağlantısına ulaşılamadı" uyarısı kalktı. Kurulu başlatıcı Chrome'un `cmd.exe /d /s /c` biçimiyle başlatılıp native messaging çerçeveleriyle `AI_STATUS`, `AI_COMMAND` ve `AI_GENERATE` gönderildi. Claude Code (yerel kurucu, Team planı) ile Düzelt, Çevir, Yanıt ve 120 satırlık bir girdi ~3–17 sn'de doğru sonuç verdi; kabuk karakterleri (`%PATH% & "…" ^`) değişmeden kaldı, oturum kaydı ve geçici klasör kalmadı. `--tools ""` dahil argümanların doğru ayrıştırıldığı Claude Code'un başlangıç olayından doğrulandı (araç, MCP sunucusu, slash komutu ve skill listeleri boş; sistem talimatı tırnak ve ters bölülerle birebir ulaştı). Chrome ve Firefox'ta geliştirme derlemesiyle sentetik Outlook sayfasında Düzelt, yerel uygulama üzerinden gerçek Claude sonucuyla tamamlandı. ChatGPT girişi varsayılan tarayıcıda `rundll32` ile açıldı, kullanıcı girişi tamamladı, loopback dönüşü alındı; hesap doğrulandı, plan izni ve 7 model geldi, sentetik Düzelt ve Çevir başarılı oldu. Kimlik klasörünün ve dosyasının yalnızca kullanıcıya ve SYSTEM'e açık olduğu `icacls` ile görüldü. Ayrıntı: `YAPILAN_ISLER.md` §25.

**19 Ekim 2026 Linux canlı kontrolü (tek dosyalık yardımcı uygulama; yalnızca uydurma metin, Outlook'a girilmedi):** Node.js 24.22 ile derlenen program yerel bir klasörden, gerçek anahtarla imzalanmış sürüm dosyalarıyla `install.sh` üzerinden kullanıcı klasörüne kuruldu; Claude Code yolu ve `CLAUDE_CONFIG_DIR` `config.json`'a yazıldı. Başsız Firefox 157'de üretim paketi yüklenince karşılama sihirbazı kendiliğinden açıldı; izin verilmeden `HOST_INFO` `AI_HOST_UNAVAILABLE` döndü, izin verilince sihirbaz "bağlandı (sürüm 0.1.0)" gösterdi. Aynı kurulum üzerinden Claude Code ile uydurma, işaretli (`WHTEST-LIVE`) bir metin Firefox'ta ~3,5 sn, Chromium'da ~2,6 sn'de düzeltildi; Chromium'da ayarlardaki kart "Bağlı · Sürüm 0.1.0 · Linux (x64)" gösterdi. `HOST_UPDATE_CHECK` ve `writehand update --check` GitHub'a sordu: henüz yayımlanmış sürüm yok. `install.sh uninstall --delete-data` programı, bütün kayıtları ve veri klasörünü sildi. Chromium'da isteğe bağlı izin penceresi başsız tarayıcıda onaylanamadığı için bu denemede izin manifestte önceden verilmiş bir kopya kullanıldı; Chromium'da izin penceresi ve izin sonrası bağlantı elle doğrulanmalıdır.

ChatGPT ile gerçek taslağa uygulama ve Business hesabıyla bağlantı bekliyor. [OpenAI hata ve iyileşme rehberi](https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery).

Canlı denemede: giriş → model listesi → kişisel veri içermeyen kısa metinle Düzelt/Çevir/Yaz/Yanıt → önizleme → izin verilen test taslağına uygulama/geri alma → hesap değişimi → çıkış/yeniden giriş adımlarını kontrol edin. E-posta gönderilmesi gerekmez. Chrome, Firefox ve hesap/workspace varyantlarını ayrı kaydedin.

Kaynaklar: [OpenAI UI kuralları](https://developers.openai.com/siwc/ui-ux-guidelines), [önizleme sınırlamaları](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations), [hata/iyileşme akışları](https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery), [Chrome native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging), [Firefox native messaging](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging).
