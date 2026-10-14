import { z } from 'zod';

/**
 * Eklenti sayfalarının içerik güvenlik politikası `eval` kullanımına izin
 * vermez. Zod'un çalışma zamanında kod üreten hızlandırması kapatılır; şema
 * doğrulaması aynı sonucu daha yavaş ama güvenli yoldan verir.
 */
z.config({ jitless: true });
