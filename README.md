# Email Writer

E-posta uygulamasından ayrılmadan daha iyi mesaj yazmaya yardım eden tarayıcı eklentisi. İlk hedef Outlook Web. Chromium (Chrome, Edge, Brave) ve Firefox için aynı kod tabanından Manifest V3 paketleri üretilir.

**Durum (14 Ekim 2026):** Proje temeli kuruldu (implementation_details.md, Adım 1). Konuşma okuma, bağlam kuralları, panel, işlem hazırlığı ve güvenli taslağa yazma/geri alma altyapısı sentetik örnek sayfada Chromium ve Firefox'ta çalışıyor. Gerçek Outlook hesabıyla doğrulama ve AI/metin işleme bağlantısı sonraki adımlar. Ayrıntı: [YAPILAN_ISLER.md](./YAPILAN_ISLER.md).

## Hızlı başlangıç

```sh
pnpm install
pnpm dev            # Chromium'da geliştirme (örnek sonuçlar "geliştirme modu" etiketiyle)
pnpm dev:firefox    # Firefox'ta geliştirme
pnpm check          # tip, lint, biçim, testler, iki tarayıcı için derleme, paket kontrolü
```

## Yapı

```text
apps/browser-extension/        WXT eklentisi: giriş noktaları, denetleyiciler, montaj, platform yardımcıları
packages/contracts/            Modüllerin paylaştığı veri ve işlem tanımları, sınır şemaları
packages/core/                 Bağlam, işlem hazırlığı, oturum durumu, yazma ön koşulları (saf fonksiyonlar)
packages/ui/                   Vue panel, başlatıcı ve önizleme bileşenleri
packages/mail-connectors/
  outlook-web/                 Outlook Web sayfasını okuma, izleme ve kontrollü yazma
tests/                         Birim, sözleşme, entegrasyon, uçtan uca testler ve sentetik örnekler
docs/                          Geliştirici rehberi ve Outlook doğrulama protokolü
```

## Belgeler

- [Proje planı](./PROJE_PLANI.md)
- [İmplementasyon detayları](./implementation_details.md)
- [Geliştirici rehberi](./docs/GELISTIRICI_REHBERI.md)
- [Outlook Web gerçek sayfa doğrulaması](./docs/outlook-web-dogrulama.md)
- [Tarayıcı ve hesap matrisi](./tests/manual/browser-matrix.md)
- [Yapılan işler](./YAPILAN_ISLER.md)
