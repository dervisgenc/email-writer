import { z } from 'zod';

import { CHROMIUM_EXTENSION_IDS, REPOSITORY_URL } from './brand';

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
export const HOST_BROWSER_NAMES: Readonly<Record<HostBrowser, string>> = {
  firefox: 'Firefox',
  chrome: 'Chrome',
  edge: 'Edge',
  brave: 'Brave',
};

/** Sürüm dosyalarında kullanılan işletim sistemi adları (ör. `writehand-darwin-arm64.tar.gz`). */
export const HOST_OPERATING_SYSTEMS = ['darwin', 'linux', 'windows'] as const;
export type HostOperatingSystem = (typeof HOST_OPERATING_SYSTEMS)[number];
/** Sistemlerin kullanıcıya görünen adları (çevrilmez). */
export const HOST_OPERATING_SYSTEM_NAMES: Readonly<Record<HostOperatingSystem, string>> = {
  darwin: 'macOS',
  linux: 'Linux',
  windows: 'Windows',
};

const RELEASE_DOWNLOADS = `${REPOSITORY_URL}/releases/latest/download`;
const CHROMIUM_EXTENSION_ID = /^[a-p]{32}$/;

/**
 * Yardımcı uygulamayı kuran tek satırlık komut. Firefox kimliği ve mağaza kimlikleri yardımcı
 * uygulamada kayıtlıdır; yalnızca başka bir Chromium eklentisinin (ör. paketlenmemiş geliştirme
 * derlemesi) kimliği komuta eklenir.
 */
export function helperInstallCommand(os: HostOperatingSystem, extensionId: string | null): string {
  const id =
    extensionId !== null &&
    CHROMIUM_EXTENSION_ID.test(extensionId) &&
    !CHROMIUM_EXTENSION_IDS.includes(extensionId)
      ? extensionId
      : null;
  if (os === 'windows')
    return `${id ? `$env:WRITEHAND_EXTENSION_ID='${id}'; ` : ''}irm ${RELEASE_DOWNLOADS}/install.ps1 | iex`;
  return `curl -fsSL ${RELEASE_DOWNLOADS}/install.sh | sh${id ? ` -s -- --extension-id=${id}` : ''}`;
}

/** Kaldırırken hesap bilgilerini de silen seçenek (kaldırma komutunun sonuna eklenir). */
export const HELPER_DELETE_DATA_OPTION: Readonly<Record<HostOperatingSystem, string>> = {
  darwin: '--delete-data',
  linux: '--delete-data',
  windows: '-DeleteData',
};

/** Yardımcı uygulamayı bütün tarayıcı kayıtlarıyla birlikte kaldıran komut. */
export function helperUninstallCommand(os: HostOperatingSystem): string {
  return os === 'windows'
    ? `& ([scriptblock]::Create((irm ${RELEASE_DOWNLOADS}/install.ps1))) -Uninstall`
    : `curl -fsSL ${RELEASE_DOWNLOADS}/install.sh | sh -s -- uninstall`;
}

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

/**
 * Güncelleme denetimi: yardımcı uygulama en son yayımlanmış sürümü GitHub'dan günde en fazla
 * bir kez sorar ve sonucu saklar. `latest` null: henüz yayımlanmış sürüm yok veya geliştirme kurulumu.
 */
export const hostUpdateCheckSchema = z
  .object({
    current: versionSchema,
    latest: versionSchema.nullable(),
    available: z.boolean(),
  })
  .strict();
export type HostUpdateCheck = z.infer<typeof hostUpdateCheckSchema>;

/** Güncelleme kuruldu; yardımcı uygulama yanıttan sonra kapanır, sonraki istek yeni sürümü başlatır. */
export const hostUpdateResultSchema = z.object({ version: versionSchema }).strict();
