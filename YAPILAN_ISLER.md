# Yapılan işler

Oturumlar: 13–14 Ekim 2026 (temel), 15 Ekim 2026 (macOS ve gerçek Outlook'ta okuma, §10; bağlam ve arayüz yenilemesi, §11; gerçek yanıt editörü, §12; e-postalar arasında geçiş, §13)
Kapsam: `implementation_details.md` §20.1 Adım 1 (temel) tam; Adım 3–7'nin altyapısı yazıldı ve sentetik sayfada test edildi. Adım 2 (gerçek Outlook incelemesi) okuma tarafında kısmen yapıldı (§10). AI bağlantısı, belgenin §1.2 maddesine göre bu aşamanın dışında.

## Özet

| Alan | Durum |
| --- | --- |
| Monorepo (pnpm workspace), TypeScript strict, Vue 3, WXT, Manifest V3 | ✅ |
| Chromium (service worker) ve Firefox (background script) paketleri | ✅ İkisi de derleniyor, gerçek tarayıcıda açılıyor |
| Modül sınırlarının ESLint ile denetlenmesi | ✅ İhlal denemesiyle doğrulandı |
| Ortak veri sözleşmeleri (`contracts`) | ✅ |
| Bağlam, işlem hazırlığı, oturum, yazma ön koşulları (`core`) | ✅ 45 birim testi |
| Outlook Web bağlantısı: tanıma, **tıklanan konuşmadaki eski mesajları okuma**, taslak/seçim, yazma, geri alma | ✅ Sentetik sayfada; ✅ okuma gerçek Outlook'ta (seçili mesaj görünümü); ⏳ konuşma görünümü, taslak ve yazma |
| Vue panel, başlatıcılar, araç çubuğu penceresi, ayarlar | ✅ |
| Ayarlar, mesajlaşma, pano, tanı kaydı | ✅ |
| Geliştirme modunda etiketli örnek sonuç; üretimde çıkarılmış | ✅ Derleme kontrolüyle doğrulandı |
| Testler | ✅ 147 Vitest + 6 Playwright (Chromium) + Firefox duman testi; Linux ve macOS |
| Belgeler | ✅ README, geliştirici rehberi, Outlook doğrulama protokolü, tarayıcı matrisi |
| Gerçek Outlook hesabıyla doğrulama | ⏳ Okuma tarafı kısmen (15 Ekim 2026, §10); taslak ve yazma bekliyor |
| AI sağlayıcısı / API anahtarı / üyelikle giriş | ❌ Bilinçli olarak yok (§1.2); bağlanma noktası (`TextProcessor`) hazır |

Kod büyüklüğü: contracts 12 dosya / 674 satır · core 20 / 1.705 · ui 14 / 1.514 · outlook-web 23 / 2.466 · browser-extension 34 / 3.132 · tests 18 / 2.779.

## 1. Proje temeli

- `pnpm-workspace.yaml`: `apps/*`, `packages/*`, `packages/mail-connectors/*`. Paketler: `@email-writer/contracts`, `core`, `ui`, `outlook-web`, `browser-extension`. İç paketler derleme adımı olmadan kaynak olarak tüketiliyor (`exports` → `src/index.ts`).
- `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `verbatimModuleSyntax`.
  - `contracts` ve `core` DOM kütüphanesi olmadan derleniyor; bu paketlerde `document` kullanımı tip hatası verir.
- ESLint (flat config, typescript-eslint, eslint-plugin-vue, eslint-config-prettier). Paket başına sınır kuralları:
  - `core` Vue, WXT, Zod, DOM ve diğer paketleri içe aktaramaz.
  - `ui`, `core`'u ve Outlook bağlantısını içe aktaramaz.
  - Bağlantı modülü Vue'yu ve WXT'yi içe aktaramaz.
  - `innerHTML` ve `v-html` yasak; `execCommand` yalnızca `editor-writer.ts` içinde.
  - Başka paketin `src/` dosyalarına doğrudan erişim yasak.
  - Bu kuralların çalıştığı geçici ihlal dosyalarıyla denendi: 7/7 hata yakalandı.
- Prettier, `.editorconfig`, `.gitignore`.
- Vitest projeleri: `unit` (node), `outlook-web`, `extension`, `ui` (jsdom). Playwright yapılandırması ve örnek sayfa sunucusu (`scripts/serve-fixtures.mjs`).
- `pnpm check` zinciri: typecheck → lint → format → test → build → paket kontrolü. **Son çalıştırma: başarılı.**
- Git geçmişi mantıksal adımlara bölündü (belgeler → altyapı → contracts → core → outlook-web → ui → eklenti → uçtan uca testler → belgeler) ve `main` dalı GitHub'daki `dervisgenc/email-writer` deposuna gönderildi (15 Ekim 2026).

## 2. `packages/contracts` — ortak tanımlar

- `mail.ts`: `MailScope`, `ThreadRef`, `ComposerRef`, `TextBlock`, `MessageSnapshot`, `ThreadSnapshot`, `ContextCoverage`. Kapsam için `complete` değeri bilinçli olarak yok.
- `context.ts`: `ContextSnapshot`, `ContextOmission`, `ContextSelection`, `ContextNotice`.
- `actions.ts`: `PreparedAction`, `ApplyTarget` (seçim değişimi `selectionId` olmadan temsil edilemez), önizleme şeması.
- `mail-connector.ts`: `MailConnector` arayüzü (okuma, seçim, yazma, geri alma, abonelik, temizleme).
- `text-processor.ts`: AI bağlantısının ileride takılacağı `TextProcessor` sınırı.
- `settings.ts`, `runtime-messages.ts`: Zod şemaları; yönlendirme tablosu ve yanıt şemaları.
- `errors.ts`: kararlı hata kodları. Kullanıcı metinleri `locales/` içinde.

## 3. `packages/core` — ortam bağımsız iş kuralları

- `buildContext`: kimlik/kapsam kontrolü, tekrar mesaj ayıklama, kesin imza çıkarma, kanıtlanmış tekrar alıntı çıkarma, sıralama (tarih yoksa ekran sırası), mesaj/uzunluk sınırları, değişmez çıktı.
  - Tekrar alıntı kuralı: alıntı ancak tamamen "yanıt başlığı + bağlamdaki başka bir mesajın tam metni" bölümlerinden oluşuyorsa çıkarılır. Tek bir eşleşmeyen satır bile varsa blok korunur.
  - Dışarıda kalan bir mesajın alıntısı "zaten bağlamda" sayılmaz.
- `describeContext`: kullanıcıya gösterilecek kapsam açıklamaları ("Bağlamda 4 mesaj var", "2 mesaj kapalı" vb.).
- `prepareAction` / `validateAction` / `validatePreviewCandidate`: alan hataları, sınırlar, kullanılmayan alanların kayda girmemesi, geç/eski sonucun reddi.
- `reduceSession`: tek durum modeli (`idle`, `reading`, `editing`, `prepared`, `preview`, `applying`, `applied`, `error`). Form/önizleme sürümleri; taslak değişimi, konuşma değişimi, hesap değişimi, yeni içerik tepkileri.
- `validateApply` / `validateUndo` / `deriveApplyTarget` / `deriveCapabilities`: düğmelerin etkinliği durumdan hesaplanıyor, ayrı değişkende saklanmıyor.

## 4. `packages/mail-connectors/outlook-web` — Outlook bağlantısı

- `discovery/selectors.ts`: Outlook'a özgü bütün seçicilerin tek yeri.
  - Hepsi `candidate` durumunda, kanıt düzeyiyle (`evidence`) birlikte.
  - Seçiciler, açık kaynak eklentiler ve kamuya açık gerçek DOM parçaları üzerinden yapılan araştırmayla seçildi. Özet ve kaynaklar: `docs/outlook-web-dogrulama.md`.
- **Tıklanan konuşmadaki eski içeriği okuma** (`reading/read-thread.ts`, `extract-text-blocks.ts`):
  - Okuma bölmesindeki her açık mesaj gönderen, güvenilir tarih, ekran sırası ve metin bloklarıyla (gövde / imza / alıntı) okunur.
  - Kapalı mesajlar okunmuş sayılmaz; sayısı tanınabiliyorsa raporlanır, tanınamıyorsa uydurulmaz.
  - Gizli metin, betik, stil ve form değerleri alınmaz. Tablolar `|` ile, listeler satır satır okunur.
  - Okuma parçalı ve iptal edilebilir. Okuma sırasında konuşma değişirse yarım sonuç dönmez.
- Gelen mesajdaki seçimi okuma: mesaj kimliğiyle birlikte döner ve yazma hakkı oluşturmaz.
- Kimlik:
  - Hesap kapsamı ipucundan opak özetle (hash) üretilir; ad veya adres saklanmaz.
  - Konuşma kimliği `data-convid`, satır kimliği veya URL'den gelir; bunlar yoksa yerel kimlik üretilir.
  - Editör ve mesaj kimlikleri DOM elemanı ömrüyle sınırlıdır.
- Gözlem: 150 ms birleştirmeli `MutationObserver` ve SPA konum değişikliği. Eklentinin kendi arayüzü ve izlenen editörler sayfa keşfini tetiklemez. Editör sürümü içerik parmak iziyle artar; IME takibi var.
- Taslak:
  - Kullanıcının yazdığı bölge imza/alıntı sınırından ayrılır.
  - Sınır bulunamayan yanıt taslağında gövdenin tamamını değiştirme kapalı kalır.
  - Seçim UTF-16 indisleriyle DOM'a eşlenir; imzaya taşan seçim reddedilir.
- Yazma:
  - Hedef DOM'a yazmadan hemen önce yeniden doğrulanır (kapsam, bağlılık, görünürlük, sürüm, seçim metni, IME).
  - Tek seferlik `applyOperationId` kullanılır. Yazmadan sonra editör tekrar okunur ve korunan bölgeler karşılaştırılır.
  - Sonuç `applied` / `rejected` / `uncertain` olarak döner; belirsiz sonuç otomatik tekrarlanmaz.
- Geri alma: yalnızca son eklenti değişikliği ve yalnızca araya düzenleme girmediyse yapılır.
- Yazıcılar:
  - `execCommand('insertText')` varsayılan.
  - Sentetik `paste` olayı alternatif olarak hazır; araştırmaya göre RoosterJS'e daha uygun olabilir.
  - İkisi birbiri ardına denenmez; hangisinin kullanılacağına gerçek doğrulama karar verecek.

## 5. `packages/ui` — Vue bileşenleri

- `WriterPanel`, `OperationSelector`, `SourceEditor`, `ContextInspector`, `ResultPreview`, `ApplyControls`, `StatusNotice`, `LauncherButton`.
- Bileşenler yalnızca görünüm verisi (`PanelView`) alır ve olay yayar; metinler sözlükten (`UiText`) gelir.
- Erişilebilirlik:
  - Panel `role="dialog"` ve `aria-labelledby` taşır, modal değildir.
  - Escape önce alt bölümü, sonra paneli kapatır. Açılışta odak panele taşınır.
  - Durumlar `aria-live` ile duyurulur. Kapalı düğmenin nedeni metinle açıklanır.
- Açık/koyu/sistem tema; CSS değişkenleri panel kökünde. Dar ekran yerleşimi var.
- Aktif mesaj güvenle belirlenemezse kullanıcı "Bu mesaja yanıt ver" ile hedefi seçer (§10.5).

## 6. `apps/browser-extension` — eklenti

- `wxt.config.ts`:
  - İzinler yalnızca `storage`; statik Outlook eşleşmeleri (`outlook.live.com`, `outlook.office.com`, `outlook.office365.com`, `outlook.cloud.microsoft`).
  - Firefox `gecko.id`, `strict_min_version: 140`, veri paylaşımı beyanı `required: ['none']`.
  - Test/geliştirme derlemesinde yerel adresler ekleniyor; üretimde yok.
- Giriş noktaları:
  - `outlook.content.ts`: bağlantı, oturum, panel ve başlatıcılar.
  - `background.ts`: ayarlar.
  - `popup/`: destek durumu, paneli açma, geliştirmede seçici tanılaması.
  - `options/`: ayarlar ekranı.
- Denetleyiciler: oturum deposu, okuma/işlem, yazma/geri alma, panel; saf `toPanelView` ve ince Vue köprüsü `use-panel-session`.
- Montaj:
  - Panel ve başlatıcılar Shadow DOM içinde.
  - **Başlatıcılar Outlook'un DOM ağacına eklenmiyor**; gövdenin sonunda, hedef bölgenin köşesinde yüzüyor. Outlook'un yeniden çizimi ile çakışmayı önler.
  - Panelde yazarken klavye olayları Outlook kısayollarına sızmıyor (testle doğrulandı).
- Platform: sürümlü ve sıralı ayar deposu (geçersiz kayıt kurtarma, yeni şemayı koruma, çakışmada alan düzeyinde birleştirme), şema doğrulamalı ve gönderici kontrollü mesajlaşma, pano, içeriksiz tanı kaydı.
- TR/EN metin sözlükleri.
- Geliştirme modunda "Örnek sonuç — geliştirme modu" etiketli sabit sonuçlar. Üretim paketinde bu modül yok (`verify:packages` kontrol ediyor). Normal derlemede düğmeler "Metin işleme henüz bağlanmadı" açıklamasını gösteriyor.

## 7. Doğrulama sonuçları

| Kontrol | Sonuç |
| --- | --- |
| `pnpm typecheck` (5 paket + testler) | Geçti |
| `pnpm lint`, `pnpm format:check` | Geçti |
| `pnpm test` | 99/99 (8 dosya) |
| `pnpm build` → chrome-mv3 + firefox-mv3 | Geçti |
| `pnpm verify:packages` | Geçti; test derlemesine karşı çalıştırıldığında yerel adresleri ve geliştirme modülünü doğru yakaladı |
| Playwright + Chrome for Testing 156 (sentetik sayfa) | 5/5 |
| Firefox 157.0.1 başsız duman testi (sentetik sayfa) | Bütün adımlar geçti |
| `web-ext lint` (Firefox paketi) | 0 hata, 5 uyarı; hepsi kütüphane kodundan |

Testlerin ortaya çıkardığı ve düzeltilen sorunlar:
- İmza içindeki iç içe satırlar imza türünü devralmıyordu.
- Seçili konuşma öznitelik değişikliği izlenmiyordu.
- Tablo hücreleri arasındaki boşluklar çift boşluk üretiyordu.
- İşlem sırasında bir düğme devre dışı kalınca odak panelden düşüyor ve Escape çalışmıyordu.

## 8. Kararlar ve belgeden sapmalar

- **TypeScript 6.0** kullanıldı: typescript-eslint henüz 7.x'i desteklemiyor (`<6.1`).
- **pnpm 12** kullanıcı dizinine kuruldu (`npm install -g pnpm@12 --prefix ~/.local`), çünkü sistemde pnpm ve corepack yoktu.
- Sözleşmelere küçük eklemeler:
  - `MessageSnapshot.sentAtText` (görünen tarih, ayrıştırılmaz).
  - `ContextSnapshot.activeMessageKey` ve `ordering`; `replyTargetKey`.
  - Ek hata kodları: `ACCOUNT_CHANGED`, `CONTEXT_STALE`, `PREVIEW_STALE`, `RESULT_UNCHANGED`, `READ_CANCELLED`, `SETTINGS_INVALID`, `PROCESSING_UNAVAILABLE`, `CONTENT_SCRIPT_UNREACHABLE`, `MESSAGE_REJECTED`, `UNEXPECTED`.
  - İçeriksiz `GET_SELECTOR_REPORT` mesajı.
  - Ayar yanıtında `read-only` durumu.
  - Uygulama sonucunda `undoId: null` (değişen bölüm kesin sınırlanamazsa geri alma sunulmaz).
- `MailConnector` okuma/yazma işlemlerinin tamamı asenkron: Office.js gibi ortamlar yalnızca asenkron erişim sunuyor.
- Başlatıcıların yeri: belge "konuşma alanının veya taslağın yakınında" diyor. Outlook'un DOM'una eklemek yerine yüzen katman seçildi.
- Zod `jitless` modunda: eklenti sayfaları `eval`'e izin vermiyor.
- Firefox kimliği geçici: `email-writer@example.invalid`. Mağaza kaydından önce kalıcı kimlik seçilmeli.
- İlk mesajınızdaki "API anahtarı veya üyelikle giriş" bu aşamada yapılmadı: `implementation_details.md` §1.2 bunu açıkça dışarıda bırakıyor. Bağlanma noktası (`TextProcessor`) hazır; `ui`, `core` ve Outlook bağlantısı değişmeden eklenebilir.

## 9. Bekleyen işler

**Sizin yapmanız veya birlikte bakmamız gerekenler:**
1. **Gerçek Outlook Web doğrulamasının kalanı.** Okuma tarafı seçili mesaj görünümünde yapıldı (§10).
   - Konuşma görünümü (okuma bölmesinde bütün mesajlar): mesaj kapsayıcısı, açık/kapalı mesaj ayrımı ve sıra. Outlook ayarı değiştirilerek `pnpm outlook:inspect` ile denetlenebilir.
   - Protokol: `docs/outlook-web-dogrulama.md` (18 maddelik kontrol listesi); taslak ve yazma kontrolleri 8–18.
   - Yazıcı kararı: `execCommand` mı, `paste` mı? Outlook'un taslağı kaydedip kaydetmediğine göre verilecek.
2. Firefox eklenti kimliği ve mağaza kayıtları.

**Sonraki geliştirme adımları:**
- Kalan seçicilerin (imza, editör, kapalı mesaj) gerçek sayfada doğrulanması; anonim gerçek yapı örnekleri ve testleri.
- Ayrı pencerede açılan taslak / iframe editör desteği (gerekirse).
- Eklenti simgeleri.
- İlk AI sağlayıcısının `TextProcessor` olarak bağlanması; Firefox veri paylaşımı beyanının güncellenmesi.
- CI (GitHub Actions vb.) üzerinde `pnpm check` + Playwright.

## 10. 15 Ekim 2026 — macOS ve gerçek Outlook'ta okuma

**macOS'ta çalıştırma**
- `pnpm dev` yerel örnek sayfaya hiç bağlanmıyordu (Linux'ta da). WXT'nin dev modu content script'i manifeste yazmıyor, giriş noktası seçenekleriyle çalışma anında kaydediyor. Yerel adresler bu yüzden `build:manifestGenerated` yerine `entrypoints:resolved` kancasında, giriş noktası seçeneklerine ekleniyor. Üretim manifestleri değişmedi.
- macOS'ta terminalden başlatılan Firefox "Profile Missing" hatası veriyor: macOS, Firefox'un kendi veri klasörüne erişimini terminalin izinleriyle değerlendiriyor. Testler ve araçlar Firefox'u `open` ile başlatıyor (`tests/support/firefox/`). Firefox duman testi ve Chromium uçtan uca testleri macOS'ta geçti.

**Gerçek Outlook inceleme aracı** (`tests/manual/outlook-live/`, `pnpm outlook:firefox`, `pnpm outlook:inspect`)
- Kalıcı profilli Firefox'a WebDriver BiDi ile bağlanıyor. Eklentinin okuma kodunu (`createOutlookWebConnector` → `readThread`) gerçek sayfada, BiDi sandbox'ında çalıştırıyor.
- Çıktılar maskeli; gerçek içerik terminale veya diske yazılmıyor. Yalnızca okuyor ve satıra tıklıyor; gönderme, yanıtlama, silme ve klavye yok.
- `pnpm outlook:dev`: eklentiyi aynı Firefox'ta, Outlook oturumu açıkken canlı yenilemeyle çalıştırıyor. WXT geliştirme sunucusu tarayıcı açmadan başlıyor, derleme BiDi ile geçici eklenti olarak yükleniyor. İş hesabı `outlook.cloud.microsoft` adresine yönleniyor; eklenti orada çalıştı.
- Ortak BiDi istemcisi `withBidiSession` ile oturumu her durumda kapatıyor. Firefox, bağlantı koptuğunda oturumu kendiliğinden kapatmıyor; açık kalan oturum sonraki bağlantıları engelliyor.

**Okuma kodunda gerçek sayfaya göre yapılan düzeltmeler** (ayrıntı: `docs/outlook-web-dogrulama.md` §3)
- Mesaj kapsayıcısı artık seçiciyle aranmıyor, ileti başlığından (`MSG_<ileti>_*`) türetiliyor: gövdeyi ve tek bir iletinin başlığını içeren en küçük üst eleman (`reading/message-header.ts`). Gönderen ve tarih yalnızca gövde dışında aranıyor.
- Gönderen etiketi yalnızca görünen ad; adres atılıyor. "X on behalf of Y" iletisinde yazar (son kişi kartı) alınıyor.
- Tarih yalnızca görünen metin; Outlook makinece okunur tarih vermiyor. `sentAt` boş, aktif mesaj tarihle tahmin edilmiyor.
- Konuşma anahtarı okuma bölmesindeki `CONV_<belirteç>_SUBJECT` belirtecinden üretiliyor. Sanal ileti listesi seçili satırı ekran dışında DOM'dan çıkarınca anahtar artık değişmiyor.
- Yanlış eşleşen yedek seçiciler kaldırıldı: `[role=listitem]`, `[aria-expanded][tabindex]`, `span[title*="@"]`, genel `[role=heading]`, `time`.
- Metin çıkarma: tablo hücre ayırıcısı yalnızca aynı satırda önceki hücrede metin varsa yazılıyor. Ayrı parçalardaki satır sonları doğru sayılıyor. Satır sonundan önceki boşluk atılıyor.
- Doğrulanan seçiciler `verified` durumunda, doğrulama kaydıyla birlikte. Anonim gerçek yapı örneği: `tests/fixtures/outlook/selected-message-reading-pane.html`.

**Doğrulama:** `pnpm check` geçti (107 test). `pnpm test:e2e` 5/5, `pnpm test:firefox` geçti (macOS). Gerçek Outlook'ta yedi konuşmada konu, gönderen adı, görünen tarih, gövde ve alıntı doğru ayrıldı; okunan ve ekrandaki metin %100 civarında örtüştü.

## 11. 15 Ekim 2026 — Bağlam ve arayüz yenilemesi

**Bağlam**
- Açılan mesajlar sayfa oturumu boyunca bellekte birikir (`controllers/message-history.ts`, `core/context/message-history.ts`).
  - Aynı konuşmadan veya aynı konudan olanlar bağlama varsayılan olarak girer; başka konuşmalardan olanlar "Diğer açılan e-postalar" altında seçilmemiş görünür.
  - Mesaj kimliği Outlook'un ileti kimliğinden türetilir; aynı mesaj iki kez sayılmaz.
- Seçim "varsayılan kural + kullanıcının istisnaları" olarak tutulur (`ContextSelection { included, excluded }`). Sonradan açılan ilgili mesajlar kendiliğinden eklenir.
- Bağlamdaki mesaj metni düzenlenebilir ve orijinaline döndürülebilir (`ContextEdit`). Bağlam mesajları konu, hangi konuşmadan geldiği ve düzenlenip düzenlenmediği bilgisini taşır.

**Yazma alanına gömülü kullanım**
- Her taslağın köşesinde araç çubuğu var: Yanıt yaz · Düzelt · Çevir ▾ · panel.
- Düzelt ve Çevir işlemi doğrudan yapar; sonuç taslağın yanındaki kartta önizlenir, oradan uygulanır, kopyalanır veya geri alınır. Yanıt yaz kartı talimat bekler.
- Kart ve panel aynı oturumu gösterir (`PanelSurface`); "Panelde aç" çalışmayı sürdürür.
- Yanıtlanan mesaj belirsizse kart bunu söyler ve panelde seçtirir.
- Taslak okuması ile konuşma okuması sıraya dizildi. Önceden taslak düğmesiyle açılan panel, oturum meşgul olduğu için konuşmayı okumayı sessizce atlayabiliyordu.

**Görünüm**
- Arayüz Fluent UI v9 diliyle yeniden tasarlandı. Bileşenler: `ComposeToolbar`, `InlineAssistant`, `ThreadLauncher`, `ContextMessageCard`, `AppIcon`; stiller alanlara bölündü.
- "Otomatik" tema Outlook'un renklerini sayfadan okuyor. Gerçek sayfada doğrulandı; ayardan açık veya koyu seçilebilir.
- Düzeltilen hata: yüzen düğmeler gölge kökün dış elemanına konumlandırıldığı için (WXT `all: initial !important`) hiç yerine oturmuyordu; konum artık iç kapsayıcıda.

**Karar (belgeden sapma):** `implementation_details.md` §7.1 içeriğin yalnızca kullanıcı işlem istediğinde okunmasını öngörüyor. Seçili mesaj görünümünde aynı konuşmanın önceki mesajlarına sonradan ulaşılamadığı için, açılan mesajlar açıldıkları anda bellekte tutuluyor. Sınırlar:
- kalıcı saklama ve ağ isteği yok,
- en fazla 40 mesaj,
- hesap değişince ve sayfa kapanınca silinir,
- eklenti sitede kapalıysa okuma yapılmaz,
- mesaj açmak işlem başlatmaz.

Ayarlar ekranındaki saklama notu buna göre güncellendi.

**Doğrulama:** `pnpm check` geçti (137 test). Chromium uçtan uca 6/6, Firefox duman testi geçti (macOS). Gerçek Outlook'ta:
- tema renkleri okundu,
- "Yanıt hazırla" düğmesi Outlook düğmeleriyle çakışmıyor,
- iki konuşma açıldıktan sonra panel bağlamı doğru grupladı.

Yazma alanı araç çubuğu gerçek editörde henüz denenmedi (taslak açılmadı).

## 12. 15 Ekim 2026 — Gerçek yanıt editöründe araç çubuğu

Kullanıcının bildirdiği sorunlar: "Reply"a basınca araç çubuğu anlık görünüp kayboluyordu; "Yanıt hazırla" düğmesi de kayboluyordu; yanıt editöründe "Yanıt yaz" yoktu.

**Kök nedenler** (gerçek sayfada `pnpm outlook:inspect diagnose-reply` ile ölçüldü):
- **Araç çubuğu ekranın dışındaydı.** Seçili mesaj görünümünde "Reply" okuma bölmesindeki mesajı kaldırıp yerine kaydırılan bir kapsayıcı içinde, ekrandan uzun bir editör koyuyor. Araç çubuğu editörün gerçek alt kenarına (ekranın altına) yerleşiyordu.
- **Konuşma kayboluyordu.** Bölmede mesaj gövdesi kalmadığı için editör yeni ileti sayılıyordu: "Yanıt yaz" yoktu, "Yanıt hazırla" kalkıyordu.
- **Alıntı geç geliyordu.** Outlook editörü önce boş açıp alıntıyı ~250 ms sonra dolduruyor. Editörün içi sayfa gözleminin dışında olduğu için bu değişiklik görülmüyordu; taslağın konuşma bağı değişse de sayfa durumu yalnızca taslak anahtarına bakarak "değişmedi" sayılıyordu.
- **Geliştirme ortamı karışmıştı.** Aynı anda iki `pnpm outlook:dev` çalışıyordu. Ayrıca Firefox'ta WXT'nin içerik betiği yenilemesi eski betiği çalıştırmaya devam ediyordu.

**Düzeltmeler**
- Yüzen düğmeler editörün görünen bölümüne (kaydırılan üst elemanlar ve pencereyle kırpılmış) yerleşiyor. Sonuç kartının yüksekliği üstteki boşluğa göre sınırlanıyor.
- `discovery/track-active-thread.ts`: Listede aynı satır seçili kaldığı sürece okuma bölmesindeki editör son gösterilen konuşmaya ait. Konuşma "park edilir": değişmiş sayılmaz, okuma yanıtlanan mesajı ve konuyu verir. Bağlam, mesaj açılırken belleğe alınan mesajdan gelir.
- Taslağın yanıt olduğunun kanıtı alıntı veya bir konuşmanın altında açılmış olmak; yerleşik taslak bölgesi tek başına kanıt değil (Outlook yeni iletileri de orada açıyor).
- Editörün içine alıntı girince sayfa yeniden değerlendiriliyor. Taslağın konuşma bağı değişirse kayıt ve araç çubuğu yenileniyor (`samePageState` artık konuşma bağını da karşılaştırıyor).
- Kullanıcı çalışmanın konuşmasına geri dönünce "konuşma değişti" uyarısı kalkıyor.
- Yeni işlem `compose` ("Yaz"): Yeni iletide talimattan e-posta metni yazar, konuşma bağlamı gerekmez. Araç çubuğunun ilk düğmesi yanıt taslağında "Yanıt yaz", yeni iletide "Yaz"; panelin ilk sekmesi de buna göre değişiyor.
- Kartın talimat alanı, bağlam okunduktan sonra göründüğü anda odaklanıyor.
- `pnpm outlook:dev`: aynı anda ikinci kez çalıştırılamıyor (IPv4 ve IPv6 kontrolü); her derlemeden sonra eklentiyi diskten baştan yüklüyor.

**Gerçek sayfada doğrulandı** (iş hesabı, Firefox 157):
- "Reply"dan sonra 1., 3. ve 6. saniyede araç çubuğu ekranda; ilk düğme "Yanıt yaz".
- Kart "Bağlam · 1 mesaj" ile açıldı; yanıtlanan mesaj belli olduğu için uyarı yok; kart ekranın içinde.
- Test için açılan boş yanıt taslakları Outlook'un "Discard" düğmesiyle kaldırıldı; e-posta gönderilmedi.

**Doğrulama:** `pnpm check` (144 test), Chromium uçtan uca 6/6, Firefox duman testi geçti.

## 13. 15 Ekim 2026 — E-postalar arasında geçiş

Kullanıcının bildirdiği sorun: Başka bir e-postaya geçip taslaktaki "Çevir"e basınca kart yerine panel açılıyordu. Panelde "Konuşma değişti" uyarısı ve "Bu konuşmayla yeni çalışma başlat" düğmesi çıkıyordu; her geçişte çalışmayı elle yeniden başlatmak gerekiyordu.

**Kök neden:** Oturum ilk açılan konuşmaya bağlı kalıyordu. Başka konuşmaya geçilince, oturumda içerik varsa (taslaktan alınan metin, talimat veya sonuç) silinmesin diye korunuyor ve kullanıcıdan onay isteniyordu.

**Yeni davranış** (`controllers/panel-controller.ts`, `followThread`):
- Çalışma, kullanıcının o an baktığı e-postaya aittir. Başka bir e-postaya geçilince oturum o e-postayla kendiliğinden yeniden başlar. Devam eden okuma ve bekleme iptal edilir; önceki e-postanın metni, talimatı ve sonucu bırakılır.
- Panel açıksa yeni e-postanın bağlamı kendiliğinden okunur ve seçili işlem korunur. Önceki e-postanın mesajları "Diğer açılan e-postalar" altında seçilmemiş kalır.
- Sonuç kartı açıksa kapanır, çünkü önceki e-postanın taslağına aitti.
- Taslaktaki Yanıt yaz / Düzelt / Çevir düğmeleri her zaman işlemi doğrudan yapar. Sayfa olayı gecikse bile düğmenin bağlı olduğu taslağın konuşmasıyla yeni çalışma başlar.
- "Reply"a basmak konuşma değişikliği sayılmaz (§12'deki park etme); yanıt yazarken çalışma sıfırlanmaz.
- İstisna: Yeni ileti yazılırken (oturum bir konuşmaya bağlı değil) başka bir e-posta açılırsa, yazılan talimat ve metin korunur.
- "Bu konuşmayla yeni çalışma başlat" seçeneği, metinleri ve ilgili kod (`startNewWork`, `canStartNewWork`) kaldırıldı.

**Doğrulama:** `pnpm check` (147 test), Chromium uçtan uca 6/6, Firefox duman testi geçti. Gerçek Outlook'ta henüz denenmedi; çalışan `pnpm outlook:dev` oturumunun yeniden başlatılması gerekiyor.
