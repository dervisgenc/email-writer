# Outlook Web gerçek sayfa doğrulaması

Durum: **Okuma tarafı kısmen doğrulandı** (15 Ekim 2026): iş hesabı, İngilizce arayüz, Firefox 157 (macOS), okuma bölmesinde yalnızca seçili mesaj. Konuşma görünümü (çok mesajlı okuma bölmesi), taslak ve yazma kontrolleri bekliyor. Sonuçlar §3'te.
İlgili adım: `implementation_details.md` §20.1 Adım 2 ("Gerçek Outlook'u incele") ve §20.3 açık noktalar.

Bu belge iki şey içerir:

1. Outlook Web DOM yapısı hakkında kamuya açık kaynaklardan yapılan araştırmanın özeti. Seçicilerin neden bu şekilde seçildiğini açıklar.
2. Gerçek hesapla yapılacak doğrulamanın adım adım protokolü ve sonuçların kaydedileceği yer.

> Sentetik örnek sayfalarda geçen testler, gerçek Outlook sayfasının doğrulandığı anlamına gelmez. İki sonuç ayrı raporlanır (§19.2).

## 1. Araştırma özeti (Ekim 2026)

Kaynaklar: açık kaynak eklentiler (Toggl, Clockify, PreMiD, Briskine, scrum_helper, inbox-zero), kullanıcı betikleri, kamuya açık `.eml` örneklerindeki gerçek Outlook DOM parçaları ve Microsoft RoosterJS kaynak kodu. Bulgular `packages/mail-connectors/outlook-web/src/discovery/selectors.ts` içine `evidence` düzeyiyle işlendi.

| Bölge | Aday seçici | Kanıt | Not |
| --- | --- | --- | --- |
| Okuma bölmesi | `#ReadingPaneContainerId`, `#ConversationReadingPaneContainer`, `#ItemReadingPaneContainer` | Yüksek | Toggl, PreMiD, Clockify |
| Mesaj gövdesi | `[id^="UniqueMessageBody"]`, `div[role="document"]` | Orta | `.eml` örneklerinde `div#UniqueMessageBody_N[role="document"]`; `aria-label` dile bağlı ("Message body", "Corpo da mensagem") |
| Gösterilen e-posta HTML'i | `x_` ön ekli kimlikler, `div.rps_xxxx` sarmalayıcı | Yüksek | `rps_` soneki üretilmiştir, kullanılmaz |
| Alıntı başlangıcı | `[id$="divRplyFwdMsg"]`, `[id$="appendonsend"]`, `OLK_SRC_BODY_SECTION`, `mail-editor-reference-message-container` | Yüksek | Alıntı içinde `x_x_` ön eki tekrarlanır; sonek eşleşmesi kullanılır |
| İmza | `#Signature` (`elementToProof`), `x_Signature` | Yüksek | |
| Yanıt yapısı | `#Signature` → `#appendonsend` → `hr` → `#divRplyFwdMsg` → orijinal mesaj | Yüksek | "From/Sent/To" etiketleri dile bağlı |
| Editör | `div[role="textbox"][contenteditable="true"][aria-multiline="true"]` | Yüksek | Sayfadaki tek çok satırlı metin kutusu olduğu belirtiliyor |
| Yerleşik yanıt bölgesi | `[id^="docking_InitVisiblePart"]` | Orta | Briskine |
| Ayrı pencerede taslak | `[data-app-section="Form_Content"]` | Orta | Farklı alan adı/iframe olabilir; Briskine `all_frames` + `match_about_blank` kullanıyor |
| Seçili konuşma | `[role="option"][aria-selected="true"][data-convid]` | Orta | Klasör değişiminden sonra 15–25 sn bulunmayabiliyor; arama sonuçlarında yok |
| URL kimliği | `/mail/<klasör>/id/<id>`, `/deeplink/read/<id>`, `/deeplink/readconv/<id>` | Orta | Belgelenmemiş biçim |
| Hesap ipucu | `#owa-me-control-container button[aria-label]`, `#O365_MainLink_Me` | Orta | Yalnızca opak özet (hash) alınır |
| **Gönderen / tarih** | `span[title*="@"]`, `[id^="MSG_"][id$="_FROM"]`, `time[datetime]` | **Düşük** | Güvenilir kaynak bulunamadı |
| **Açık/kapalı mesaj** | `[role="listitem"][aria-expanded="false"]` | **Düşük** | Kanıt bulunamadı |

### Taslağa yazma yöntemi hakkında bulgular

- Outlook Web editörü Microsoft'un **RoosterJS**'idir.
- RoosterJS kaynağına göre sentetik bir `paste` olayı (`clipboardData` ile) editörün kendi yapıştırma yolunu çalıştırır, geri alma kaydı alır ve `contentChanged` bildirir. Editöre en uygun yol budur.
- `execCommand('insertText')` ve `Range.insertNode` yalnızca editörün önbelleğini geçersiz kılar; RoosterJS geri alma kaydı veya `contentChanged` oluşmaz.
- Ctrl+Z RoosterJS'in kendi geri alma yığınıyla çalışır.
- Firefox'ta içerik betiğinde oluşturulan `DataTransfer` sayfa koduna erişilemeyebilir (Xray sınırı). Briskine bu yüzden olayı sayfa bağlamından gönderiyor.
- **Taslağın otomatik kaydedilmesiyle ilgili kamuya açık kanıt yok.**

Kodda iki yazıcı hazır (`packages/mail-connectors/outlook-web/src/writing/editor-writer.ts`):

| Yazıcı | Kimlik | Varsayılan | Durum |
| --- | --- | --- | --- |
| `createExecCommandWriter` | `exec-command-insert-text` | Evet | Sentetik sayfada Chromium ve Firefox'ta çalışıyor; Outlook'ta doğrulanmadı |
| `createPasteEventWriter` | `synthetic-paste-event` | Hayır | Outlook'ta denenmedi; Firefox'ta sayfa bağlamı gerekebilir |

İki yöntem birbiri ardına denenmez (§14.3). Hangisinin kullanılacağına aşağıdaki doğrulama karar verir. Yazıcı, `entrypoints/outlook.content.ts` içinde `createOutlookWebConnector({ writer })` ile değiştirilir.

## 2. Doğrulama protokolü

### 2.0 Otomatik inceleme aracı (okuma tarafı)

Okuma seçicileri ve konuşma okuma, eklentinin kendi kodu gerçek sayfada çalıştırılarak denetlenir:

```sh
pnpm outlook:firefox                 # kalıcı profilli Firefox; Outlook'a bir kez giriş yapılır
pnpm outlook:dev                     # eklentiyi aynı pencerede canlı yenilemeyle çalıştırır (elle kontroller için)
pnpm outlook:inspect rows            # konuşma satırları (maskeli)
pnpm outlook:inspect open 3          # satıra tıklar, açılan konuşmayı bağlantıyla okur
pnpm outlook:inspect read            # açık konuşmayı okur
pnpm outlook:inspect selectors       # her seçicinin ayrı eşleşme sayısı
pnpm outlook:inspect structure       # okuma bölmesinin anonim DOM yapısı (gövdelerin içi gizli)
pnpm outlook:inspect theme           # Outlook tema renkleri
pnpm outlook:inspect layout          # eklenti düğmelerinin konumu ve Outlook düğmeleriyle çakışma
pnpm outlook:inspect diagnose-reply  # "Reply" geçişinde bağlantının durumu (boş taslak açar; elle kapatılır)
```

- Araç Firefox'a WebDriver BiDi ile bağlanır ve `createOutlookWebConnector` → `readThread` yolunu, sayfanın JavaScript'inden yalıtılmış bir BiDi sandbox'ında çalıştırır.
- **Çıktılar maskelidir:** büyük harf `X`, küçük harf `x`, rakam `0`, satır sonu `⏎` olur. Gerçek metin, ad, adres ve kimlikler terminale ve diske yazılmaz (implementation_details.md §17.2).
- Araç yalnızca okur ve konuşma satırına tıklar. E-posta göndermez, yanıtlamaz, silmez, taşımaz ve klavye olayı göndermez.
- Tıklamadan önce noktanın bir eylem düğmesine (sil, bayrak, seçim kutusu) denk gelmediği kontrol edilir. Tıklamadan sonra hedef satırın seçildiği doğrulanır; doğrulanamazsa okuma yapılmaz.
- Açılan konuşma Outlook'ta okundu olarak işaretlenir.
- Profil depo dışında, `~/.email-writer/firefox-outlook-profile` altında durur ve oturum çerezlerini içerir.
- Firefox penceresi kapandıysa veya yarım kalmış bir otomasyon oturumu yeni bağlantıyı engelliyorsa: `pnpm outlook:firefox --restart`.

### 2.1 Hazırlık

```sh
pnpm install
pnpm dev            # Chromium: test eklentisiyle tarayıcı açılır
pnpm dev:firefox    # Firefox
```

Geliştirme derlemesi:
- açıkça etiketlenmiş örnek sonuçları ("Örnek sonuç — geliştirme modu") kullanır;
- araç çubuğu penceresinde **seçici tanılaması** gösterir: her seçici anahtarı için yalnızca eşleşme sayısı, içerik yok.

Oturumun her açılışta kaybolmaması için tarayıcı profilini kalıcı yapabilirsiniz (`apps/browser-extension/web-ext.config.ts`, depoya eklenmez):

```ts
import { defineWebExtConfig } from 'wxt';

export default defineWebExtConfig({
  // Chrome dışındaki bir Chromium tarayıcısı kullanılacaksa yolu verilir:
  // binaries: { chrome: '/usr/bin/brave-browser' },
  startUrls: ['https://outlook.office.com/mail/'],
  // Chromium için kalıcı profil (Outlook'a bir kez giriş yapılır):
  chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
  // Firefox için: firefoxProfile: '<profil yolu>', keepProfileChanges: true,
});
```

Alternatif: `pnpm build:test` ile `apps/browser-extension/.output/chrome-mv3-test` klasörünü `chrome://extensions` → "Paketlenmemiş öğe yükle" ile, Firefox'ta `about:debugging` → "Geçici eklenti yükle" ile yükleyin.

### 2.2 Kontrol listesi

Her hesap türü × arayüz dili × tarayıcı birleşimi için ayrı doldurulur. **Gerçek e-posta içeriği depoya veya bu belgeye yazılmaz.**

| # | Kontrol | Nasıl | Beklenen |
| --- | --- | --- | --- |
| 1 | Sayfa tanınıyor | Araç çubuğu penceresi | "Bu sayfada yazma yardımcısı kullanılabilir." |
| 2 | Seçici eşleşmeleri | Pencere → "Geliştirme derlemesi · selectors" | `readingPane ≥ 1`, `messageBody` = açık mesaj sayısı, `composeEditor` = açık taslak sayısı |
| 3 | Konuşma başlatıcısı | Bir konuşmaya tıklayın | Okuma bölmesinin köşesinde tek düğme; Outlook düğmelerinin üstüne binmiyor |
| 4 | Konuşma kimliği | Başka konuşmaya geçin | Çalışma yeni konuşmayla kendiliğinden başlar; panel açıksa yeni bağlam okunur, kart açıksa kapanır; "Konuşma değişti" uyarısı çıkmaz; başlatıcı yeni konuşmaya taşınır |
| 5 | Mesajları okuma | Konuşma düğmesi → Yanıt hazırla | "Bağlamda N mesaj var" (N = açık mesaj sayısı); "İncele" listesinde gönderen ve tarih |
| 6 | Kapalı mesajlar | Kapalı mesajı olan konuşma | "N mesaj kapalı" veya "sayı belirlenemedi"; kapalı mesaj metni bağlamda yok |
| 7 | Alıntı ve imza | Yanıt zinciri olan konuşma | Tekrar eden alıntı ve kesin imza "çıkarıldı" olarak listelenir, gövde korunur |
| 8 | Yanıt taslağı tanıma | Yanıtla'ya basın | Taslağın köşesinde "Düzelt / Çevir" düğmeleri; arama kutusunda düğme yok |
| 9 | Taslak bölgesi | Panel → "Taslağı al" | Yalnızca kendi yazdığınız metin; imza ve önceki yazışma yok |
| 10 | Seçimi değiştirme | Bir kelime seçip "Düzelt" → Taslağa uygula | Yalnızca seçim değişir; imza ve alıntı aynı |
| 11 | Outlook'un kaydı | Taslaktan çıkıp geri dönün | Uygulanan metin taslakta kalıcı (Outlook kaydetti) |
| 12 | Yeniden çizim | Uyguladıktan sonra pencereyi küçültüp büyütün | Metin kaybolmuyor |
| 13 | Geri alma | "Son uygulamayı geri al" | Önceki metin geri gelir; sonradan yazı yazılmışsa geri alma kapalı |
| 14 | Ctrl+Z davranışı | Uyguladıktan sonra Ctrl+Z | Sonucu kaydedin (RoosterJS yığını) |
| 15 | İki taslak | Bir yanıt + bir yeni ileti | Yalnızca düğmesine basılan taslak değişir |
| 16 | Ayrı pencere | Taslağı ayrı pencerede açın | Destekleniyor mu? Değilse sınırlama olarak yazın |
| 17 | Hesap değişimi | Başka hesaba geçin | Panel içeriği temizlenir |
| 18 | Takvim | `/calendar` | Düğme yok; pencere "tanınamadı/desteklenmiyor" |

### 2.3 Yazıcı kararı

- Kontrol 10–14'ü `exec-command-insert-text` ile yapın.
- Kontrol 11 (Outlook'un kaydı) veya 12 başarısızsa, `outlook.content.ts` içinde `writer: createPasteEventWriter(document)` ile tekrar deneyin.
- Sonucu tablo olarak `tests/manual/browser-matrix.md` dosyasına yazın.

### 2.4 Seçici güncelleme kuralı

Bir seçici doğrulandığında veya değiştiğinde aynı değişiklikte şunlar yapılır:

1. `selectors.ts` içinde `status: 'verified'` yapılır ve `verifiedOn` kaydı eklenir: hesap türü, arayüz dili, tarayıcı, konuşma görünümü, editör türü, tarih.
2. `tests/fixtures/outlook/` altına **anonimleştirilmiş** gerçek yapı örneği eklenir. Adresler, adlar, şirket bilgileri, kimlikler ve bağlantı token'ları değiştirilir. Ham posta kutusu HTML'i eklenmez.
3. Örneği kullanan bir test eklenir.

Anonim yapı çıkarmak için tarayıcı konsolunda, metin içeriği yerine yalnızca etiket, rol ve kimlik bilgisi veren bir döküm kullanılabilir. Örnek:

```js
// Yalnızca yapı: etiket, id (sayılar maskelenir), role, aria-expanded. Metin alınmaz.
(function dump(el, depth = 0, out = []) {
  if (depth > 12 || out.length > 400) return out;
  const id = el.id ? `#${el.id.replace(/\d+/g, 'N')}` : '';
  const role = el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : '';
  const exp = el.hasAttribute('aria-expanded') ? `[aria-expanded=${el.getAttribute('aria-expanded')}]` : '';
  out.push(`${'  '.repeat(depth)}${el.tagName.toLowerCase()}${id}${role}${exp}`);
  for (const child of el.children) dump(child, depth + 1, out);
  return out;
})(document.querySelector('#ReadingPaneContainerId')).join('\n');
```

## 3. Sonuçlar — 15 Ekim 2026

Ortam: Outlook Web (`outlook.office.com`), iş hesabı, İngilizce arayüz, Firefox 157.0.1 (macOS). İleti listesi konuşma görünümünde, okuma bölmesi yalnızca seçili mesajı gösteriyor (`#ItemReadingPaneContainer`). Yedi farklı konuşma açıldı. Anonim yapı örneği: `tests/fixtures/outlook/selected-message-reading-pane.html`, testleri: `tests/integration/outlook-web/selected-message-reading-pane.test.ts`.

| Bölge | Gerçek yapı | Sonuç |
| --- | --- | --- |
| Alan adı | `outlook.office.com/mail/` iş hesabında `outlook.cloud.microsoft/mail/` adresine yönleniyor | Manifest eşleşmesi doğrulandı; eklenti bu adreste çalışıyor (`pnpm outlook:dev`) |
| Okuma bölmesi | `#ReadingPaneContainerId` > `#ItemReadingPaneContainer` | Doğrulandı |
| Seçili satır | `div[role=option][aria-selected=true][data-convid][data-focusable-row=true]`; satırlar sanal listede (`data-virtuoso-scroller`) | Doğrulandı. Ekran dışına kayan satır DOM'dan çıkıyor (bkz. konuşma kimliği) |
| Konu | `span[role=heading][id=CONV_<belirteç>_SUBJECT][title]` | Doğrulandı. Okuma bölmesinde FROM/TO/CC/DATETIME de `role=heading` taşıdığı için genel `[role=heading]` yedeği kaldırıldı |
| Konuşma kimliği | `CONV_<belirteç>` aynı konuşma için kararlı; URL'deki kimlik ise seçili **iletinin** kimliği (`/mail/inbox/id/<ileti>`), `data-convid` ile aynı değil | Anahtar artık okuma bölmesindeki belirteçten üretiliyor; liste kaydırılınca konuşma değişmiş sayılmıyor |
| Mesaj gövdesi | `[data-test-id=mailMessageBodyContainer]` > `div#UniqueMessageBody_N[role=document]` | Doğrulandı. Okunan ve ekrandaki metin %100 civarında örtüşüyor |
| İleti başlığı | `MSG_<ileti>_SUBJECT / _FROM / _TO / _CC / _DATETIME` aynı ileti kimliğini taşıyor | Mesaj kapsayıcısı bunlardan türetiliyor: gövdeyi ve tek bir ileti kimliğinin başlığını içeren en küçük üst eleman |
| Gönderen | `span[role=heading][id=MSG_<ileti>_FROM]` içinde kişi kartları (`[data-lpc-hover-target-id]`); metin `Ad <adres>` | Doğrulandı. Yalnızca görünen ad alınıyor. "X on behalf of Y" iletisinde iki kart var; yazar son karttır |
| Tarih | `div[data-testid=SentReceivedSavedTime][id=MSG_<ileti>_DATETIME]`, metin ör. "Wed 15-Oct-26 9:12 AM" | Yalnızca görünen metin; `time[datetime]` yok, `sentAt` boş kalıyor |
| Alıntı | Gelen iletide `x_divRplyFwdMsg` (iç içe alıntılarda birden fazla), `appendonsend` | Doğrulandı |
| İmza | İncelenen iletilerde `x_Signature` yok | Aday olarak kaldı |
| Hesap ipucu | `#owa-me-control-container button[aria-label]` | Doğrulandı (dile bağlı) |
| Tema | `.fui-FluentProvider` üzerinde Fluent v9 renk değişkenleri (`--colorNeutralBackground1`, `--colorBrandBackground` vb.) | Doğrulandı (açık tema); eklenti "Otomatik" temada bu renkleri kullanıyor |
| "Yanıt hazırla" düğmesi | Okuma bölmesinin sağ üst köşesi | Görünüyor; Outlook düğmeleriyle çakışmıyor (`pnpm outlook:inspect layout`) |
| Okunan mesaj geçmişi | İki konuşma açıldıktan sonra panel | Açık konuşma "Bu konuşma" altında seçili, diğeri "Diğer açılan e-postalar" altında seçilmemiş |
| Yanıt editörü ("Reply") | Seçili mesaj görünümünde okuma bölmesindeki mesaj tamamen kalkar; yerine `#docking_InitVisiblePart_N.owaMailComposeEditorScrollContainer` > `#editorParent_N` > `div[role=textbox][contenteditable]` gelir. Orijinal mesaj editörde alıntı olarak durur (`#appendonsend` → `hr` → `#divRplyFwdMsg`). Outlook editörü önce boş açar, alıntıyı ~250 ms sonra doldurur. Listede aynı satır seçili kalır | Konuşma "park edilir" (`discovery/track-active-thread.ts`): konuşma değişmiş sayılmaz, taslak alıntı gelince yanıt olarak bağlanır (`pnpm outlook:inspect diagnose-reply`). Bağlam, mesaj açılırken belleğe alınan mesajdan gelir |
| Yazma alanı araç çubuğu | Gerçek yanıt editöründe | Doğrulandı: editör ekrandan uzun olsa da görünen bölümün alt kenarında kalıyor; "Yanıt yaz" kartı bağlamla (1 mesaj, yanıtlanan mesaj belli) açılıyor, kart ekranın içinde |

Gerçek sayfanın ortaya çıkardığı ve düzeltilen sorunlar:
- Gönderen ve tarih hiç okunamıyordu: mesaj kapsayıcısı adayı (`[role=listitem]`, `[aria-expanded][tabindex]`) gerçek sayfada ya yoktu ya da ilgisiz düğmelere denk geliyordu.
- `span[title*="@"]` gönderen yedeği alıcılara ve alıntıdaki adreslere denk geliyordu; kaldırıldı.
- Gönderen etiketi adres içeriyordu (`Ad <adres>`, "adres on behalf of Ad").
- İlk hücresi boş tablolar (kurumsal "dış gönderen" uyarısı) gövdenin başına ` | ` ekliyordu.
- Ayrı parçalarda yazılan satır sonları fazladan boş satır üretiyordu; satır sonundan önce boşluk kalıyordu.
- Liste kaydırılınca konuşma anahtarı değişiyordu (kaynak `data-convid`'den URL'ye geçiyordu).

## 4. Açık noktalar

| Açık nokta | Durum | Sonuca göre yapılacak |
| --- | --- | --- |
| Mesaj kapsayıcısı, gönderen, tarih seçicileri | Seçili mesaj görünümünde doğrulandı (§3) | Konuşma görünümünde (çok mesajlı okuma bölmesi) de denetlenecek |
| Açık/kapalı mesaj ayrımı | Kanıt yok; seçili mesaj görünümünde okuma bölmesinde tek ileti var | Konuşma görünümünde incelenecek. Bulunamazsa kapalı sayı `null` kalır (uydurulmaz) |
| Konuşma sırası (yeni üstte/altta) | Makinece okunur tarih yok (§3) | "Ekrandaki sıra" kullanılır; konuşma görünümünde sıra incelenecek |
| İmza/gövde sınırı (yanıtta) | `#Signature`/`#appendonsend` adayları | Bulunamazsa gövdenin tamamını değiştirme kapalı kalır |
| Yazıcı (`execCommand` / `paste`) | Sentetik sayfada `execCommand` çalışıyor | Kontrol 11–14 sonucuna göre seçilir |
| Ayrı pencere ve iframe editörler | Desteklenmiyor (`all_frames` kapalı) | Gerekirse ayrıca ele alınan destek biçimi olur |
| `outlook.cloud.microsoft` alan adı | İş hesabı bu adrese yönleniyor; doğrulandı (§3) | Kişisel hesabın (`outlook.live.com`) yönlendiği adres ayrıca kaydedilir |
| Başlatıcı konumu | Okuma bölmesi sağ üst, editör sağ alt köşe | Outlook düğmeleriyle çakışırsa konum ayarlanır |
