// Starts Firefox with WebDriver BiDi enabled and waits for its port to be ready.
//
// On macOS, Firefox is started as an app with `open`. macOS privacy protection
// judges a Firefox started as a child of the terminal by the terminal's
// permissions; without the terminal's "data from other apps" permission, Firefox
// cannot read its own data folder and exits with "Profile Missing".
//
// On Windows, Firefox is not on PATH, so it is looked up in its install folders.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { connect } from 'node:net';
import { join } from 'node:path';

const MAC_DEFAULT_APP = '/Applications/Firefox.app';

/** Firefox's usual install locations on Windows (system-wide, 32-bit, per-user). */
function windowsFirefox(env) {
  const candidates = [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA]
    .filter(Boolean)
    .map((directory) => join(directory, 'Mozilla Firefox', 'firefox.exe'));
  return candidates.find((candidate) => existsSync(candidate)) ?? 'firefox.exe';
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Uses `FIREFOX_BIN` when set, otherwise the platform's default Firefox. */
export function resolveFirefox(env = process.env) {
  const binary = env.FIREFOX_BIN;
  if (process.platform === 'darwin') {
    const app = binary?.includes('.app/') ? binary.slice(0, binary.indexOf('.app/') + 4) : MAC_DEFAULT_APP;
    return { kind: 'mac-app', app, binary: `${app}/Contents/MacOS/firefox` };
  }
  if (process.platform === 'win32') return { kind: 'binary', binary: binary ?? windowsFirefox(env) };
  return { kind: 'binary', binary: binary ?? 'firefox' };
}

export function firefoxVersion(firefox = resolveFirefox()) {
  try {
    return execFileSync(firefox.binary, ['--version'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((done) => {
    const socket = connect({ host, port });
    socket.once('connect', () => {
      socket.destroy();
      done(true);
    });
    socket.once('error', () => done(false));
  });
}

export async function isBidiListening(port) {
  return isPortOpen(port);
}

/**
 * Is any process listening on a local port? Both addresses are tried because
 * development servers may listen only on IPv6 (`::1`).
 */
export async function isPortInUse(port) {
  const results = await Promise.all([isPortOpen(port, '127.0.0.1'), isPortOpen(port, '::1')]);
  return results.some(Boolean);
}

/**
 * Starts Firefox with a separate profile and BiDi port.
 * `stop()` closes only the Firefox started with this profile.
 */
export async function launchFirefox({ profile, port, headless = false, urls = [], timeoutMs = 30_000 }) {
  const firefox = resolveFirefox();
  const args = [
    ...(headless ? ['--headless'] : []),
    '--no-remote',
    '--profile',
    profile,
    `--remote-debugging-port=${port}`,
    ...urls,
  ];

  let child = null;
  if (firefox.kind === 'mac-app') {
    execFileSync('open', ['-n', '-a', firefox.app, '--args', ...args]);
  } else {
    child = spawn(firefox.binary, args, { stdio: 'ignore' });
  }

  const started = Date.now();
  while (!(await isPortOpen(port))) {
    if (child?.exitCode != null || Date.now() - started > timeoutMs) {
      throw new Error(`The Firefox BiDi port did not open (${port}).`);
    }
    await sleep(250);
  }

  return {
    firefox,
    stop() {
      if (child !== null) {
        child.kill('SIGTERM');
      } else {
        stopFirefoxWithProfile(profile);
      }
    },
  };
}

/**
 * Closes only the Firefox started with this profile and waits for the BiDi
 * port to close. The user's own Firefox is left alone: matching is limited to
 * the main process whose command line carries the profile path.
 */
export async function stopFirefoxWithProfile(profile, port = null, timeoutMs = 15_000) {
  try {
    if (process.platform === 'win32') {
      // No pkill: PowerShell stops the Firefox processes whose command line contains this
      // profile's path. A path with spaces gets quoted, so only the path itself is matched.
      // The profile path reaches the script through an environment variable, not the command text.
      execFileSync(
        join(
          process.env.SystemRoot ?? 'C:\\Windows',
          'System32',
          'WindowsPowerShell',
          'v1.0',
          'powershell.exe',
        ),
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          "Get-CimInstance -ClassName Win32_Process | Where-Object { $_.Name -eq 'firefox.exe' -and $_.CommandLine -and $_.CommandLine.Contains($env:EW_FIREFOX_PROFILE) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }",
        ],
        { env: { ...process.env, EW_FIREFOX_PROFILE: profile }, stdio: 'ignore' },
      );
    } else {
      execFileSync('pkill', ['-TERM', '-f', `firefox .*--profile ${profile}`]);
    }
  } catch {
    // No Firefox is running with this profile.
  }
  const started = Date.now();
  while (port !== null && (await isPortOpen(port)) && Date.now() - started < timeoutMs) {
    await sleep(250);
  }
}
