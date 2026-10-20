import { z } from 'zod';

import { CHROMIUM_EXTENSION_IDS, REPOSITORY_URL } from './brand';

/**
 * Information about the local helper app itself and its version compatibility with the
 * extension.
 *
 * The message envelope version (`PROTOCOL_VERSION`) increases only when the envelope format
 * changes; new capabilities are added as new request types. The helper app answers a request
 * it does not recognize with `AI_VERSION_MISMATCH` right away, and the extension points the
 * user to an update.
 *
 * The extension does not work with a helper app older than `MIN_HOST_VERSION`. Rule: a new
 * extension release keeps working with a helper app up to two minor versions older; this
 * value is raised only after that window has passed (see docs/RELEASING.md).
 */
export const MIN_HOST_VERSION = '0.1.0';

/** Browsers the helper app is registered with. */
export const HOST_BROWSERS = ['firefox', 'chrome', 'edge', 'brave'] as const;
export type HostBrowser = (typeof HOST_BROWSERS)[number];
export const HOST_BROWSER_NAMES: Readonly<Record<HostBrowser, string>> = {
  firefox: 'Firefox',
  chrome: 'Chrome',
  edge: 'Edge',
  brave: 'Brave',
};

/** Operating system names used in release file names (e.g. `writehand-darwin-arm64.tar.gz`). */
export const HOST_OPERATING_SYSTEMS = ['darwin', 'linux', 'windows'] as const;
export type HostOperatingSystem = (typeof HOST_OPERATING_SYSTEMS)[number];
/** User-facing system names (not translated). */
export const HOST_OPERATING_SYSTEM_NAMES: Readonly<Record<HostOperatingSystem, string>> = {
  darwin: 'macOS',
  linux: 'Linux',
  windows: 'Windows',
};

const RELEASE_DOWNLOADS = `${REPOSITORY_URL}/releases/latest/download`;
const CHROMIUM_EXTENSION_ID = /^[a-p]{32}$/;

/**
 * One-line command that installs the helper app. The Firefox ID and the store IDs are built
 * into the helper app; only the ID of another Chromium extension (e.g. an unpacked development
 * build) is added to the command.
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

/** Option that also deletes account data on uninstall (appended to the uninstall command). */
export const HELPER_DELETE_DATA_OPTION: Readonly<Record<HostOperatingSystem, string>> = {
  darwin: '--delete-data',
  linux: '--delete-data',
  windows: '-DeleteData',
};

/** Command that uninstalls the helper app together with all its browser registrations. */
export function helperUninstallCommand(os: HostOperatingSystem): string {
  return os === 'windows'
    ? `& ([scriptblock]::Create((irm ${RELEASE_DOWNLOADS}/install.ps1))) -Uninstall`
    : `curl -fsSL ${RELEASE_DOWNLOADS}/install.sh | sh -s -- uninstall`;
}

/** `MAJOR.MINOR.PATCH`; no pre-release or build suffixes. */
export const versionSchema = z.string().regex(/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/);

/** Negative: `a` is older; zero: equal; positive: `a` is newer. */
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
    /** Browsers whose registration points to this installation. */
    browsers: z.array(z.enum(HOST_BROWSERS)).max(HOST_BROWSERS.length),
    /** Development install from source (`install --dev`): runs on Node.js and does not update itself. */
    development: z.boolean(),
  })
  .strict();
export type HostInfo = z.infer<typeof hostInfoSchema>;

/**
 * Update check: the helper app asks GitHub for the latest published version at most once a
 * day and caches the result. `latest` is null when nothing is published yet or for a
 * development install.
 */
export const hostUpdateCheckSchema = z
  .object({
    current: versionSchema,
    latest: versionSchema.nullable(),
    available: z.boolean(),
  })
  .strict();
export type HostUpdateCheck = z.infer<typeof hostUpdateCheckSchema>;

/** Update installed; the helper app exits after the response and the next request starts the new version. */
export const hostUpdateResultSchema = z.object({ version: versionSchema }).strict();
