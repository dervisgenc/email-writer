# AI bağlantısı: ChatGPT, OpenAI API ve Claude Code

Son kontrol: 16 Ekim 2026. Entegrasyon, OpenAI'ın belgelenmiş **Sign in with ChatGPT / ChatGPT plan usage** akışını kullanır. Eklenti ChatGPT çerezlerini veya başka bir uygulamanın oturum dosyasını okumaz; özel `backend-api` uçlarına bağlanmaz.

## Kapsam ve erişim koşulları

Uygun ChatGPT Plus/Pro hesapları, izin verdikleri uygulamada kendi plan limitlerini veya kullanılabilir kredilerini kullanabilir. Kimlikle giriş yapmak tek başına üretim izni değildir: token yanıtında `chatgpt.tokens.use.direct` kapsamı aranır. Kullanım hesabın ve çalışma alanının erişimine tabidir.

Ücretsiz kişisel hesapla giriş/izin e-postası alınması, üyelik kotasıyla metin üretilebildiği anlamına gelmez. Business Premium veya başka bir iş planının bu OSS akışına uygun olduğu varsayılmaz; yönetici olmak kuruluş politikasını veya ürünün plan uygunluğunu kendiliğinden değiştirmez. [Güncel kullanıcı kapsamı ve bağlantı ayarları](https://learn.chatgpt.com/docs/sign-in-with-chatgpt).

OpenAI bu akışı açık kaynak ve yerelde çalışan uygulamalar için belgeliyor. Özel/ticari veya uzakta barındırılan dağıtımlar için ayrıca uygunluk/erişim gerekebilir. Reponun ileride açık kaynak yapılacak olması, bugünkü özel dağıtımın otomatik onaylandığı anlamına gelmez. Bu değişiklik repoyu yayımlamaz veya lisans belirlemez. [Kapsam](https://developers.openai.com/siwc/token-sharing-open-source), [erişim durumu](https://developers.openai.com/siwc/quickstart).

## Neden yerel uygulama gerekiyor?

Belgelenen OSS OAuth dönüşü `http://127.0.0.1:<port>/auth/callback` adresidir. Access/refresh/ID token'ları tarayıcı depolamasında tutulmamalıdır. Bu nedenle Node.js tabanlı küçük bir native messaging uygulaması kullanılır. Tarayıcı bu süreci ihtiyaç duyulduğunda başlatır; sürekli açık bir HTTP üretim servisi bulunmaz. Yalnızca giriş sırasında, rastgele bir loopback portunda beş dakika süreli OAuth dinleyicisi açılır. [Giriş protokolü](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [oturum güvenliği](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions).

İlk kurulum betiği **macOS ve Linux** içindir. Node.js 22+ gerekir. Windows native host kurucusu henüz yoktur; tarayıcı paketinin Windows'ta yüklenmesi AI bağlantısının Windows desteği anlamına gelmez. Mağaza yayını öncesinde son kullanıcıya uygun imzalı/paketlenmiş kurucu hazırlanmalıdır.

## Geliştirici kurulumu

Repo kökünde:

```sh
pnpm install
pnpm build
```

Firefox için:

```sh
pnpm ai:install firefox
```

Firefox geliştirme kimliği `email-writer@example.invalid` olarak kayıtlıdır. Kimlik değişirse `--extension-id=YENI_KIMLIK` ile tekrar kurun. Paket `apps/browser-extension/.output/firefox-mv3/manifest.json` üzerinden `about:debugging` sayfasında geçici eklenti olarak yüklenebilir. Outlook geliştirme oturumu için mevcut `pnpm outlook:dev` komutu kullanılabilir.

Chrome/Edge/Brave için önce `apps/browser-extension/.output/chrome-mv3` klasörünü paketlenmemiş eklenti olarak yükleyin. Eklenti kimliğini tarayıcının eklenti yönetim sayfasından veya Email Writer ayarlarındaki **Yerel bağlantı kurulumu** bölümünden alın. Aşağıdaki `EKLENTI_KIMLIGI` yer tutucusunu bu kimlikle değiştirin:

```sh
pnpm ai:install chrome --extension-id=EKLENTI_KIMLIGI
# Diğer tarayıcılar:
pnpm ai:install edge --extension-id=EKLENTI_KIMLIGI
pnpm ai:install brave --extension-id=EKLENTI_KIMLIGI
```

Kurucu derlenmiş uygulamayı `~/.local/share/email-writer/` altına kopyalar ve yalnızca verilen eklenti kimliğine izin veren tarayıcı manifestini kullanıcı dizinine yazar. Eklentiye veya mağazaya anahtar gömülmez. Node.js kurulumu/konumu, eklenti kimliği veya companion kodu değişince `pnpm ai:build` ve ilgili `pnpm ai:install ...` komutunu yeniden çalıştırın. Sonra eklentiyi yeniden yükleyin. Kurucu bir yönetici izni istemez.

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

Bu yöntem, kullanıcının bilgisayarında kurulu ve **değiştirilmemiş** Claude Code'u yazdırma modunda (`claude -p`) çalıştırır. Claude girişi yalnızca Claude Code'un kendi akışıyla yapılır (terminalde `claude` → `/login`). Email Writer Claude hesap bilgilerini veya oturum token'larını okumaz, saklamaz ve aracılık etmez; giriş durumunu yalnızca `claude auth status --json` çıktısından öğrenir. Kullanım, Claude planının (Claude Code ile ortak) limitlerinden düşer.

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
| `--system-prompt` | Claude Code'un kodlama talimatı yerine e-posta görev talimatı (`AI_TASK_INSTRUCTIONS`) kullanılır. |
| İstem stdin'den, boş geçici klasör | E-posta metni süreç listesinde görünmez; proje dosyası veya `CLAUDE.md` erişilebilir değildir. Klasör iş bitince silinir. |

stderr okunmaz; sonuç yalnızca `subtype: success` ve `stop_reason` `max_tokens` değilken kabul edilir. Hata mesajı kullanıcıya aktarılmaz, kararlı koda çevrilir. Üretim en fazla 120 saniye sürer; iptal edilen istek süreci sonlandırır.

**Gizlilik:** Üretim istendiğinde metin, talimat ve seçilen bağlam Claude Code üzerinden Anthropic'e gider. Pro ve Max planları Anthropic tüketici koşullarına tabidir: Claude gizlilik ayarlarında model eğitimi kapatılmadıysa içerik eğitimde kullanılabilir. Team ve Enterprise planları ticari koşullara tabidir.

**Kurulum:**

1. Claude Code'u kurun ve terminalde `claude` → `/login` ile giriş yapın.
2. `pnpm ai:install firefox` (veya ilgili tarayıcı) komutunu Claude Code'u kullandığınız terminalde çalıştırın. Kurucu `claude` yolunu ve varsa `CLAUDE_CONFIG_DIR` değerini başlatıcıya yazar. Tarayıcı yerel uygulamayı kısıtlı bir ortamla başlattığı için bu gereklidir.
3. **Ayarlar → AI bağlantısı → Claude aboneliği**. Ekranda Claude Code hesabı, kuruluş ve plan görünür.
4. Model: **Claude Sonnet** (varsayılan), **Claude Haiku** (daha hızlı) veya **Claude Opus**. Claude Code bu adları güncel modele çözer.

| Sorun | Yapılacak işlem |
| --- | --- |
| `AI_CLAUDE_NOT_INSTALLED` | Claude Code bulunamadı. Kurulumdan sonra `pnpm ai:install ...` komutunu yeniden çalıştırın; ardından ayarlarda Yenile. |
| `AI_CLAUDE_NOT_LOGGED_IN` | Terminalde `claude` → `/login`. Birden fazla Claude yapılandırması kullanıyorsanız (`CLAUDE_CONFIG_DIR`), kurucuyu doğru yapılandırmanın açık olduğu terminalde çalıştırın. |
| "API anahtarı gibi başka bir yöntemle oturum açmış" uyarısı | Claude Code aboneliğiniz yerine API anahtarıyla çalışıyor; kullanım o hesaptan ücretlendirilir. |
| `AI_LIMIT_REACHED` | Claude planının limiti doldu; limit Claude Code kullanımınızla ortaktır. Limit yenilenince tekrar deneyin. |

## Ayarlardaki bağlantı rehberi

Son kullanıcı için gerekenler ve adımlar eklentinin **Ayarlar → Bağlantı rehberi** kartında, her yöntem için ayrı bölümde yer alır: Gerekenler, Adımlar ve Bilmeniz gerekenler (ChatGPT üyeliği, OpenAI API anahtarı, Claude aboneliği, yardımcı uygulama). Seçili yöntemin bölümü açık gelir. Metinler `apps/browser-extension/src/locales/ai-tr.ts` ve `ai-en.ts` içindeki `guide` alanındadır; resmî bağlantılar `contracts` sabitlerinden gelir.

## Dağıtım öncesi yapılacaklar

Eklenti mağazalarda dağıtılmadan önce:

1. **Yardımcı uygulama kurucusu:** Son kullanıcı `pnpm` kullanmaz. macOS için imzalı/notarize edilmiş bir paket, Linux için bir paket veya tek komutluk kurucu gerekir. Kurucu mağaza eklenti kimliklerini kullanmalı ve Claude Code'un yolunu bulmalıdır. Windows desteği yoktur.
2. **Eklenti kimlikleri ve izin:** Chrome Web Store ve Firefox AMO kimlikleri sabitlenmeli; `nativeMessaging` izni mağaza incelemesinde gerekçelendirilmelidir.
3. **ChatGPT:** OpenAI plan kullanımını açık kaynak ortaklara ve seçili özel istemcilere açıyor. Depo açık kaynak yapılmayacaksa OpenAI'ın [ilgi formu](https://openai.com/form/sign-in-with-chatgpt-interest/) ile erişim istenmelidir.
4. **Claude:** Kullanıcının kendi Claude Code'unu çalıştırma yöntemi için Anthropic'ten yazılı teyit alınmalı; ürün adında "Claude Code" kullanılmamalıdır.
5. **Gizlilik politikası:** Mağazalar ister. Veri akışı, sağlayıcılar (OpenAI, Anthropic) ve yerel saklama bu belgedeki bilgilerle yazılabilir.

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
| `packages/ai-openai` | OAuth/PKCE/OIDC, model listesi, e-posta prompt'u, Responses SSE ve kararlı hata kodları |
| `packages/ai-claude-code` | Claude Code'u bulma, giriş durumunu okuma, kısıtlı `claude -p` çalıştırma ve hata eşleme |
| `apps/ai-companion` | Loopback giriş dinleyicisi, native framing, korumalı dosya, hesap seçimi, iptal ve token yenileme |
| `browser-extension/src/platform/` | Gönderici yetkisi, native port, istek eşleştirme, `TextProcessor` adaptörü |
| `packages/ui` | Yalnızca görünüm verisi ve olaylar; hesap kartı ve tema stilleri |

Core/Outlook seçicileri sağlayıcı ayrıntılarını bilmez. Claude Code ikinci sağlayıcı olarak ayrı bir paketle ve companion yönlendirmesiyle eklendi; önizleme/yazma kuralları değişmedi. Sağlayıcı paketleri birbirini içe aktarmaz (ESLint denetler); ortak görev talimatı `contracts`'tadır. Henüz ihtiyaç olmayan çok sağlayıcılı kayıt sistemi oluşturulmadı.

- E-posta açmak veya bağlantı göstergesini okumak üretim isteği göndermez. Kullanıcı üretim istediğinde yalnızca seçili kaynak, talimat, dil/ton ve hazırlanmış bağlam gönderilir. Mailbox kimlikleri, DOM hedefleri ve diğer açılan mesajlar bu isteğe eklenmez.
- E-posta metni yalnızca işlem süresince content script, background ve companion belleğinden geçer. Uygulama bunları diske veya loglara yazmaz. OpenAI'a giden her üretimde `store: false`, `stream: true` kullanılır; bu, sağlayıcının bütün veri işleme/saklama politikalarının kapalı olduğu iddiası değildir.
- Kimlik bilgileri `~/.config/email-writer/credentials.json` içinde tutulur. Dizin `0700`, atomik değiştirilen dosya `0600` iznine sahiptir. Bu dosya uygulama düzeyinde şifreli değildir; işletim sistemi kullanıcı erişimiyle korunur. macOS/Linux disk şifrelemesi/anahtarlık entegrasyonu ayrı bir geliştirme olabilir.
- Eşzamanlı Chrome/Firefox süreçleri aynı dosyada işlem yapabilir: dosya kilidi refresh token döndürme ve kaydı sıralar. Hesap/model seçimi bu cihazdaki süreçler arasında ortaktır. Başka bir tarayıcıdan değişiklik yapıldıysa ayarlarda **Yenile** kullanın; devam eden başka süreçteki istek, başladığı hesabın isteği olarak tamamlanabilir.
- OAuth access/refresh/ID token'ları eklentiye geri gönderilmez. Ayarlar hesabın kimliğini görebilir; Outlook content script'i yalnızca kullanım yöntemi/model/hazır bilgisini alır. Mevcut hesaba yeniden girişte ID token hint'i yalnızca OpenAI yetkilendirme URL'sinde kullanılır.
- Kimlik JWT imzası, issuer/audience/expiry/nonce ile doğrulanır. Yeni hesap ancak doğrulama sonrası etkinleştirilir. Kayıtlı hesap/çalışma alanları, e-posta aynı olsa bile `client_id` ile ayrı tutulur.
- `response.completed` olmadan sonuç kabul edilmez. Geç gelen veya iptal edilmiş sonuç önizlemeyi değiştirmez. Token yenileme hatalarında geçici ağ sorunu ile geçersiz oturum ayrılır.
- Üretim en fazla 120 saniye sürer; UI/host bağlantısının kaybolması başarı sayılmaz. Worker/host tekrar açılması üretimi otomatik tekrarlamaz. Bir native süreçte en fazla dört üretim aktiftir.
- Native API yalnızca kayıtlı eklentiye açıktır. Content script hesap bağlama, API anahtarı veya tam hesap durumu mesajı gönderemez; background hem göndereni hem veriyi doğrular. İptal yalnızca isteği başlatan sekmeye aittir.

## Bağlantıyı kesme ve sorunlar

**Bağlantıyı kes**, refresh token revocation isteğini dener ve token'ları yerelden siler. Ağ/5xx sorununda bir kez gecikmeli dener; sunucu iptali doğrulanamazsa ekranda açıkça bildirir. Kullanıcı [ChatGPT ayarlarından](https://chatgpt.com/settings/usage) kullanımı, ChatGPT **Security and login → Sign in with ChatGPT** bölümünden uygulama erişimini yönetebilir. Host kimliği ve hesap/client eşleştirmesi sonraki giriş için tutulur.

| Sorun | Yapılacak işlem |
| --- | --- |
| Yerel bağlantıya ulaşılamıyor | `pnpm ai:build` ve doğru tarayıcı/eklenti kimliğiyle `pnpm ai:install ...`; ardından eklentiyi yeniden yükleyin. Node yolunun hâlâ mevcut olduğunu kontrol edin. |
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

Kurulumu kaldırmak için önce hesaplardan çıkış yapın, ardından `pnpm ai:install firefox --uninstall` (veya ilgili tarayıcı) çalıştırın. Bu komut yalnızca tarayıcı kaydını kaldırır; başka tarayıcıların bağlantısını ve yerel credential dosyasını silmez. Tam kaldırmada `~/.local/share/email-writer` ve `~/.config/email-writer` dizinlerini kullanıcı silebilir.

Email Writer, ChatGPT içine kurulan bir plugin değildir; ChatGPT hesabıyla yetkilendirilen dış uygulamadır. Bağlantıyı **Settings → Security and login → Sign in with ChatGPT**, kullanım izinlerini/limitlerini **Settings → Usage** bölümünden yönetin. Plugins listesinde bir Email Writer girdisi beklenmez.

## Doğrulama sınırı ve canlı deneme

Otomatik testler sahte sağlayıcı yanıtları ve yerel OAuth callback'leri kullanır. **16 Ekim 2026 canlı kontrolü:** Kullanıcının tamamladığı kişisel hesap girişinin doğrulandığı, geçerli oturum ve `chatgpt.tokens.use.direct` izni bulunduğu görüldü. Kullanıcı Plus aboneliğinin aktif olduğunu bildirdi. `GET /v1/models` başarılı oldu; kişisel veri içermeyen tek bir minimal `POST /v1/responses` isteği `403 / subscription_sharing_user_not_eligible` ile reddedildi. Yanıt `x-request-id` taşımıyordu. Hesap/token bilgileri çıktıya veya belgelere eklenmedi; gerçek e-posta gönderilmedi.

**16 Ekim 2026 ikinci canlı kontrol** (aynı oturum, yeniden giriş yok): Kişisel veri içermeyen kısa bir `POST /v1/responses` isteği HTTP 200 ve `response.completed` ile tamamlandı. Kurulu native host üzerinden sentetik bir **Düzelt** isteği de doğru sonuç verdi. Birkaç dakika arayla alınan model listeleri 3 modelden 7 modele çıktı. İlk reddin, Plus planının OpenAI tarafında henüz etkinleşmemesinden kaynaklandığı düşünülüyor; bu bir çıkarımdır.

**16 Ekim 2026 Claude Code canlı kontrolü:** Kurulu yerel uygulama tarayıcıdakine benzer kısıtlı bir ortamla başlatıldı. Claude Code girişi (Team planı) okundu; sentetik metinle Düzelt (~3 sn) ve Yanıt (~3 sn, Claude Sonnet) doğru sonuç verdi. Oturum kayıtlarına deneme metni yazılmadığı doğrulandı.

Gerçek Outlook taslağına uygulamanın uçtan uca canlı doğrulaması ve Business hesabıyla bağlantı bekliyor. [OpenAI hata ve iyileşme rehberi](https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery).

Canlı denemede: giriş → model listesi → kişisel veri içermeyen kısa metinle Düzelt/Çevir/Yaz/Yanıt → önizleme → izin verilen test taslağına uygulama/geri alma → hesap değişimi → çıkış/yeniden giriş adımlarını kontrol edin. E-posta gönderilmesi gerekmez. Chrome, Firefox ve hesap/workspace varyantlarını ayrı kaydedin.

Kaynaklar: [OpenAI UI kuralları](https://developers.openai.com/siwc/ui-ux-guidelines), [önizleme sınırlamaları](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations), [hata/iyileşme akışları](https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery), [Chrome native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging), [Firefox native messaging](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging).
