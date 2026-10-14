# Outlook Web gerçek sayfa doğrulaması

Durum: **Yapılmadı** — gerçek Outlook hesabıyla giriş gerektiriyor (13–14 Ekim 2026).
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
| 4 | Konuşma kimliği | Başka konuşmaya geçin | Panel açıksa "Konuşma değişti" uyarısı; başlatıcı yeni konuşmaya taşınır |
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

## 3. Açık noktalar

| Açık nokta | Durum | Sonuca göre yapılacak |
| --- | --- | --- |
| Mesaj kapsayıcısı, gönderen, tarih seçicileri | Kanıt yok | Gerçek yapıya göre `selectors.ts` ve örnek sayfa güncellenir |
| Açık/kapalı mesaj ayrımı | Kanıt yok | Bulunamazsa kapalı sayı `null` kalır (uydurulmaz) |
| Konuşma sırası (yeni üstte/altta) | Bilinmiyor | Tarih yoksa "ekrandaki sıra" açıklaması gösterilir |
| İmza/gövde sınırı (yanıtta) | `#Signature`/`#appendonsend` adayları | Bulunamazsa gövdenin tamamını değiştirme kapalı kalır |
| Yazıcı (`execCommand` / `paste`) | Sentetik sayfada `execCommand` çalışıyor | Kontrol 11–14 sonucuna göre seçilir |
| Ayrı pencere ve iframe editörler | Desteklenmiyor (`all_frames` kapalı) | Gerekirse ayrıca ele alınan destek biçimi olur |
| `outlook.cloud.microsoft` alan adı | Manifestte var, doğrulanmadı | Test hesabının yönlendiği adresler kaydedilir |
| Başlatıcı konumu | Okuma bölmesi sağ üst, editör sağ alt köşe | Outlook düğmeleriyle çakışırsa konum ayarlanır |
