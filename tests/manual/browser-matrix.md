# Tarayıcı ve hesap matrisi

Gerçek sürümler buraya yazılır. "Bütün tarayıcılarda çalışıyor" gibi ölçüsüz ifade kullanılmaz (implementation_details.md §19.6). Doğrulanamayan hesap türü desteklenmiş sayılmaz. Testlerde e-posta gönderilmez; gerçek e-posta içeriği bu dosyaya yazılmaz.

## Otomatik kontroller — sentetik örnek sayfa

Sentetik sayfa: `tests/fixtures/outlook/conversation-inline-reply.html`. **Bu sonuçlar gerçek Outlook'u doğrulamaz.**

| Tarih | Ortam | Tarayıcı | Paket | Akış | Sonuç |
| --- | --- | --- | --- | --- | --- |
| 2026-10-14 | Linux (Fedora, kernel 7.2), başsız | Chrome for Testing 156.0.8078.4 (Playwright 1.64) | `chrome-mv3-test` | Service worker, ayarlar ekranı, başlatıcı yerleşimi, seçim → Düzelt → örnek sonuç → seçime uygula → geri al, konuşma okuma + yanıt hedefi seçimi + Escape/oturum koruma, klavye olayı yalıtımı | 5/5 geçti |
| 2026-10-14 | Linux (Fedora, kernel 7.2), başsız | Firefox 157.0.1 (WebDriver BiDi) | `firefox-mv3-test` | Geçici kurulum, başlatıcılar, seçim → Düzelt → örnek sonuç → seçime uygula, imza korunuyor | Geçti |
| 2026-10-14 | — | `web-ext lint` 10.7.0 | `firefox-mv3` | Mozilla paket denetimi | 0 hata, 5 uyarı (kütüphane kodu, bkz. geliştirici rehberi) |

## Gerçek Outlook hesabıyla kontroller

Protokol: `docs/outlook-web-dogrulama.md` §2.2.

| Ortam | Hesap/görünüm | Arayüz dili | Tarayıcı sürümü | Yazıcı | Kontroller (1–18) | Tarih | Sonuç |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Linux + Chrome | Outlook Web iş hesabı | | | | | | Yapılmadı |
| Linux + Firefox | Outlook Web iş hesabı | | | | | | Yapılmadı |
| Windows + Edge | Outlook Web iş hesabı | | | | | | Yapılmadı |
| Chrome veya Firefox | Outlook.com kişisel hesap | | | | | | Yapılmadı |
| Brave | Desteklenen Outlook Web hesabı | | | | | | Yapılmadı |
| En az iki tarayıcı | Türkçe ve İngilizce arayüz | | | | | | Yapılmadı |
