import { execFile, spawn } from 'node:child_process';
import type { KeyObject } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { AiFailure } from '@email-writer/ai-openai';
import { HELPER_COMMAND, PRODUCT_NAME, type ErrorCode, type HostUpdateCheck } from '@email-writer/contracts';

import type { HostConfig } from './host-config';
import type { HostPlatform } from './platform';
import {
  LATEST_RELEASE_URL,
  parseUpdateCache,
  releaseFileUrl,
  releaseVersionOf,
  updateCheck,
  verifyRelease,
} from './release';
import { HOST_VERSION } from './version';

const run = promisify(execFile);
const MAX_ARCHIVE_BYTES = 300_000_000;

/**
 * Finds and installs newer releases of the helper app. The latest version is asked from
 * GitHub at most once a day (the answer is kept next to the program). An update downloads
 * this system's archive and SHA256SUMS from the same release, verifies both, unpacks the new
 * program and lets it install itself, which also refreshes the browser registrations.
 * Development installations never update themselves.
 */
export function createUpdater(deps: {
  readonly platform: HostPlatform;
  readonly config: HostConfig;
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
  readonly publicKey?: KeyObject;
}) {
  const { platform, config } = deps;
  const fetcher = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const cachePath = platform.path.join(platform.installDirectory, 'update-check.json');
  const headers = { 'User-Agent': `${HELPER_COMMAND}/${HOST_VERSION}` };

  const download = async (url: string, timeout: number): Promise<Buffer> => {
    const response = await fetcher(url, { headers, signal: AbortSignal.timeout(timeout) }).catch(() => {
      throw new AiFailure('HOST_UPDATE_FAILED');
    });
    const length = Number(response.headers.get('content-length') ?? 0);
    if (!response.ok || length > MAX_ARCHIVE_BYTES) throw new AiFailure('HOST_UPDATE_FAILED');
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > MAX_ARCHIVE_BYTES) throw new AiFailure('HOST_UPDATE_FAILED');
    return data;
  };

  async function check(force = false): Promise<HostUpdateCheck> {
    if (config.development) return updateCheck(HOST_VERSION, null);
    if (!force) {
      const cached = parseUpdateCache(await readFile(cachePath, 'utf8').catch(() => null), now());
      if (cached !== null) return updateCheck(HOST_VERSION, cached.latest);
    }
    const response = await fetcher(LATEST_RELEASE_URL, {
      headers: { ...headers, Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(15_000),
    }).catch(() => {
      throw new AiFailure('HOST_UPDATE_CHECK_FAILED');
    });
    // 404: nothing has been published yet.
    if (!response.ok && response.status !== 404) throw new AiFailure('HOST_UPDATE_CHECK_FAILED');
    const latest = response.ok ? releaseVersionOf(await response.json().catch(() => null)) : null;
    if (response.ok && latest === null) throw new AiFailure('HOST_UPDATE_CHECK_FAILED');
    await writeFile(cachePath, JSON.stringify({ checkedAt: now(), latest }), { mode: 0o600 }).catch(
      () => undefined,
    );
    return updateCheck(HOST_VERSION, latest);
  }

  /**
   * Installs the latest release if it is newer. `output` shows the new program's installer
   * output in a terminal; the native host passes 'ignore' because its stdout is the protocol.
   */
  async function update(output: 'inherit' | 'ignore'): Promise<{ version: string }> {
    if (config.development) throw new AiFailure('HOST_UPDATE_FAILED');
    const { latest, available } = await check(true);
    if (latest === null || !available) return { version: HOST_VERSION };
    const archive = platform.releaseArchive;
    const [sums, signature, data] = await Promise.all([
      download(releaseFileUrl(latest, 'SHA256SUMS'), 30_000),
      download(releaseFileUrl(latest, 'SHA256SUMS.sig'), 30_000),
      download(releaseFileUrl(latest, archive), 600_000),
    ]);
    verifyRelease(
      { sums, signature: signature.toString('utf8'), archive: { name: archive, data } },
      deps.publicKey,
    );

    const directory = await mkdtemp(platform.path.join(tmpdir(), `${HELPER_COMMAND}-update-`));
    try {
      const file = platform.path.join(directory, archive);
      await writeFile(file, data);
      const extract = platform.extractArchive(file, directory);
      const program = platform.path.join(directory, platform.path.basename(platform.programPath));
      const reported = await run(extract.file, [...extract.args], { windowsHide: true })
        .then(() => run(program, ['version'], { windowsHide: true }))
        .then(({ stdout }) => stdout.trim())
        .catch(() => null);
      // The signed archive must hold the version its release is named after.
      if (reported !== latest) throw new AiFailure('HOST_UPDATE_FAILED');
      // The new program copies itself into place and refreshes the registrations; it inherits
      // this process's environment, so it records the same Claude Code settings again.
      const installed = await new Promise<boolean>((resolve) => {
        const child = spawn(program, ['install'], { stdio: ['ignore', output, output], windowsHide: true });
        child.once('error', () => resolve(false));
        child.once('exit', (code) => resolve(code === 0));
      });
      if (!installed) throw new AiFailure('HOST_UPDATE_FAILED');
      return { version: latest };
    } finally {
      await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  return { check, update, describe: (result: HostUpdateCheck) => describeCheck(result, config) };
}

/** Terminal messages for update failures; the extension shows its own translated texts. */
export const UPDATE_FAILURES: Partial<Record<ErrorCode, string>> = {
  HOST_UPDATE_CHECK_FAILED: 'Could not reach GitHub to check for a newer release.',
  HOST_UPDATE_FAILED: 'The update could not be downloaded or installed; the installed version is unchanged.',
  HOST_UPDATE_UNVERIFIED: 'The downloaded release could not be verified, so nothing was installed.',
};

/** A terminal line for `writehand update --check`. */
function describeCheck(result: HostUpdateCheck, config: HostConfig): string {
  if (config.development)
    return `${PRODUCT_NAME} helper ${result.current} is a development installation and does not update itself.`;
  if (result.latest === null) return `No ${PRODUCT_NAME} release has been published yet.`;
  return result.available
    ? `${PRODUCT_NAME} helper ${result.latest} is available (installed: ${result.current}). Run: ${HELPER_COMMAND} update`
    : `${PRODUCT_NAME} helper ${result.current} is up to date.`;
}
