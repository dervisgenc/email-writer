import {
  FIREFOX_EXTENSION_ID,
  HOST_BROWSERS,
  NATIVE_HOST_NAME,
  PRODUCT_NAME,
  type HostBrowser,
} from '@email-writer/contracts';

import type { HostPlatform } from './platform';

export interface InstallArguments {
  readonly browser: HostBrowser;
  readonly extensionId: string | undefined;
  readonly uninstall: boolean;
}

/** What registering the host with one browser writes. Applying it is left to the caller. */
export interface InstallPlan {
  /** Directories to create; the mode is ignored on Windows. */
  readonly directories: readonly { readonly path: string; readonly mode?: number }[];
  readonly files: readonly { readonly path: string; readonly content: string; readonly mode: number }[];
  /** Per-user registry keys whose default value points at the manifest (Windows). */
  readonly registry: readonly { readonly key: string; readonly value: string }[];
}

/** Removing a registration touches only this browser's manifest and registry key. */
export interface UninstallPlan {
  readonly registryKeys: readonly string[];
  readonly files: readonly string[];
}

const isBrowser = (value: string | undefined): value is HostBrowser =>
  HOST_BROWSERS.some((browser) => browser === value);

export function parseInstallArguments(argv: readonly string[]): InstallArguments {
  const args = argv.filter((value) => value !== '--');
  const browser = args.find((value) => !value.startsWith('--'));
  if (!isBrowser(browser))
    throw new Error(`Usage: pnpm ai:install ${HOST_BROWSERS.join('|')} [--extension-id=ID] [--uninstall]`);
  return {
    browser,
    extensionId: args.find((value) => value.startsWith('--extension-id='))?.slice('--extension-id='.length),
    uninstall: args.includes('--uninstall'),
  };
}

export function planInstall(
  platform: HostPlatform,
  options: {
    readonly browser: HostBrowser;
    readonly extensionId: string | undefined;
    /** The Node.js executable that will run the host. */
    readonly node: string;
    /** The bundled host program. */
    readonly host: string;
    readonly claudePath: string | null;
    readonly claudeConfigDir: string | undefined;
  },
): InstallPlan {
  const firefox = options.browser === 'firefox';
  const extensionId = options.extensionId ?? (firefox ? FIREFOX_EXTENSION_ID : '');
  if (firefox ? !/^[\w@.{}+-]{1,256}$/.test(extensionId) : !/^[a-p]{32}$/.test(extensionId))
    throw new Error('Supply the installed extension ID with --extension-id=ID.');
  const { manifest, registryKey } = platform.registration(options.browser);
  const content = {
    name: NATIVE_HOST_NAME,
    description: `${PRODUCT_NAME} helper app`,
    path: platform.launcherPath,
    type: 'stdio',
    ...(firefox
      ? { allowed_extensions: [extensionId] }
      : { allowed_origins: [`chrome-extension://${extensionId}/`] }),
  };
  return {
    directories: [
      { path: platform.installDirectory, mode: 0o700 },
      { path: platform.path.dirname(manifest) },
    ],
    files: [
      { path: platform.hostPath, content: options.host, mode: 0o600 },
      { path: platform.launcherPath, content: platform.launcher(options), mode: 0o700 },
      { path: manifest, content: `${JSON.stringify(content, null, 2)}\n`, mode: 0o600 },
    ],
    registry: registryKey === null ? [] : [{ key: registryKey, value: manifest }],
  };
}

export function planUninstall(platform: HostPlatform, browser: HostBrowser): UninstallPlan {
  const { manifest, registryKey } = platform.registration(browser);
  // The browser stops finding the host before its manifest is removed.
  return { registryKeys: registryKey === null ? [] : [registryKey], files: [manifest] };
}
