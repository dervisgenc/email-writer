import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import { FIREFOX_EXTENSION_ID, HOST_BROWSERS } from '@email-writer/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import {
  parseInstallArguments,
  planInstall,
  planUninstall,
  type InstallPlan,
} from '../../apps/ai-companion/src/install-plan';
import { hostPlatform } from '../../apps/ai-companion/src/platform';

const CHROMIUM_ID = 'abcdefghijklmnopabcdefghijklmnop';
const options = {
  browser: 'chrome' as const,
  extensionId: CHROMIUM_ID,
  node: '/opt/node/bin/node',
  host: 'HOST PROGRAM',
  claudePath: '/Users/ada/.local/bin/claude',
  claudeConfigDir: undefined,
};
const manifestOf = (plan: InstallPlan) => JSON.parse(plan.files[2]!.content) as Record<string, unknown>;

const WINDOWS_HOME = 'C:\\Users\\Ada';
const windowsEnv = {
  LOCALAPPDATA: 'C:\\Users\\Ada\\AppData\\Local',
  APPDATA: 'C:\\Users\\Ada\\AppData\\Roaming',
  SystemRoot: 'C:\\Windows',
  // A copied Windows environment keeps this spelling; entries may be quoted or relative.
  Path: 'C:\\Windows\\system32;"C:\\Program Files\\Tools";.\\bin;;C:\\Users\\Ada\\AppData\\Roaming\\npm',
};
const windows = () => hostPlatform('win32', windowsEnv, WINDOWS_HOME);

describe('Native host installation plan', () => {
  it('macOS keeps its install location, launcher and manifest', () => {
    const plan = planInstall(hostPlatform('darwin', {}, '/Users/ada'), {
      ...options,
      claudePath: "/Users/ada/it's/claude",
      claudeConfigDir: '/Users/ada/.claude-work',
    });
    expect(plan).toEqual({
      directories: [
        { path: '/Users/ada/.local/share/writehand', mode: 0o700 },
        { path: '/Users/ada/Library/Application Support/Google/Chrome/NativeMessagingHosts' },
      ],
      files: [
        { path: '/Users/ada/.local/share/writehand/host.mjs', content: 'HOST PROGRAM', mode: 0o600 },
        {
          path: '/Users/ada/.local/share/writehand/writehand',
          content: [
            '#!/bin/sh',
            `PATH='/opt/node/bin':"$PATH"; export PATH`,
            'USER="${USER:-$(id -un)}"; export USER',
            `EMAIL_WRITER_CLAUDE_PATH='/Users/ada/it'\\''s/claude'; export EMAIL_WRITER_CLAUDE_PATH`,
            `CLAUDE_CONFIG_DIR='/Users/ada/.claude-work'; export CLAUDE_CONFIG_DIR`,
            `exec '/opt/node/bin/node' '/Users/ada/.local/share/writehand/host.mjs' "$@"`,
            '',
          ].join('\n'),
          mode: 0o700,
        },
        {
          path: '/Users/ada/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.dervisgenc.writehand.json',
          content: `${JSON.stringify(
            {
              name: 'com.dervisgenc.writehand',
              description: 'Writehand helper app',
              path: '/Users/ada/.local/share/writehand/writehand',
              type: 'stdio',
              allowed_origins: [`chrome-extension://${CHROMIUM_ID}/`],
            },
            null,
            2,
          )}\n`,
          mode: 0o600,
        },
      ],
      registry: [],
    });
  });

  it.each([
    ['darwin', 'firefox', '/h/Library/Application Support/Mozilla/NativeMessagingHosts'],
    ['darwin', 'edge', '/h/Library/Application Support/Microsoft Edge/NativeMessagingHosts'],
    ['darwin', 'brave', '/h/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts'],
    ['linux', 'firefox', '/h/.mozilla/native-messaging-hosts'],
    ['linux', 'chrome', '/h/.config/google-chrome/NativeMessagingHosts'],
    ['linux', 'edge', '/h/.config/microsoft-edge/NativeMessagingHosts'],
    ['linux', 'brave', '/h/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts'],
  ] as const)('%s: %s reads its manifest from %s', (os, browser, directory) => {
    const platform = hostPlatform(os, {}, '/h');
    expect(platform.registration(browser)).toEqual({
      manifest: `${directory}/com.dervisgenc.writehand.json`,
      registryKey: null,
    });
    expect(platform.credentialsDirectory).toBe('/h/.config/writehand');
  });

  it('Windows keeps program and credentials in the local (non-roaming) profile', () => {
    const platform = windows();
    expect(platform.installDirectory).toBe('C:\\Users\\Ada\\AppData\\Local\\Programs\\writehand');
    expect(platform.launcherPath).toBe('C:\\Users\\Ada\\AppData\\Local\\Programs\\writehand\\writehand.cmd');
    expect(platform.credentialsDirectory).toBe('C:\\Users\\Ada\\AppData\\Local\\writehand');
    // Without the variable, the profile's default location is used.
    expect(hostPlatform('win32', {}, WINDOWS_HOME).credentialsDirectory).toBe(
      'C:\\Users\\Ada\\AppData\\Local\\writehand',
    );
  });

  it.each([
    ['chrome', 'Google\\Chrome'],
    ['edge', 'Microsoft\\Edge'],
    // Brave reads Chromium's key before Chrome's (checked with Brave 1.97 on Windows 11).
    ['brave', 'Chromium'],
    ['firefox', 'Mozilla'],
  ] as const)('Windows: %s finds the host through HKCU\\Software\\%s', (browser, location) => {
    expect(windows().registration(browser)).toEqual({
      manifest: `C:\\Users\\Ada\\AppData\\Local\\Programs\\writehand\\com.dervisgenc.writehand.${browser}.json`,
      registryKey: `HKCU\\Software\\${location}\\NativeMessagingHosts\\com.dervisgenc.writehand`,
    });
  });

  it('Windows registers a per-browser manifest under the user registry and writes a cmd launcher', () => {
    const platform = windows();
    const plan = planInstall(platform, {
      ...options,
      node: 'C:\\Program Files\\nodejs\\node.exe',
      claudePath: 'C:\\Users\\Ada\\.local\\bin\\claude.exe',
      claudeConfigDir: 'C:\\Users\\Ada\\Claude 100%',
    });
    const manifest =
      'C:\\Users\\Ada\\AppData\\Local\\Programs\\writehand\\com.dervisgenc.writehand.chrome.json';
    expect(plan.registry).toEqual([
      {
        key: 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.dervisgenc.writehand',
        value: manifest,
      },
    ]);
    expect(plan.files.map((file) => file.path)).toEqual([platform.hostPath, platform.launcherPath, manifest]);
    expect(manifestOf(plan)).toMatchObject({ path: platform.launcherPath, type: 'stdio' });
    expect(plan.files[1]!.content).toBe(
      [
        '@echo off',
        'chcp 65001 >nul',
        'setlocal DisableDelayedExpansion',
        'set "EMAIL_WRITER_CLAUDE_PATH=C:\\Users\\Ada\\.local\\bin\\claude.exe"',
        'set "CLAUDE_CONFIG_DIR=C:\\Users\\Ada\\Claude 100%%"',
        '"C:\\Program Files\\nodejs\\node.exe" "C:\\Users\\Ada\\AppData\\Local\\Programs\\writehand\\host.mjs" %*',
        '',
      ].join('\r\n'),
    );
    expect(() => planInstall(platform, { ...options, claudeConfigDir: 'C:\\"quoted"' })).toThrow(
      'cannot be written to the launcher',
    );
  });

  it('allows only the given extension; Firefox defaults to the development ID', () => {
    for (const os of ['darwin', 'linux', 'win32'] as const) {
      const platform = hostPlatform(os, windowsEnv, os === 'win32' ? WINDOWS_HOME : '/h');
      expect(
        manifestOf(planInstall(platform, { ...options, browser: 'firefox', extensionId: undefined })),
      ).toMatchObject({
        allowed_extensions: [FIREFOX_EXTENSION_ID],
      });
      expect(manifestOf(planInstall(platform, { ...options, browser: 'edge' }))).toMatchObject({
        allowed_origins: [`chrome-extension://${CHROMIUM_ID}/`],
      });
      expect(() => planInstall(platform, { ...options, extensionId: undefined })).toThrow(
        '--extension-id=ID',
      );
      expect(() => planInstall(platform, { ...options, extensionId: 'not-an-id' })).toThrow(
        '--extension-id=ID',
      );
      expect(() => planInstall(platform, { ...options, browser: 'firefox', extensionId: 'bad id' })).toThrow(
        '--extension-id=ID',
      );
    }
  });

  it('removing a registration touches only that browser’s manifest and registry key', () => {
    expect(planUninstall(hostPlatform('linux', {}, '/h'), 'brave')).toEqual({
      registryKeys: [],
      files: ['/h/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts/com.dervisgenc.writehand.json'],
    });
    expect(planUninstall(windows(), 'edge')).toEqual({
      registryKeys: ['HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\com.dervisgenc.writehand'],
      files: ['C:\\Users\\Ada\\AppData\\Local\\Programs\\writehand\\com.dervisgenc.writehand.edge.json'],
    });
  });

  it('never writes registry keys other than its own per-user registration', async () => {
    const registry = windows().registry!;
    await expect(
      registry.set('HKLM\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.dervisgenc.writehand', 'x'),
    ).rejects.toThrow('Not a registry key of this helper');
    await expect(
      registry.remove('HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\other.host'),
    ).rejects.toThrow('Not a registry key of this helper');
  });

  it('reads the browser, extension ID and uninstall flag from the command line', () => {
    expect(parseInstallArguments(['--', 'edge', `--extension-id=${CHROMIUM_ID}`])).toEqual({
      browser: 'edge',
      extensionId: CHROMIUM_ID,
      uninstall: false,
    });
    expect(parseInstallArguments(['firefox', '--uninstall'])).toEqual({
      browser: 'firefox',
      extensionId: undefined,
      uninstall: true,
    });
    expect(() => parseInstallArguments(['safari'])).toThrow(`pnpm ai:install ${HOST_BROWSERS.join('|')}`);
    expect(() => parseInstallArguments([])).toThrow('Usage');
  });
});

describe('Operating system integration', () => {
  it('opens the sign-in page without a shell, keeping "&" in the URL', () => {
    const url = 'https://auth.openai.com/oauth/authorize?a=1&b=2&redirect_uri=http%3A%2F%2F127.0.0.1%3A1%2F';
    expect(windows().urlOpener(url)).toEqual({
      file: 'C:\\Windows\\System32\\rundll32.exe',
      args: ['url.dll,FileProtocolHandler', url],
    });
    expect(hostPlatform('darwin', {}, '/h').urlOpener(url)).toEqual({ file: '/usr/bin/open', args: [url] });
    expect(hostPlatform('linux', {}, '/h').urlOpener(url)).toEqual({ file: 'xdg-open', args: [url] });
  });

  it('looks for Claude Code where each system installs it', () => {
    expect(windows().claudeLocations).toEqual([
      'C:\\Windows\\system32\\claude.exe',
      'C:\\Windows\\system32\\claude.cmd',
      'C:\\Program Files\\Tools\\claude.exe',
      'C:\\Program Files\\Tools\\claude.cmd',
      'C:\\Users\\Ada\\AppData\\Roaming\\npm\\claude.exe',
      'C:\\Users\\Ada\\AppData\\Roaming\\npm\\claude.cmd',
      'C:\\Users\\Ada\\.local\\bin\\claude.exe',
      'C:\\Users\\Ada\\AppData\\Local\\Microsoft\\WinGet\\Links\\claude.exe',
      'C:\\Users\\Ada\\AppData\\Roaming\\npm\\claude.cmd',
    ]);
    expect(
      hostPlatform('win32', { ...windowsEnv, EMAIL_WRITER_CLAUDE_PATH: 'D:\\claude.exe' }, WINDOWS_HOME)
        .claudeLocations[0],
    ).toBe('D:\\claude.exe');
    expect(
      hostPlatform(
        'darwin',
        { EMAIL_WRITER_CLAUDE_PATH: '/x/claude', PATH: 'bin:/usr/local/bin' },
        '/Users/ada',
      ).claudeLocations,
    ).toEqual([
      '/x/claude',
      '/usr/local/bin/claude',
      '/Users/ada/.local/bin/claude',
      '/Users/ada/.claude/local/claude',
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
    ]);
  });
});

/** A stand-in host that reports the environment and arguments the launcher gave it. */
const REPORTING_HOST = `process.stdout.write(JSON.stringify({
  claude: process.env.EMAIL_WRITER_CLAUDE_PATH ?? null,
  config: process.env.CLAUDE_CONFIG_DIR ?? null,
  user: process.env.USER ?? null,
  args: process.argv.slice(2),
}));
`;

describe('Launcher on this computer', () => {
  const temporary: string[] = [];
  afterEach(async () => {
    for (const directory of temporary.splice(0)) await rm(directory, { recursive: true, force: true });
  });
  const install = async (plan: InstallPlan) => {
    for (const directory of plan.directories) await mkdir(directory.path, { recursive: true });
    for (const file of plan.files) {
      await writeFile(file.path, file.content);
      await chmod(file.path, file.mode);
    }
  };

  it.runIf(process.platform === 'win32')(
    'starts the host the way Chrome and Firefox do, from a folder with non-ASCII characters, spaces, & and %',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'email-writer-launcher-'));
      temporary.push(root);
      const local = join(root, 'Derviş & 100% Ünal');
      const platform = hostPlatform('win32', { ...process.env, LOCALAPPDATA: local }, root);
      const claude = join(local, 'Claude ş', 'claude.exe');
      const config = join(local, 'config %TEMP%');
      const plan = planInstall(platform, {
        ...options,
        node: process.execPath,
        host: REPORTING_HOST,
        claudePath: claude,
        claudeConfigDir: config,
      });
      await install(plan);
      const origin = `chrome-extension://${CHROMIUM_ID}/`;
      const manifest = plan.files[2]!.path;
      const commandLines = [
        // Chrome: %ComSpec% /d /s /c ""<host path>" <origin> --parent-window=0" (< and > pipes omitted).
        `/d /s /c ""${platform.launcherPath}" ${origin} --parent-window=0"`,
        // Firefox quotes arguments that contain whitespace and runs cmd.exe /s/c "<arguments>".
        `/s/c ""${platform.launcherPath}" "${manifest}" ${FIREFOX_EXTENSION_ID}"`,
      ];
      const results = commandLines.map((line) =>
        spawnSync(process.env.ComSpec ?? 'cmd.exe', [line], {
          windowsVerbatimArguments: true,
          windowsHide: true,
          encoding: 'utf8',
        }),
      );
      // Browsers pass the full environment on Windows; the launcher leaves USER as it is.
      const user = process.env.USER ?? null;
      expect(results.map((result) => JSON.parse(result.stdout))).toEqual([
        { claude, config, user, args: [origin, '--parent-window=0'] },
        { claude, config, user, args: [manifest, FIREFOX_EXTENSION_ID] },
      ]);
    },
  );

  it.skipIf(process.platform === 'win32')('starts the host with the recorded environment', async () => {
    const root = await mkdtemp(join(tmpdir(), 'email-writer-launcher-'));
    temporary.push(root);
    const platform = hostPlatform(process.platform, {}, join(root, "Ada's home"));
    const plan = planInstall(platform, {
      ...options,
      node: process.execPath,
      host: REPORTING_HOST,
      claudePath: '/opt/claude',
      claudeConfigDir: join(root, 'config $HOME'),
    });
    await install(plan);
    const result = spawnSync(platform.launcherPath, ['origin'], {
      encoding: 'utf8',
      env: { PATH: '/usr/bin:/bin' },
    });
    expect(JSON.parse(result.stdout)).toEqual({
      claude: '/opt/claude',
      config: join(root, 'config $HOME'),
      // Without USER in the environment the launcher looks the user name up with `id -un`.
      user: userInfo().username,
      args: ['origin'],
    });
  });
});
