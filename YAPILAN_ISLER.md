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

## 14. 15 Ekim 2026 — ChatGPT üyeliği ve OpenAI API bağlantısı

**Kullanım**
- Ayarlar ekranında ChatGPT üyeliği veya OpenAI API anahtarı seçiliyor. ChatGPT için `Continue with ChatGPT`, hesap/çalışma alanı kayıtları, model listesi, yeniden giriş, çıkış ve kullanım yönetimi var.
- İlk başarılı plan bağlantısında tek seferlik kullanım bildirimi gösteriliyor. Panel ve taslak kartında kullanılan yöntem ile AI ayarları/kullanım bağlantıları var. Fluent açık/koyu tema değişkenleri, TR/EN metinler ve dar ekran düzeni kullanıldı.
- Gerçek bağlantı `revise`, `translate`, `reply`, `compose` işlemlerini mevcut `TextProcessor` sınırından işler. Önizleme ve kontrollü taslağa yazma/geri alma kuralları korunur.
- Geliştirme dahil normal derlemeler gerçek bağlantıyı kullanıyor; sabit örnekler yalnızca `--mode test` derlemesinde. Limit veya bağlantı hatası başka ücretlendirme yöntemine otomatik geçmez.

**Mimari**
- `packages/ai-openai`: belgelenmiş OAuth/PKCE/OIDC, model keşfi, e-posta prompt'u, Responses SSE ve hata eşleme.
- `apps/ai-companion`: native messaging, loopback callback, hesap yönetimi ve korumalı credential dosyası. Kurucu macOS/Linux içindir; Node.js 22+ gerekir.
- `contracts/ai.ts`: sınırlandırılmış üretim girdisi, bağlantı komutları, model/hesap görünümü. Gönderilen veri yalnızca seçili metin ve bağlamdır; DOM hedefleri/posta kimlikleri aktarılmaz.
- Background, gönderici ve mesaj şemasını doğrulayarak native uygulamaya yönlendirir. Content script hesap yönetimi veya API anahtarı mesajı gönderemez; yalnızca güvenli durum özeti, üretim ve kendi isteğini iptal etme hakkı vardır.
- OAuth token'ları tarayıcıya dönmez; `~/.config/email-writer/credentials.json` içinde `0600`, dizin `0700` izinleriyle saklanır. Dosya değişimi atomik, token yenileme süreçler arası kilitle sıralıdır. Uygulama düzeyinde dosya şifrelemesi yoktur.
- İptal edilmiş eski girişin geç tamamlanıp yeni giriş durumunu silmesi engellendi. İptal sonrasında gelen yeni refresh token iptal edilmeye çalışılır. Başarısız kod değişiminde verilen client ID sonraki giriş için korunur.
- Her üretimde `store:false`, `stream:true`; `response.completed` olmadan önizleme yok. Giriş/kimlik doğrulama, plan izni, uygunluk, kota, kopma ve iptal ayrı ele alındı. Mail içeriği/prompt/token loglanmaz; metinler diske yazılmaz.
- Eklentiye `nativeMessaging` izni ve Firefox'a `personalCommunications`/`authenticationInfo` beyanı eklendi. Geniş host erişimi, çerez erişimi veya ChatGPT özel backend kullanımı yok.

**Belgeler**
- [AI_BAGLANTISI.md](./docs/AI_BAGLANTISI.md): kurulum, mimari, veri sınırı, çıkış/sorun giderme ve canlı deneme adımları.
- README, proje planı, implementasyon detayları (§21) ve geliştirici rehberi güncellendi. İlk aşamanın “AI yok / harici veri aktarımı yok” kararlarının artık tarihsel olduğu belirtildi.
- Özel repo/dağıtım OpenAI uygunluğunu otomatik sağlamaz. Gerçek hesap/workspace erişimi ayrıca doğrulanmalı. Repo yayımlanmadı; lisans kararı değiştirilmedi.

**Doğrulama**
- Vitest: 184 test; OAuth callback/state/PKCE/JWT, token döndürme, dosya izinleri, izin eksikliği, limit ve yarım akış, iptal/yeni giriş yarışı, native framing, gönderici yetkisi ve Vue bağlantı ekranı dahil.
- Chromium: 8 uçtan uca test (mevcut e-posta akışları; bağlantı eksikliği; simüle native bağlantıyla hesap/model/ilk kullanım/çıkış). Açık/koyu ve 390 px genişlikte görüntüler kontrol edildi.
- Firefox 157.0.1: mevcut sentetik Outlook duman testi geçti.
- Derlenmiş native süreç, geçici kullanıcı dizininde gerçek framed stdin/stdout isteğiyle denetlendi; kullanıcı credential dosyasına veya OpenAI'a erişilmedi.
- Tip, lint, biçim, derleme ve paket kontrolü `pnpm check` ile yürütülür.

**Açık kalan doğrulama/dağıtım işleri:** Gerçek ChatGPT hesabıyla OAuth onayı, model listesi, üyelik kotasıyla üretim ve gerçek Outlook taslağına uygulama bu oturumda yapılmadı. Windows native host kurucusu, son kullanıcı kurulum paketi, imzalama ve mağaza yayını ayrıca gereklidir. Kullanıcının tarayıcı native host kayıtlarına otomatik kurulum yapılmadı; kurulum komutları rehberdedir.

## 15. 15 Ekim 2026 — Yarım kalan ChatGPT bağlantısı ve plan uygunluğu

- Kullanıcı Business Premium hesabında OpenAI `3p_delegated_access_policy_denied`, ücretsiz kişisel hesabında callback hatası bildirdi. Yerel incelemede yalnızca tamamlanmamış uygulama kaydı bulundu; doğrulanmış hesap/token yoktu. OpenAI izin e-postası, yerelde oturumun kurulması ve planla üretim birbirinden ayrıldı.
- Ayarlar; bağlantı tamamlanmadı, oturum kapalı, hesap doğrulandı ama plan izni yok, model erişimi hazır değil ve üretime hazır durumlarını ayrı gösterir. Hazır durumu artık yüklenmiş katalogda kullanılabilir model gerektirir; kayıtlı model adı tek başına yeterli değildir. Eklenti yeniden açıldığında uygun bağlı hesap için katalog yenilenir.
- OAuth callback/token yanıtında kuruluş politika hatası ayrı eşlenir. Kod değişimi, geçersiz token yanıtı ve kimlik doğrulama hatalarının güvenli yerel kodları callback ve arayüzde gösterilir; ham sağlayıcı yanıtı veya token taşınmaz. OpenAI hata sayfası callback'e dönmezse eklenti o sayfanın hata kodunu okuyamaz.
- Doğrulanmış giriş sonrası model keşfi sorunu giriş başarısızlığına dönüştürülmez. Plan izni eksik girişte callback üretimin etkin olmadığını açıklar. Yeni denemeler kayıtlı client ID'yi korur; doğrulama kontrolleri gevşetilmedi.
- ChatGPT bağlantısının Plugins yerine **Settings → Security and login → Sign in with ChatGPT**, kullanımının **Settings → Usage** altında yönetildiği TR/EN arayüze ve bağlantı rehberine eklendi. Ücretsiz hesap ve Business Premium için Plus/Pro plan kullanım kapsamı genellenmez.
- Doğrulama: `pnpm check` geçti, 194 test; bağlantı ayarlarına yönelik 2 Chromium uçtan uca test geçti. Dar ekran/koyu tema görüntüsü kontrol edildi. Güncel native host Firefox için yeniden kuruldu, eklenti/ayarlar yenilendi ve gerçek native protokolüyle tamamlanmamış kaydın `ready: false` döndüğü doğrulandı.
- Gerçek hesapla başarılı giriş ve metin üretimi hâlâ doğrulanmış değildir. Kuruluş erişim engeli uygulama koduyla kaldırılmadı; kişisel hesabın ücretsiz olması planla üretim uygunluğu sağlamaz.

## 16. 15 Ekim 2026 — Hesap ve çalışma alanı değiştirme

- Kullanıcı Business hesabında `3p_login_workspace_scope_denied` bildirdi. Tek yarım kalmış kaydı sürdüren düğme ile yeni hesap/çalışma alanı ekleme ayrımı netleştirildi. Kişisel hesap için oluşan OAuth kaydı başka çalışma alanına taşınmaz; OpenAI'ın kayıt sınırları korunur.
- **Farklı hesap veya çalışma alanı ekle** düğmesi görünür hale getirildi; seçili kayıtla devam etmenin aynı hesap/çalışma alanını gerektirdiği TR/EN açıklamaya eklendi. Bu açık kullanıcı eylemi, geri dönüş yapmayan eski giriş denemesini iptal ederek yeni kayıt başlatabilir.
- Yeni kayıt akışı mevcut client ID, e-posta veya ID token ipucunu kullanmaz; cihaz kimliği ve eski hesaplar korunur. Yeni hesap doğrulanmadan etkin hesap değişmez. Normal yeniden giriş hâlâ mevcut client ID'yi kullanır.
- Workspace uyuşmazlığı callback ve token yanıtında `AI_WORKSPACE_MISMATCH` olarak ayrı eşlenir; yanlış `state` içeren callback yine reddedilir. Kuruluş politikası ve plan uygunluğu kontrolleri gevşetilmedi.
- Doğrulama: `pnpm check` (199 test) ve bağlantı ayarlarına yönelik 2 Chromium testi geçti. Yeni kayıt akışının eski hesap ipuçlarını taşımaması, bekleyen girişten yeni kayda geçiş ve kayıtların korunması test edildi. Güncel native host kuruldu ve Firefox eklentisi/ayarları yenilendi. Business hesabıyla yeni kayıt ve gerçek üretim kullanıcı denemesi bekliyor.

## 17. 16 Ekim 2026 — Hesap kaldırma ve bağlantı adları

- AI ayarlarına **Yeniden adlandır** ve onay pencereli **Hesabı kaldır** eklendi. Listeden kayıt seçmek artık giriş veya etkin hesap değişimi başlatmaz; tamamlanmamış kayıtlar da yönetilebilir. Bağlı başka bir hesabı etkinleştirmek için **Bu hesabı kullan** seçilir.
- İlk doğrulanmış girişte profil adı/e-posta kullanılır; aynı adlı bağlantılar numarayla ayrılır. Elle verilen, en fazla 80 karakterlik ad yeniden girişte korunur. Adlar cihazda saklanır; çalışma alanı adı tahmin edilmez. Eski varsayılan adlar başarılı yeniden girişte güncellenir.
- Kaldırma yerel hesap kaydını/token'larını siler ve varsa OpenAI oturumunu iptal etmeyi dener. Sunucu iptali doğrulanamazsa uyarı gösterilir. Çıkış kaydı korur; kaldırma unutur. ChatGPT hesabı veya sağlayıcıdaki uygulama kaydı silinmez. Etkin hesabın kaldırılması başka hesaba/API ücretlendirmesine geçmez.
- Bekleyen giriş iptal edilir; kaldırılmış hesaba gecikmiş OAuth yanıtı token kaydedemez. Kaydedilemeyen yeni refresh token iptal edilmeye çalışılır. Ayrı native süreçten kaldırma ve uçuş halindeki token yanıtı test kapsamındadır. Durum sorgulaması, ad düzenlemeyi yarıda kapatmaz.
- Sunum `AiAccountActions` bileşeninde, ad şeması `contracts` içinde, ad üretimi ve kalıcılık companion içinde tutulur. TR/EN metinler, Fluent tema değişkenleri, klavye erişimi ve dar ekran onay penceresi kullanılır.
- Business Premium için bildirilen `3p_delegated_access_policy_denied` kuruluş reddidir. Resmî belgelerden bu plan için kesin bir yönetici ayarı veya yayımlama yoluyla çözüm doğrulanamadı. Bağlantı rehberine hata kodu/istek kimliğiyle OpenAI desteğine başvurma yönlendirmesi eklendi; kuruluş erişimi koddan değiştirilmedi.
- Doğrulama: `pnpm check` geçti (212 test). Bağlantı ayarlarına yönelik 2 Chromium testi; ad değiştirme, kaldırmayı iptal etme/onaylama, çıkış, ilk kullanım ve model seçimini doğruladı. Açık/koyu tema ve 390 px ekran görüntüleri incelendi. Testler sentetik hesaplarla çalışır; gerçek ChatGPT üyeliğiyle üretim hâlâ doğrulanmış değildir.
- Güncel native host Firefox için yeniden kuruldu ve çalışan Firefox geliştirme eklentisi yeniden yüklendi. Kullanıcının hesap kayıtları silinmedi veya yeniden adlandırılmadı.

## 18. 16 Ekim 2026 — Plus hesabında üretim uygunluğu reddi

- Kullanıcı kişisel Plus aboneliğinin aktif olduğunu doğruladı. Canlı kontrolde doğrulanmış hesap, süresi dolmamış oturum ve `chatgpt.tokens.use.direct` izni bulundu; `GET /v1/models` HTTP 200 ile model listesini döndürdü.
- Kişisel veri içermeyen tek bir minimal `POST /v1/responses` isteği, seçili model ve belgelenmiş `store:false`/`stream:true` alanlarıyla HTTP 403 ve `subscription_sharing_user_not_eligible` döndürdü. Bu deneme e-posta prompt'unu kullanmadı; gerçek e-posta aktarılmadı. Yanıtta `x-request-id` yoktu. Kimlik/token bilgileri çıktıya veya belgelere yazılmadı.
- Üretim reddinin sağlayıcıdan geldiği doğrulandı; alttaki uygunluk/politika nedeni henüz açıklanmış değildir. Giriş, izin ve model kataloğu başarısı üretim uygunluğunu garanti etmez. Hesabı tekrar tekrar silip ekleme veya aynı isteği tekrarlama yapılmadı; OpenAI desteğine somut hata koduyla başvurma yönlendirmesi eklendi.
- Genel HTTP 403 artık `AI_NOT_ELIGIBLE` sayılmıyor; `AI_ACCESS_DENIED` olarak ayrılıyor. Uygunluk hatası yalnızca açık sağlayıcı koduyla eşleniyor. TR/EN uygunluk uyarısı bu kodu gösterir ve aktif Plus/Pro hesabı için destek yönlendirmesi içerir. Route/kapsam erişim reddi ve model hatası da uygunlukla karıştırılmaz.
- Doğrulama: `pnpm check` geçti (217 test); gerçek uygunluk reddi ile genel 403, route/kapsam ve model hatası ayrımı test edildi. Native host Firefox için yeniden kuruldu, geliştirme eklentisi güncellendi. Başarılı üretim hâlâ engellidir; sağlayıcı kısıtlamasının giderildiği iddia edilmez.

## 19. 16 Ekim 2026 — Plus hesabında üretim çalıştı; bağlantı göstergesi düzeltildi

- Aynı kişisel Plus oturumuyla, yeniden giriş yapılmadan, kişisel veri içermeyen kısa bir `POST /v1/responses` isteği HTTP 200 ve `response.completed` ile tamamlandı. Kurulu native host üzerinden sentetik bir "Düzelt" isteği de yaklaşık 4 saniyede doğru sonuç verdi. Token ve hesap bilgileri çıktıya veya belgelere yazılmadı.
- Gözlem: Birkaç dakika arayla alınan iki model listesi 3 modelden 7 modele çıktı. §18'deki 403 (`subscription_sharing_user_not_eligible`) büyük olasılıkla ücretsizden Plus'a geçişin OpenAI tarafında henüz etkinleşmemesindendi. OpenAI bu gecikmeyi belgelemiyor; bu bir çıkarımdır.
- **Hata:** Native süreç her başlatıldığında model kataloğu bellekte boş başlıyordu. Outlook'taki gösterge (5 saniyede bir `AI_SUMMARY`) bağlı hesabı "Üretim için AI hesabınızı bağlayın" diye gösteriyordu. Bu durum yalnızca ayarlardaki Yenile veya bir üretimle düzeliyordu. Firefox arka planı yeniden başlattığında ve `pnpm outlook:dev` her derlemede eklentiyi yeniden yüklediğinde tekrar ediyordu.
- **Düzeltme** (`apps/ai-companion/src/ai-service.ts`): Bağlı hesabın durumu sorulunca katalog süreç ve hesap başına bir kez yüklenir (yalnızca `GET /v1/models`; üretim isteği yok). Girişten sonraki yükleme de bu tek denemeye sayılır. Başarısız yükleme her sorguda tekrarlanmaz; hata ayarlarda görünür, Yenile veya üretim yeniden dener. Eşzamanlı sorgular aynı yüklemeyi bekler.
- Doğrulama: `pnpm check` geçti (219 test). Native host yeniden derlenip Firefox için kuruldu; yeni süreçte ilk durum sorgusu `ready: true` döndü.

## 20. 16 Ekim 2026 — Claude aboneliği (bilgisayardaki Claude Code)

- **Karar:** Kullanıcı Claude için yalnızca bilgisayardaki Claude Code yolunu seçti. Anthropic'in sayfaları 16 Ekim 2026'da okundu: destek makalesi `claude -p` ve üçüncü taraf uygulamaların abonelik limitleriyle kullanılabildiğini söylüyor; geliştirici kuralları uygulama içinde Claude girişi sunmayı ve kimlik bilgisi toplamayı yasaklıyor, son kullanıcının değiştirilmemiş Claude Code'a kendi aboneliğiyle girişine izin veriyor. Dağıtılan uygulamalar açıkça ele alınmıyor; yöntem varsayılan değil ve herkese açık yayından önce Anthropic'ten yazılı teyit gerekiyor.
- **Yeni paket `packages/ai-claude-code`:** Claude Code'u bulur (kurucunun kaydettiği yol, PATH, bilinen konumlar), giriş durumunu `claude auth status --json` ile okur, üretimi `claude -p` ile yapar. Araçlar, kullanıcı/proje ayarları ve hook'lar, MCP sunucuları, skill'ler ve oturum kaydı kapalıdır; istem stdin'den, boş ve sonra silinen geçici klasörde çalışır. stderr okunmaz; hata mesajları kararlı koda çevrilir.
- **Yerel uygulama:** Yeni yöntem `claude-code`. Giriş durumu 30 saniye önbelleğe alınır (gösterge 5 saniyede bir sorar); "girişsiz" yanıtı üretimden önce yeniden denetlenir. Model seçimi saklanır (Sonnet varsayılan, Haiku, Opus). Eski kimlik dosyaları değişmeden okunur. OpenAI kimlik yolu bu yöntemde hiç çalışmaz.
- **Kurucu:** `claude` yolunu, `CLAUDE_CONFIG_DIR` değerini ve Node.js klasörünü başlatıcıya yazar; `USER` yoksa `id -un` ile tamamlar (macOS'ta Claude Code anahtar zinciri girişini kullanıcı adıyla bulur). Bu olmadan kısıtlı ortamda giriş "yok" görünüyordu.
- **Ortak talimat:** E-posta görev talimatı `contracts` içine (`AI_TASK_INSTRUCTIONS`) taşındı; iki sağlayıcı aynı talimatı kullanır. Sağlayıcı paketlerinin birbirini içe aktarması ESLint ile engellendi.
- **Arayüz:** Ayarlarda üçüncü yöntem "Claude aboneliği": Claude Code hesabı, kuruluş ve plan, kurulum/giriş yönlendirmesi, API ile faturalanma uyarısı ve Anthropic gizlilik notu. Gösterge "Claude aboneliği kullanılıyor" yazar. Yeni hata kodları: `AI_CLAUDE_NOT_INSTALLED`, `AI_CLAUDE_NOT_LOGGED_IN`.
- **Canlı doğrulama:** Kurulu yerel uygulama kısıtlı ortamla başlatıldı; Claude Code girişi (Team) okundu, sentetik Düzelt ve Yanıt üretimleri ~3 saniyede doğru sonuç verdi; Claude Code oturum kayıtlarında deneme metni yok. Kullanıcının seçili yöntemi denemeden sonra geri yüklendi.
- Doğrulama: `pnpm check` (240 test); sahte bir `claude` programıyla argümanlar, stdin, geçici klasör, iptal ve hata eşlemeleri test edildi.

## 21. 16 Ekim 2026 — "Kaynak değişti" hatası ve ayarlar sayfasının yeniden tasarımı

**Hata:** Yanıt hazırlandıktan sonra "Taslağa uygula" çalışmıyor, önizlemede "Kaynak değişti" yazıyordu.
- **Kök neden:** Kart kapatılıp aynı düğmeyle ("Yanıt yaz") yeniden açılınca taslak yeniden okunuyordu. Metin aynı olsa bile form sürümü artıyor, hazır yanıt eskimiş sayılıyor ve uygulama engelleniyordu. Testle yeniden üretildi (sürüm 4 → 5, uygulama 0).
- **Düzeltme** (`core/session/reduce-session.ts`): Kaynak yeniden alındığında form sürümü yalnızca metin gerçekten değiştiyse artar; aynıysa taslağın güncel sürümü kaydedilir ve sonuç o sürüme uygulanır. Taslağa yazı eklendiyse önizleme yine eskir ve uygulanmaz.
- Testler: aynı metinle yeniden alma, değişen metin, kartı yeniden açıp uygulama ve taslağa yazı ekledikten sonra yeniden açma.

**Ayarlar sayfası:**
- Kartlara bölündü: AI bağlantısı, Bağlantı rehberi, Yazma tercihleri, Gizlilik ve veriler. Başlıkta uygulama simgesi; renkler Fluent belirteçlerinden, açık/koyu temada ve telefon genişliğinde (yatay kaydırma yok) doğrulandı.
- AI bağlantısı: durum rozeti (Hazır / Kurulum gerekli / Bağlantı gerekli), simgeli ve açıklamalı yöntem kartları (gerçek radyo düğmeleri; klavyeyle gezinilebilir), yönteme özel içerik ayrı alanda, gizlilik notu kalkan simgesiyle. Koyu temada "Continue with ChatGPT" beyaz düğme.
- **Bağlantı rehberi** (`AiConnectionGuide`): her yöntem için Gerekenler, Adımlar, Bilmeniz gerekenler; yardımcı uygulama bölümü. Seçili yöntem açık gelir; resmî kurulum sayfalarına bağlantılar. Claude bölümü hesap bilgisine erişilmediğini, ortak limiti, Pro/Max eğitim ayarını ve yöntemin deneysel olduğunu açıkça söyler.
- Yazma tercihleri: dil ve ton yan yana, tema için parçalı seçim, Outlook ayarı için anahtar düğmesi, kaydedilmemiş değişiklik uyarısı. Sayfanın dili arayüz diliyle eşitlenir.
- Gizlilik ve veriler: tek paragraf yerine maddeler.
- Doğrulama: `pnpm check` (247 test), Chromium uçtan uca 8/8, Firefox duman testi; ekran görüntüleriyle görsel kontrol.

## 22. 16 Ekim 2026 — Esnek diller, kalıcı talimat, AI bağlamı ve biçimli içerik

- **Çeviri dilleri:** Sabit 4–5 dil yerine BCP 47 kataloğu (~68 dil, adlar `Intl.DisplayNames` ile arayüz dilinde) ve serbest yazım; kullanıcı listede olmayan bir dili de yazabilir (`contracts/src/languages.ts`, `targetLanguageSchema`). Ayarlarda varsayılan dil ve en fazla 10 favori dil; araç çubuğunun Çevir menüsü favorileri, "Başka bir dil…" ve "Dilleri düzenle" sunar. Yanıt ve yeni e-posta dili kendiliğinden belirlenir (yanıtlanan mesajın dili); hedef dil yalnızca çeviride gönderilir.
- **Kalıcı talimat:** Ayarlarda "her zaman kurumsal ve resmî yaz" gibi en fazla 1000 karakterlik tercih; her üretime `<standing_preferences>` olarak eklenir, o anki talimatla çelişirse talimat kazanır.
- **Arayüz dili:** Otomatik (tarayıcı dili, yoksa İngilizce) + Türkçe + English. Almanca/Fransızca/İspanyolca çevirileri sonraki adım.
- **Ayarlar şeması v2:** `favoriteLanguages`, `writingInstructions`, `uiLanguage: 'auto'`. v1 kayıtları kendiliğinden taşınır; gelecekteki bilinmeyen sürüm varsayılanlarla açılır ve üzerine yazılmaz.
- **AI istemi** (`contracts/src/ai-prompt.ts`, iki sağlayıcı ortak kullanır): bölümlü sistem talimatı (görev, çıktı, biçim, dil, ton, tercihler, güvenlik) ve etiketli kullanıcı mesajı (`<task …/>`, `<instruction>`, `<standing_preferences>`, `<source>`/`<draft>`, `<conversation>`/`<message sender sent reply_target>`, `<previous_result>`, `<refinement>`). E-posta içeriği "güvenilmeyen veri" sayılır; içindeki etiket taklitleri etkisizleştirilir.
- **Biçimli içerik** (yeni paket `packages/email-format`): model, sınırlı bir Markdown alt kümesi (kalın/italik, liste, tablo, güvenli bağlantı, ```chart bloğu) üretebilir. Ayrıştırılan yapıdan e-postaya uygun HTML (satır içi stiller, kenarlıklı tablo, tablo tabanlı çubuk grafik), düz metin ve "taslaktan geri okunacak metin" üretilir; bütün metin kaçışlanır, yalnızca http/https/mailto bağlantıları kabul edilir. Önizleme biçimli gösterir ("Kaynağı düzenle" ile Markdown açılır); kopyalama hem HTML hem düz metin verir. Cümle içindeki seçime biçimli içerik yazılmaz.
- **Sonucu değiştir:** Hazır sonuç "Tablo yap", "Madde madde", "Grafik ekle", "Kısalt", "Daha resmî", "Daha samimi" veya serbest istekle değiştirilir; özgün görev bağlam olarak kalır, önceki sonuç `<previous_result>` olarak gider.
- **Gerçek Outlook'ta bulunan ve düzeltilen hatalar:** Chrome'da gövde değiştirilirken son satır imzanın ilk satırına birleşiyordu ("Saygılarımla--"); yazma aralığının uçları artık blokların içine konuyor. Kısa (tek satır) yanıt editöründe araç çubuğu görünmüyordu; artık bölgenin altına/üstüne yerleşiyor ve kırpan üst kapsayıcıların boyutu da izleniyor. Eklenti yeniden yüklenince sayfada kalan sahipsiz arayüz yeni oturum başlarken temizleniyor.
- Doğrulama: birim/entegrasyon testleri, Chromium uçtan uca (biçimli tablo ve çok satırlı gövde senaryoları), Firefox duman testi.

## 23. 16 Ekim 2026 — Gerçek Outlook'ta biçimli yazma: canlı doğrulama ve düzeltmeler

Kullanıcı izniyle geliştirme Firefox'unda geçici yanıt taslaklarında, yalnızca uydurma metinle (işaret `EWTEST-7Q`) Claude üzerinden Düzelt → Tablo yap → Taslağa uygula → Geri al denendi. Her denemeden sonra taslak Outlook'un Discard düğmesiyle silindi; hiçbir şey gönderilmedi.

- **"Seçilen taslak kapandı" (uygulama engelleniyordu):** Outlook yanıtı konuşmaya geç bağlıyor; bağlantı modülü aynı editörü "kaldırıldı + eklendi" diye bildiriyor, oturum çalışmayı geçersiz sayıyordu. Yeni olay `composer-rebound`: editör, sürümü, seçim ve geri alma kayıtları korunur; oturum kayıtları yeni kimliğe taşınır. Araç çubuğunun anahtarı artık konuşma bağını içermiyor; etiket ("Yaz" → "Yanıt yaz") yerinde güncelleniyor, kart yeniden kurulmuyor.
- **"Taslak işlem başladıktan sonra değişti":** Taslak sürümünün parmak izi bütün editörü (alıntı dahil) kapsıyordu; Outlook alıntıyı sonradan doldurunca ve yazılan tabloyu kendi yapısına göre yeniden düzenleyince çalışma geçersiz sayılıyordu. Parmak izi artık yalnızca kullanıcının bölgesindeki (boşlukları sadeleştirilmiş) metin ve tablo/resim sayısı. Seçime yazma metin konumlarını yazma anında ayrıca doğruluyor.
- **"Metnin yerleştiği doğrulanamadı":** Outlook alıntıyı editöre ilk yazmayla birlikte ekliyordu. Yazmadan önce editöre odak verilip Outlook'un tepkisi bekleniyor; korunan bölge (imza, alıntı) "aynı kalmalı ya da yalnızca sonuna içerik eklenmiş olmalı" kuralıyla doğrulanıyor. İmzanın başı değişirse (ör. son satırın imzaya birleşmesi) sonuç yine doğrulanmıyor.
- **Kart dar alanda:** İçerik kaydırılınca "Taslağa uygula" görünür alanın dışında kalıyordu; kartın alt bölümü artık sabit. Kullanıcı düğmeye basılı tutarken araç çubuğu ve kart yer değiştirmiyor (Outlook odak değişiminde editörü büyütebiliyor).
- **Outlook onay pencereleri:** Kart en üst katmanda olduğu için "Discard message" penceresinin OK düğmesini örtebiliyordu. Eklenti arayüzü artık sayfa içeriğinin üstünde, Outlook'un açılır katmanlarının (z-index 1000000) altında.
- **Yazmadan sonra yanıltıcı uyarı:** Başarılı yazmadan sonra kapalı "Taslağa uygula" için "taslak değişti" gerekçesi gösterilmiyor. Doğrulanmış geri almadan sonra aynı sonuç gövdeye yeniden uygulanabiliyor; seçim hedefinde yeniden seçim isteniyor.
- **İstem:** Model iyileştirmede tablo başlıklarını İngilizceye çevirdi ve bir kez e-posta yerine kendi açıklamasını döndürdü; "saat 3"ü "15:00" yaptı. İstemde: iyileştirme önceki sonucun dilinde kalır, yanıtın tamamı olduğu gibi taslağa girer (görev/dil/değişiklikler hakkında yorum yok), sayı ve zamanlar yeniden yorumlanmaz, bilgi düşürülmez. Kurulu host ile 7 sentetik üretimde açıklama 0, saat ve tutarlar korundu.
- **Claude Haiku kaldırıldı:** Aynı istemde ve yalın bir istemde Türkçe yanıtlarda harf tekrarı üretti ("bbana", "bbizim"); Sonnet temizdi. Haiku sunulmuyor; kayıtlı seçim Haiku ise Sonnet kullanılır.
- **Sürüm uyuşmazlığı:** Yerel yardımcı uygulama tanımadığı isteği sessizce düşürüyordu; eklenti 130 sn bekleyip belirsiz hata gösteriyordu (eklenti ve host ayrı güncellenirse olası). Artık hemen `AI_VERSION_MISMATCH` döner: "Eklenti ile yerel yardımcı uygulamanın sürümleri uyuşmuyor…".
- **Geliştirme ortamı notları:** `pnpm outlook:dev` kod değişince sekmeyi yeniler; açık taslak varsa Outlook "sayfadan ayrıl" onayı çıkar ve yenileme bekler (eski içerik betiği ölür, kart sahipsiz kalır). Firefox tek BiDi oturumuna izin verir; yarım kalan otomasyon oturumu `pnpm outlook:firefox --restart` gerektirir (yalnızca geliştirme profili). `@import` ile gelen CSS değişikliği izleyiciyi tetiklemeyebilir.
- Doğrulama: `pnpm check` (286 test), Chromium uçtan uca 10/10, Firefox duman testi; canlı Outlook'ta tablo yazma, alıntı ve imza korunumu, geri alma ve yeniden uygulama, kart açıkken Discard onayı.

## 24. 16 Ekim 2026 — Almanca, Fransızca ve İspanyolca arayüz

- Arayüz dilleri: Otomatik, Türkçe, English, Deutsch, Français, Español. "Otomatik" tarayıcının desteklenen ilk dilini seçer, yoksa İngilizce.
- Metinler (`locales/de|fr|es.ts`, `ai-de|fr|es.ts`): panel, araç çubuğu, sonuç kartı, hata mesajları, araç çubuğu penceresi, ayarlar ve bağlantı rehberi. Terimler her dilde Outlook'un kendi arayüzüyle uyumlu (Entwurf / brouillon / borrador); Almanca ve Fransızcada resmî hitap ("Sie", "vous"), İspanyolcada Microsoft'un güncel üslubu ("tú"). Marka ve OpenAI'ın zorunlu düğme adı ("Continue with ChatGPT") çevrilmedi.
- Kod düzenlemeleri: dil adları her metin dosyasında tekrarlanmıyor, tek sabitten geliyor (`UI_LANGUAGE_NAMES`); sayılı metinlerde tekil/çoğul `Intl.PluralRules` ile (`countWith`; Fransızcada 0 tekildir); eski v1 ayar şeması kendi iki diliyle donduruldu, dil listesi büyüdükçe değişmiyor.
- Araç çubuğu Almancada ~436 px (Türkçede ~271 px). Dar bölmede ekranın soluna taşmaması için konum sınırlandı; 480 px pencerede ve üç dilde kart/araç çubuğu ekran görüntüsüyle kontrol edildi.
- Test: her dilde boş metin olmaması ve uzun İngilizce cümlelerin çevrilmeden kalmaması, tarayıcı dilinden seçim, çoğul kuralı.
- Bekleyen: Almanca/Fransızca/İspanyolca Outlook arayüzünde bağlantı modülünün canlı doğrulaması (seçiciler dil bağımsız tasarlandı; `docs/outlook-web-dogrulama.md`).


## 25. 16 Ekim 2026 — Yerel yardımcı uygulama Windows'ta

Windows 11 Pro üzerinde (Node.js 24, pnpm 12.11) yapıldı ve doğrulandı. macOS/Linux davranışı korunuyor; kurulum planları her sistem için her makinede birim testle sınanıyor.

- **Platform farkları tek yerde:** `apps/ai-companion/src/platform.ts` kurulum ve kimlik konumlarını, tarayıcı kaydını (macOS/Linux'ta dosya, Windows'ta HKCU anahtarı), başlatıcı biçimini, tarayıcı açmayı ve Claude Code arama yerlerini tanımlar. Kodun geri kalanında işletim sistemi denetimi yok. Yollar hedef sistemin kurallarıyla (`path.win32`/`path.posix`) üretilir.
- **Kurucu TypeScript'e taşındı:** saf plan (`install-plan.ts`: dosyalar, içerikleri, kayıt girdileri) ve bunu uygulayan ince komut (`install.ts`). `pnpm ai:build` host ile kurucuyu birlikte derler; `scripts/install-host.mjs` derleme yoksa açık bir mesaj verir. Host adı ve Firefox eklenti kimliği tek kaynaktan (`contracts`) gelir; `wxt.config.ts` de aynı kimliği kullanır.
- **Windows konumları:** program `%LOCALAPPDATA%\Programs\email-writer` (kullanıcıya özel program klasörü), kimlik bilgileri `%LOCALAPPDATA%\email-writer` (dolaşan profile kopyalanmaz). Tarayıcı manifesti tarayıcı başına `com.email_writer.ai.<tarayıcı>.json`; `HKCU\Software\{Google\Chrome | Microsoft\Edge | Chromium | Mozilla}\NativeMessagingHosts\com.email_writer.ai`. Kurucu yalnızca kendi anahtarlarını yazar/siler (kod düzeyinde denetlenir); yönetici izni gerekmez.
- **Brave ve Opera (gerçek deneme):** Resmî Brave belgesi yok. Anahtarlar tek tek açılarak denendi: Brave 1.97 ve Opera 137 önce `Software\Chromium`, sonra `Software\Google\Chrome` anahtarını okuyor ve ilk bulduğu manifestte duruyor; kendi anahtarlarını (`BraveSoftware\Brave-Browser`, `Opera Software`) okumuyor. Brave bu yüzden `Chromium` anahtarına kaydediliyor (Chrome kaydıyla çakışmaz). Opera aynı anahtarı Brave ile paylaşmak zorunda olduğundan kurucuya eklenmedi; mağaza kimlikleri sabitlenince tek manifest üçünü birlikte karşılayabilir.
- **İzinler:** Profil klasörünün varsayılan izni kullanıcı, SYSTEM ve Administrators (yeterli). Kimlik klasörü ilk oluşturulduğunda yine de `icacls` ile devralma kaldırılıyor, yalnızca kullanıcı ve SYSTEM kalıyor; kısıtlanamazsa klasör silinip hata veriliyor. Dosya değişimi, Windows'ta dosyayı kısa süre tutan virüs tarayıcısına karşı birkaç kez yeniden deneniyor.
- **Başlatıcı (`.cmd`):** UTF-8 ve `chcp 65001` ile başlıyor; denemede sistemin kod sayfası 437 iken `ş` içeren yol yalnızca bu satırla bulundu. `%` kaçışlanıyor, gecikmeli genişletme kapalı. Windows'ta tarayıcı tam ortamı aktardığı için yalnızca Claude Code yolu ve `CLAUDE_CONFIG_DIR` kaydediliyor.
- **ChatGPT girişi:** tarayıcı `rundll32.exe url.dll,FileProtocolHandler` ile kabuksuz açılıyor (URL tek argüman, `&` korunur); yalnızca `https://` adresleri açılıyor. Windows araçları `%SystemRoot%\System32` tam yoluyla çağrılıyor (Git Bash'in `whoami`'si PATH'te önde olduğu için testte de görüldü).
- **Claude Code:** Windows'ta PATH'te `claude.exe`/`claude.cmd`, `%USERPROFILE%\.local\bin\claude.exe`, WinGet bağlantısı ve `%APPDATA%\npm\claude.cmd` aranıyor. Betikler kabukla çalıştırılmıyor; npm'in `claude.cmd`'si paketin `bin\claude.exe` programına çevriliyor (yer tutucu dosya "MZ" imzasıyla ayırt ediliyor). Çözülemeyen betik için yeni hata kodu `AI_CLAUDE_UNSUPPORTED_INSTALL` (5 dilde metin); ayarlarda hata alanında gösteriliyor. Sağlayıcı artık `{ file, args }` komutuyla ve `windowsHide` ile başlatıyor; en uzun argüman listesi ~3.500 karakter (sınır 32.767).
- **Testler ve araçlar:** Sahte `claude` her sistemde `node` + betik olarak çalışıyor. Yeni testler: üç sistemin kurulum planları, kayıt anahtarları, başlatıcı içeriği ve kaçışlama, tarayıcı açma, Claude arama sırası, npm betiği çözümü, kimlik klasörü ACL'i (Windows) ve izinleri (POSIX), başlatıcının Chrome ve Firefox gibi `cmd.exe` ile `Derviş & 100% Ünal` klasöründen başlatılması (Windows). `tests/support/firefox/firefox-process.mjs` Firefox'u Windows kurulum klasörlerinde buluyor ve profile ait Firefox'u PowerShell ile kapatıyor.
- **Doğrulama (Windows 11):** `pnpm check` geçti (325 test, POSIX'e özgü 2 test atlandı); `pnpm test:e2e` 10/10; `pnpm test:firefox` 5/5.
- **Canlı doğrulama** (yalnızca sentetik metin; Outlook'a girilmedi): Chrome 155 (eklenti CDP `Extensions.loadUnpacked` ile; Chrome 137+ `--load-extension`'ı yok sayıyor), Edge 155, Brave 1.97 ve Firefox 157 ayrı test profillerinde; dördünde de ayarlar sayfasındaki "Yerel AI bağlantısına ulaşılamadı" uyarısı kalktı. `--uninstall` yalnızca ilgili tarayıcının anahtarını ve manifestini sildi, tekrarında hata vermedi. Kurulu başlatıcıya Chrome biçimiyle native mesajlar gönderildi: Claude Code ile Düzelt/Çevir/Yanıt ~3 sn, 120 satırlık girdi ~17 sn; `--tools ""` ve sistem talimatının doğru ayrıştırıldığı Claude Code'un başlangıç olayından doğrulandı; oturum kaydı ve geçici klasör kalmadı. Chrome ve Firefox'ta geliştirme derlemesiyle sentetik sayfada Düzelt gerçek Claude sonucuyla tamamlandı. ChatGPT: giriş `rundll32` ile varsayılan tarayıcıda açıldı, kullanıcı tamamladı, loopback dönüşü alındı, plan izni ve 7 model geldi; sentetik Düzelt ve Çevir başarılı. Token veya hesap bilgisi yazdırılmadı.
- **Bekleyen / macOS'ta doğrulanacak:** macOS/Linux'ta `pnpm ai:install` ile kurulum ve mevcut kayıtların yeniden kurulumu (başlatıcı içeriği testle birebir korunuyor); Brave'in macOS/Linux'ta mevcut `BraveSoftware/...` klasörünü gerçekten okuyup okumadığı (Brave kaynağı bu sistemlerde Chrome konumlarına yönlendirme yapıyor görünüyor); Firefox'ta kullanıcı klasörü boşluksuz ve `&`/`^` içerirse başlatıcı başlamaz (Firefox tırnaklamıyor); grup ilkesiyle kullanıcı düzeyi hostlar kapatılabilir.
