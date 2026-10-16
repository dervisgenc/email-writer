# Email Writer

E-posta uygulamasından ayrılmadan daha iyi mesaj yazmaya yardım eden tarayıcı eklentisi. İlk hedef Outlook Web. Chromium (Chrome, Edge, Brave) ve Firefox için aynı kod tabanından Manifest V3 paketleri üretilir.

**Durum (16 Ekim 2026):** Outlook Web okuma, bağlam, önizleme ve kontrollü taslağa yazma altyapısına ChatGPT planıyla giriş, OpenAI API anahtarı ve bilgisayardaki Claude Code ile Claude aboneliği bağlantısı eklendi. Ayarlardan hesapları adlandırma, seçme ve kaldırma desteklenir. AI bağlantısı macOS/Linux üzerinde Node.js tabanlı yerel uygulama gerektirir. ChatGPT Plus hesabıyla ve Claude Code (Team planı) ile gerçek üretim doğrulandı. Outlook taslağına uygulamanın uçtan uca canlı doğrulaması bekliyor. Ayrıntı: [AI kurulumu ve sınırlar](./docs/AI_BAGLANTISI.md), [YAPILAN_ISLER.md](./YAPILAN_ISLER.md).

## Hızlı başlangıç

```sh
pnpm install
pnpm dev            # Chromium'da geliştirme (gerçek AI bağlantısı)
pnpm dev:firefox    # Firefox'ta geliştirme
pnpm check          # tip, lint, biçim, testler, iki tarayıcı için derleme, paket kontrolü
```

AI için önce `pnpm build`, ardından Firefox'ta `pnpm ai:install firefox`; Chromium'da `pnpm ai:install chrome --extension-id=EKLENTI_KIMLIGI` çalıştırın. Eklenti ayarlarından **Continue with ChatGPT** ile bağlanın, API anahtarınızı ekleyin veya **Claude aboneliği**ni seçin (Claude Code kurulu ve oturum açık olmalı). Uygunluk/kurulum ayrıntıları [rehberde](./docs/AI_BAGLANTISI.md). Yalnızca `pnpm build:test` örnek sonuç üretir.

## Yapı

```text
apps/browser-extension/        WXT eklentisi: giriş noktaları, denetleyiciler, montaj, platform yardımcıları
apps/ai-companion/             Yerel native messaging uygulaması, OAuth dönüşü ve kimlik depolama
packages/ai-openai/            ChatGPT OAuth, model keşfi, prompt ve Responses API adaptörü
packages/ai-claude-code/       Kullanıcının Claude Code'unu kısıtlı yazdırma modunda çalıştıran adaptör
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
- [AI bağlantısı: ChatGPT, OpenAI API ve Claude Code](./docs/AI_BAGLANTISI.md)
- [Outlook Web gerçek sayfa doğrulaması](./docs/outlook-web-dogrulama.md)
- [Tarayıcı ve hesap matrisi](./tests/manual/browser-matrix.md)
- [Yapılan işler](./YAPILAN_ISLER.md)
