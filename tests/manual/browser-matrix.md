# Tarayıcı ve hesap matrisi

Gerçek sürümler buraya yazılır. "Bütün tarayıcılarda çalışıyor" gibi ölçüsüz ifade kullanılmaz (implementation_details.md §19.6). Doğrulanamayan hesap türü desteklenmiş sayılmaz. Testlerde e-posta gönderilmez; gerçek e-posta içeriği bu dosyaya yazılmaz.

## Otomatik kontroller — sentetik örnek sayfa

Sentetik sayfa: `tests/fixtures/outlook/conversation-inline-reply.html`. **Bu sonuçlar gerçek Outlook'u doğrulamaz.**

| Tarih | Ortam | Tarayıcı | Paket | Akış | Sonuç |
| --- | --- | --- | --- | --- | --- |
| 2026-10-14 | Linux (Fedora, kernel 7.2), başsız | Chrome for Testing 156.0.8078.4 (Playwright 1.64) | `chrome-mv3-test` | Service worker, ayarlar ekranı, başlatıcı yerleşimi, seçim → Düzelt → örnek sonuç → seçime uygula → geri al, konuşma okuma + yanıt hedefi seçimi + Escape/oturum koruma, klavye olayı yalıtımı | 5/5 geçti |
| 2026-10-14 | Linux (Fedora, kernel 7.2), başsız | Firefox 157.0.1 (WebDriver BiDi) | `firefox-mv3-test` | Geçici kurulum, başlatıcılar, seçim → Düzelt → örnek sonuç → seçime uygula, imza korunuyor | Geçti |
| 2026-10-14 | — | `web-ext lint` 10.7.0 | `firefox-mv3` | Mozilla paket denetimi | 0 hata, 5 uyarı (kütüphane kodu, bkz. geliştirici rehberi) |
| 2026-10-15 | macOS (Darwin 27), başsız | Chrome Headless Shell 156.0.8078.4 (Playwright 1.64) | `chrome-mv3-test` | 14 Ekim ile aynı 5 akış | 5/5 geçti |
| 2026-10-15 | macOS (Darwin 27), başsız | Firefox 157.0.1 (WebDriver BiDi, `open` ile başlatıldı) | `firefox-mv3-test` | 14 Ekim ile aynı akış | Geçti |
| 2026-10-19 | Linux (Fedora 44), başsız | Chrome for Testing (Playwright 1.64) | `chrome-mv3-test` | Önceki akışlar + karşılama sihirbazı (sahte yardımcı uygulama ve izin; açık/koyu, 390 px) + ayarlardaki yardımcı uygulama kartı ve güncelleme | 13/13 geçti |
| 2026-10-19 | Linux (Fedora 44), başsız | Firefox 157.0.1 (WebDriver BiDi) | `firefox-mv3-test` | Önceki akış + kurulumda sihirbazın açılması | Geçti |
| 2026-10-19 | Linux (Fedora 44), başsız | Firefox 157.0.1 ve Chrome for Testing, gerçek yardımcı uygulama (tek dosyalık program, `install.sh` ile kurulu) | `firefox-mv3`, `chrome-mv3` (izni manifestte verilmiş kopya) | İzin → `HOST_INFO` → Claude Code ile uydurma metin Düzelt → güncelleme denetimi → kaldırma | Geçti (yalnızca uydurma metin; Outlook'a girilmedi) |

## Gerçek Outlook hesabıyla kontroller

Protokol: `docs/outlook-web-dogrulama.md` §2.2.

| Ortam | Hesap/görünüm | Arayüz dili | Tarayıcı sürümü | Yazıcı | Kontroller (1–18) | Tarih | Sonuç |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Linux + Chrome | Outlook Web iş hesabı | | | | | | Yapılmadı |
| Linux + Firefox | Outlook Web iş hesabı | | | | | | Yapılmadı |
| macOS + Firefox | Outlook Web iş hesabı; konuşma görünümü açık, okuma bölmesinde yalnızca seçili mesaj | İngilizce | 157.0.1 | — | Okuma: 1, 2, 4, 5 (tek ileti), 7 (alıntı); `pnpm outlook:inspect` ile 7 konuşma. İmza ve taslak/yazma (8–18) yapılmadı | 2026-10-15 | Okuma kısmen doğrulandı (bkz. `docs/outlook-web-dogrulama.md` §3) |
| Windows + Edge | Outlook Web iş hesabı | | | | | | Yapılmadı |
| Chrome veya Firefox | Outlook.com kişisel hesap | | | | | | Yapılmadı |
| Brave | Desteklenen Outlook Web hesabı | | | | | | Yapılmadı |
| En az iki tarayıcı | Türkçe ve İngilizce arayüz | | | | | | Yapılmadı |
