import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { posix, win32, type PlatformPath } from 'node:path';
import { promisify } from 'node:util';
import { NATIVE_HOST_NAME } from '@email-writer/contracts';

/**
 * Everything that differs between operating systems is described here: where the helper
 * and its credentials live, how each browser finds the host, the launcher, how a URL is
 * opened and where Claude Code is usually installed. Other modules use these values and
 * never check the operating system themselves. Paths follow the target system's rules,
 * so each system's description can be tested on any computer.
 */

export const BROWSERS = ['firefox', 'chrome', 'edge', 'brave'] as const;
export type Browser = (typeof BROWSERS)[number];

type Environment = Readonly<Record<string, string | undefined>>;

export interface LauncherOptions {
  /** The Node.js executable that runs the host. */
  readonly node: string;
  readonly claudePath: string | null;
  readonly claudeConfigDir: string | undefined;
}

/** Per-user registry values that point a browser at the host manifest (Windows). */
export interface Registry {
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface HostPlatform {
  readonly path: PlatformPath;
  /** The bundled host and its launcher. */
  readonly installDirectory: string;
  readonly hostPath: string;
  readonly launcherPath: string;
  /** Private credential storage, kept on this computer only. */
  readonly credentialsDirectory: string;
  /** Where the browser reads the host manifest; on Windows a registry key points at the file. */
  registration(browser: Browser): { readonly manifest: string; readonly registryKey: string | null };
  /** The launcher script: starts the host with what the browser's environment lacks. */
  launcher(options: LauncherOptions): string;
  /** Opens a URL in the default browser without a shell. */
  urlOpener(url: string): { readonly file: string; readonly args: readonly string[] };
  /** Possible Claude Code locations, in search order. */
  readonly claudeLocations: readonly string[];
  /** Limits a newly created private directory to its owner where mode bits cannot (Windows). */
  readonly restrictDirectory: ((directory: string) => Promise<void>) | null;
  readonly registry: Registry | null;
}

/** Absolute directories of a PATH value; relative entries would depend on the working directory. */
function searchPath(path: PlatformPath, value: string | undefined): string[] {
  return (value ?? '')
    .split(path.delimiter)
    .map((directory) => directory.replace(/^"(.*)"$/, '$1'))
    .filter((directory) => path.isAbsolute(directory));
}

const MANIFEST_DIRECTORIES: Record<'darwin' | 'linux', Record<Browser, string>> = {
  darwin: {
    firefox: 'Library/Application Support/Mozilla/NativeMessagingHosts',
    chrome: 'Library/Application Support/Google/Chrome/NativeMessagingHosts',
    edge: 'Library/Application Support/Microsoft Edge/NativeMessagingHosts',
    brave: 'Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts',
  },
  linux: {
    firefox: '.mozilla/native-messaging-hosts',
    chrome: '.config/google-chrome/NativeMessagingHosts',
    edge: '.config/microsoft-edge/NativeMessagingHosts',
    brave: '.config/BraveSoftware/Brave-Browser/NativeMessagingHosts',
  },
};

function unixPlatform(os: 'darwin' | 'linux', env: Environment, home: string): HostPlatform {
  const path = posix;
  const installDirectory = path.join(home, '.local', 'share', 'email-writer');
  const hostPath = path.join(installDirectory, 'host.mjs');
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
  return {
    path,
    installDirectory,
    hostPath,
    launcherPath: path.join(installDirectory, 'email-writer-ai'),
    credentialsDirectory: path.join(home, '.config', 'email-writer'),
    registration: (browser) => ({
      manifest: path.join(home, MANIFEST_DIRECTORIES[os][browser], `${NATIVE_HOST_NAME}.json`),
      registryKey: null,
    }),
    launcher: ({ node, claudePath, claudeConfigDir }) => {
      // The browser starts the host with a minimal environment. Record what the installing
      // shell uses so the optional Claude Code method runs the same installation and account.
      const exports = [
        // An npm-installed Claude Code runs on Node.js.
        `PATH=${quote(path.dirname(node))}:"$PATH"; export PATH`,
        // Claude Code finds its macOS Keychain sign-in by user name.
        'USER="${USER:-$(id -un)}"; export USER',
        ...(claudePath
          ? [`EMAIL_WRITER_CLAUDE_PATH=${quote(claudePath)}; export EMAIL_WRITER_CLAUDE_PATH`]
          : []),
        ...(claudeConfigDir ? [`CLAUDE_CONFIG_DIR=${quote(claudeConfigDir)}; export CLAUDE_CONFIG_DIR`] : []),
      ];
      return `#!/bin/sh\n${exports.join('\n')}\nexec ${quote(node)} ${quote(hostPath)} "$@"\n`;
    },
    urlOpener: (url) => ({ file: os === 'darwin' ? '/usr/bin/open' : 'xdg-open', args: [url] }),
    claudeLocations: [
      env.EMAIL_WRITER_CLAUDE_PATH,
      ...searchPath(path, env.PATH).map((directory) => path.join(directory, 'claude')),
      path.join(home, '.local', 'bin', 'claude'),
      path.join(home, '.claude', 'local', 'claude'),
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
    ].filter((location): location is string => !!location && path.isAbsolute(location)),
    restrictDirectory: null,
    registry: null,
  };
}

/** Per-user registry locations (under HKCU\Software) that each browser reads. */
const REGISTRY_LOCATIONS: Record<Browser, string> = {
  firefox: 'Mozilla',
  chrome: 'Google\\Chrome',
  edge: 'Microsoft\\Edge',
  // Brave is built with Chromium branding and reads Chromium's key before Chrome's.
  brave: 'Chromium',
};

/** A value inside double quotes in a batch file. `%` is doubled; quotes and line breaks cannot be expressed. */
function batchValue(value: string): string {
  if (/["\r\n]/.test(value)) throw new Error(`This path cannot be written to the launcher: ${value}`);
  return value.replaceAll('%', '%%');
}

const run = promisify(execFile);

function windowsPlatform(env: Environment, home: string): HostPlatform {
  const path = win32;
  // Names are case-insensitive on Windows; a copied environment keeps spellings such as "Path".
  const variable = (name: string) => Object.entries(env).find(([key]) => key.toUpperCase() === name)?.[1];
  const location = (name: string) => {
    const value = variable(name);
    return value && path.isAbsolute(value) ? value : undefined;
  };
  // Not the roaming AppData: credentials and programs must stay on this computer.
  const localAppData = location('LOCALAPPDATA') ?? path.join(home, 'AppData', 'Local');
  const appData = location('APPDATA') ?? path.join(home, 'AppData', 'Roaming');
  // Windows' own tools by absolute path, so that nothing on PATH can stand in for them.
  const system32 = (tool: string) => path.join(location('SYSTEMROOT') ?? 'C:\\Windows', 'System32', tool);
  const installDirectory = path.join(localAppData, 'Programs', 'email-writer');
  const hostPath = path.join(installDirectory, 'host.mjs');
  const ownKey = (key: string) => {
    // Only this helper's own per-user keys are ever written or removed.
    if (!key.startsWith('HKCU\\Software\\') || !key.endsWith(`\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`))
      throw new Error(`Not a registry key of this helper: ${key}`);
    return key;
  };
  const hidden = { windowsHide: true };
  return {
    path,
    installDirectory,
    hostPath,
    launcherPath: path.join(installDirectory, 'email-writer-ai.cmd'),
    credentialsDirectory: path.join(localAppData, 'email-writer'),
    registration: (browser) => ({
      manifest: path.join(installDirectory, `${NATIVE_HOST_NAME}.${browser}.json`),
      registryKey: `HKCU\\Software\\${REGISTRY_LOCATIONS[browser]}\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`,
    }),
    launcher: ({ node, claudePath, claudeConfigDir }) =>
      [
        '@echo off',
        // cmd.exe reads batch files in the console code page; UTF-8 keeps non-ASCII folder names intact.
        'chcp 65001 >nul',
        'setlocal DisableDelayedExpansion',
        // Browsers pass the user's full environment on Windows; only values set in the
        // installing terminal are recorded, so Claude Code runs with the same account.
        ...(claudePath ? [`set "EMAIL_WRITER_CLAUDE_PATH=${batchValue(claudePath)}"`] : []),
        ...(claudeConfigDir ? [`set "CLAUDE_CONFIG_DIR=${batchValue(claudeConfigDir)}"`] : []),
        `"${batchValue(node)}" "${batchValue(hostPath)}" %*`,
        '',
      ].join('\r\n'),
    // ShellExecute through rundll32 receives the URL as one argument: no shell, so "&" stays intact.
    urlOpener: (url) => ({ file: system32('rundll32.exe'), args: ['url.dll,FileProtocolHandler', url] }),
    claudeLocations: [
      location('EMAIL_WRITER_CLAUDE_PATH'),
      // Only a program can be started without a shell; npm's claude.cmd is resolved to the program it starts.
      ...searchPath(path, variable('PATH')).flatMap((directory) => [
        path.join(directory, 'claude.exe'),
        path.join(directory, 'claude.cmd'),
      ]),
      // Anthropic's native installer, WinGet and npm's default prefix.
      path.join(home, '.local', 'bin', 'claude.exe'),
      path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'claude.exe'),
      path.join(appData, 'npm', 'claude.cmd'),
    ].filter((location): location is string => location !== undefined),
    restrictDirectory: async (directory) => {
      const { stdout } = await run(system32('whoami.exe'), ['/user', '/fo', 'csv', '/nh'], hidden);
      const user = /"(S-1-[\d-]+)"/.exec(stdout)?.[1];
      if (user === undefined) throw new Error('The current Windows user could not be identified.');
      // Only this user and the operating system; nothing is inherited from the profile folder.
      await run(
        system32('icacls.exe'),
        [directory, '/inheritance:r', '/grant:r', `*${user}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F'],
        hidden,
      );
    },
    registry: {
      async set(key, value) {
        await run(
          system32('reg.exe'),
          ['add', ownKey(key), '/ve', '/t', 'REG_SZ', '/d', value, '/f'],
          hidden,
        );
      },
      async remove(key) {
        // `reg delete` fails for a missing key; a missing registration is already removed.
        const exists = await run(system32('reg.exe'), ['query', ownKey(key)], hidden).then(
          () => true,
          () => false,
        );
        if (exists) await run(system32('reg.exe'), ['delete', key, '/f'], hidden);
      },
    },
  };
}

export function hostPlatform(
  os: NodeJS.Platform = process.platform,
  env: Environment = process.env,
  home: string = homedir(),
): HostPlatform {
  if (os === 'win32') return windowsPlatform(env, home);
  // Other Unix-like systems follow the Linux (XDG) conventions.
  return unixPlatform(os === 'darwin' ? 'darwin' : 'linux', env, home);
}
