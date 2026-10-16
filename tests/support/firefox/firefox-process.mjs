// Firefox'u WebDriver BiDi açık başlatır ve bağlantı noktasının hazır olmasını bekler.
//
// macOS'ta Firefox, uygulama olarak `open` ile başlatılır. Terminalin alt süreci
// olarak başlatılan Firefox'u macOS gizlilik koruması terminalin izinleriyle
// değerlendirir; terminalin "diğer uygulamaların verileri" izni yoksa Firefox
// kendi veri klasörünü okuyamaz ve "Profile Missing" hatasıyla kapanır.
//
// Windows'ta Firefox PATH'te bulunmaz; kurulum klasörlerinde aranır.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { connect } from 'node:net';
import { join } from 'node:path';

const MAC_DEFAULT_APP = '/Applications/Firefox.app';

/** Firefox'un Windows'taki olağan kurulum yerleri (sistem geneli, 32 bit, kullanıcı düzeyi). */
function windowsFirefox(env) {
  const candidates = [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA]
    .filter(Boolean)
    .map((directory) => join(directory, 'Mozilla Firefox', 'firefox.exe'));
  return candidates.find((candidate) => existsSync(candidate)) ?? 'firefox.exe';
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** `FIREFOX_BIN` verilmişse onu, yoksa platformun varsayılan Firefox'unu kullanır. */
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
    return 'bilinmiyor';
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
 * Yerel bir bağlantı noktasında dinleyen süreç var mı? Geliştirme sunucuları
 * yalnızca IPv6 (`::1`) üzerinde dinleyebildiği için iki adres de denenir.
 */
export async function isPortInUse(port) {
  const results = await Promise.all([isPortOpen(port, '127.0.0.1'), isPortOpen(port, '::1')]);
  return results.some(Boolean);
}

/**
 * Firefox'u ayrı bir profil ve BiDi bağlantı noktasıyla başlatır.
 * `stop()` yalnızca bu profille başlatılan Firefox'u kapatır.
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
      throw new Error(`Firefox BiDi bağlantı noktası açılmadı (${port}).`);
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
 * Yalnızca bu profille başlatılmış Firefox'u kapatır ve BiDi bağlantı
 * noktasının kapanmasını bekler. Kullanıcının kendi Firefox'una dokunulmaz:
 * eşleşme, profil yolunu taşıyan ana süreçle sınırlıdır.
 */
export async function stopFirefoxWithProfile(profile, port = null, timeoutMs = 15_000) {
  try {
    if (process.platform === 'win32') {
      // pkill yok: komut satırında bu profilin yolu geçen Firefox süreçleri PowerShell ile
      // kapatılır. Yol boşluk içerirse tırnaklanır, bu yüzden yalnızca yolun kendisi aranır.
      // Profil yolu betiğe ortam değişkeniyle verilir; komut metnine eklenmez.
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
    // Bu profille çalışan Firefox yok.
  }
  const started = Date.now();
  while (port !== null && (await isPortOpen(port)) && Date.now() - started < timeoutMs) {
    await sleep(250);
  }
}
