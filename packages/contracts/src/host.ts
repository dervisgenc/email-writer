import { z } from 'zod';

/**
 * Yerel yardımcı uygulamanın kendisiyle ilgili bilgiler ve eklentiyle sürüm uyumu.
 *
 * Mesaj zarfının sürümü (`PROTOCOL_VERSION`) yalnızca zarfın biçimi değişirse artar; yeni
 * yetenekler yeni istek türleriyle eklenir. Tanımadığı bir isteğe yardımcı uygulama hemen
 * `AI_VERSION_MISMATCH` döner ve eklenti güncellemeye yönlendirir.
 *
 * Eklenti, `MIN_HOST_VERSION`'dan eski bir yardımcı uygulamayla çalışmaz. Kural: yeni bir
 * eklenti sürümü, yardımcı uygulamanın iki ara sürüm (minor) eski hâliyle çalışmaya devam
 * eder; bu değer ancak o süre dolunca yükseltilir (bkz. docs/GELISTIRICI_REHBERI.md).
 */
export const MIN_HOST_VERSION = '0.1.0';

/** Yardımcı uygulamanın birlikte kaydedildiği tarayıcılar. */
export const HOST_BROWSERS = ['firefox', 'chrome', 'edge', 'brave'] as const;
export type HostBrowser = (typeof HOST_BROWSERS)[number];

/** Sürüm dosyalarında kullanılan işletim sistemi adları (ör. `writehand-darwin-arm64.tar.gz`). */
export const HOST_OPERATING_SYSTEMS = ['darwin', 'linux', 'windows'] as const;
export type HostOperatingSystem = (typeof HOST_OPERATING_SYSTEMS)[number];

/** `MAJOR.MINOR.PATCH`; ön sürüm ve derleme ekleri kullanılmaz. */
export const versionSchema = z.string().regex(/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/);

/** Negatif: `a` daha eski; sıfır: aynı; pozitif: `a` daha yeni. */
export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < 3; index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export const hostInfoSchema = z
  .object({
    version: versionSchema,
    os: z.enum(HOST_OPERATING_SYSTEMS),
    arch: z.string().min(1).max(32),
    /** Kaydı bu kuruluma işaret eden tarayıcılar. */
    browsers: z.array(z.enum(HOST_BROWSERS)).max(HOST_BROWSERS.length),
    /** Kaynak koddan geliştirme kurulumu (`install --dev`): Node.js ile çalışır, kendini güncellemez. */
    development: z.boolean(),
  })
  .strict();
export type HostInfo = z.infer<typeof hostInfoSchema>;
