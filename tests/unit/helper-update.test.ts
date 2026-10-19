import { execFileSync } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_HOST_CONFIG } from '../../apps/ai-companion/src/host-config';
import { hostPlatform } from '../../apps/ai-companion/src/platform';
import {
  parseChecksums,
  parseUpdateCache,
  RELEASE_PUBLIC_KEY,
  releaseFileUrl,
  releaseVersionOf,
  updateCheck,
  verifyRelease,
} from '../../apps/ai-companion/src/release';
import { createUpdater } from '../../apps/ai-companion/src/update';
import { HOST_VERSION } from '../../apps/ai-companion/src/version';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const signed = (files: Record<string, Buffer>) => {
  const sums = Buffer.from(
    Object.entries(files)
      .map(([name, data]) => `${sha256(data)}  ${name}\n`)
      .join(''),
  );
  return { sums, signature: sign(null, sums, privateKey).toString('base64') };
};

describe('Trusting a release', () => {
  it('carries a valid release key and downloads only from this repository', () => {
    expect(RELEASE_PUBLIC_KEY.asymmetricKeyType).toBe('ed25519');
    expect(releaseFileUrl('1.2.3', 'SHA256SUMS')).toBe(
      'https://github.com/dervisgenc/email-writer/releases/download/v1.2.3/SHA256SUMS',
    );
    expect(() => releaseFileUrl('../../evil', 'x')).toThrow();
  });

  it('reads the version from a vX.Y.Z tag only', () => {
    expect(releaseVersionOf({ tag_name: 'v1.2.3' })).toBe('1.2.3');
    for (const tag of ['1.2.3', 'v1.2', 'v1.2.3-beta', 'nightly'])
      expect(releaseVersionOf({ tag_name: tag })).toBe(null);
    expect(releaseVersionOf(null)).toBe(null);
  });

  it('reports an update only for a newer version', () => {
    expect(updateCheck('0.9.0', '0.10.0')).toEqual({ current: '0.9.0', latest: '0.10.0', available: true });
    expect(updateCheck('1.0.0', '1.0.0').available).toBe(false);
    expect(updateCheck('1.0.0', '0.9.0').available).toBe(false);
    expect(updateCheck('1.0.0', null).available).toBe(false);
  });

  it('reads sha256sum lines in text and binary mode', () => {
    const a = 'a'.repeat(64);
    const b = 'b'.repeat(64);
    expect([...parseChecksums(`${a}  one.zip\n${b} *two.tar.gz\r\nnot a line\n`)]).toEqual([
      ['one.zip', a],
      ['two.tar.gz', b],
    ]);
  });

  it('accepts an archive only with a valid signature and its exact checksum', () => {
    const archive = { name: 'writehand-linux-x64.tar.gz', data: Buffer.from('program') };
    const { sums, signature } = signed({ [archive.name]: archive.data, 'install.sh': Buffer.from('x') });
    expect(() => verifyRelease({ sums, signature, archive }, publicKey)).not.toThrow();

    const failures = [
      // Signed by another key (e.g. the one built into this program).
      () => verifyRelease({ sums, signature, archive }),
      () => verifyRelease({ sums, signature: 'AAAA', archive }, publicKey),
      () => verifyRelease({ sums: Buffer.concat([sums, Buffer.from('\n')]), signature, archive }, publicKey),
      () =>
        verifyRelease({ sums, signature, archive: { ...archive, data: Buffer.from('tampered') } }, publicKey),
      () =>
        verifyRelease(
          { sums, signature, archive: { ...archive, name: 'writehand-darwin-arm64.tar.gz' } },
          publicKey,
        ),
    ];
    for (const failure of failures) expect(failure).toThrow('HOST_UPDATE_UNVERIFIED');
  });

  it('reuses a check for a day', () => {
    const checkedAt = 1_000_000;
    const cache = JSON.stringify({ checkedAt, latest: '1.0.0' });
    expect(parseUpdateCache(cache, checkedAt + 1000)).toEqual({ checkedAt, latest: '1.0.0' });
    expect(parseUpdateCache(cache, checkedAt + 24 * 3600_000)).toBe(null);
    // A clock set back does not keep an old answer forever.
    expect(parseUpdateCache(cache, checkedAt - 1)).toBe(null);
    expect(parseUpdateCache(JSON.stringify({ checkedAt, latest: 'v1' }), checkedAt)).toBe(null);
    expect(parseUpdateCache(null, checkedAt)).toBe(null);
  });
});

describe('Updating the helper app', () => {
  const temporary: string[] = [];
  afterEach(async () => {
    for (const directory of temporary.splice(0)) await rm(directory, { recursive: true, force: true });
  });

  const setUp = async () => {
    const root = await mkdtemp(join(tmpdir(), 'writehand-update-'));
    temporary.push(root);
    const platform = hostPlatform(process.platform, { PATH: process.env.PATH }, join(root, 'home'));
    await mkdir(platform.installDirectory, { recursive: true });
    return { root, platform };
  };
  const response = (body: Buffer | object | null, status = 200) =>
    new Response(body === null ? null : Buffer.isBuffer(body) ? new Uint8Array(body) : JSON.stringify(body), {
      status,
    });

  it('asks GitHub at most once a day unless forced; a repository without releases has no update', async () => {
    const { platform } = await setUp();
    let now = 5_000_000;
    const fetch = vi.fn(async () => response(null, 404));
    const updater = createUpdater({ platform, config: DEFAULT_HOST_CONFIG, fetch, now: () => now });

    expect(await updater.check()).toEqual({ current: HOST_VERSION, latest: null, available: false });
    expect(await updater.check()).toEqual({ current: HOST_VERSION, latest: null, available: false });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]).toEqual([
      'https://api.github.com/repos/dervisgenc/email-writer/releases/latest',
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'application/vnd.github+json' }),
      }),
    ]);
    await updater.check(true);
    now += 24 * 3600_000;
    await updater.check();
    expect(fetch).toHaveBeenCalledTimes(3);

    fetch.mockImplementation(async () => response(null, 500));
    await expect(updater.check(true)).rejects.toThrow('HOST_UPDATE_CHECK_FAILED');
  });

  it('a development installation never asks GitHub or replaces itself', async () => {
    const { platform } = await setUp();
    const fetch = vi.fn();
    const updater = createUpdater({ platform, config: { ...DEFAULT_HOST_CONFIG, development: true }, fetch });
    expect(await updater.check(true)).toEqual({ current: HOST_VERSION, latest: null, available: false });
    await expect(updater.update('ignore')).rejects.toThrow('HOST_UPDATE_FAILED');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.skipIf(process.platform === 'win32')(
    'installs a verified release by running its program’s installer, and nothing else',
    async () => {
      const { root, platform } = await setUp();
      const marker = join(root, 'installed');
      const build = async (version: string) => {
        const directory = await mkdtemp(join(root, 'build-'));
        // A stand-in program: reports its version and records that its installer ran.
        await writeFile(
          join(directory, 'writehand'),
          `#!/bin/sh\nif [ "$1" = version ]; then echo ${version}; else echo "$@" > '${marker}'; fi\n`,
        );
        await chmod(join(directory, 'writehand'), 0o755);
        execFileSync('tar', ['-czf', join(directory, 'archive.tar.gz'), '-C', directory, 'writehand']);
        return readFile(join(directory, 'archive.tar.gz'));
      };
      const serve = (archive: Buffer, signedArchive = archive) => {
        const { sums, signature } = signed({ [platform.releaseArchive]: signedArchive });
        const files: Record<string, Buffer> = {
          SHA256SUMS: sums,
          'SHA256SUMS.sig': Buffer.from(signature),
          [platform.releaseArchive]: archive,
        };
        return vi.fn(async (url: string | URL | Request) => {
          const address = String(url);
          if (address.endsWith('/releases/latest')) return response({ tag_name: 'v9.9.9' });
          const prefix = 'https://github.com/dervisgenc/email-writer/releases/download/v9.9.9/';
          const file = address.startsWith(prefix)
            ? files[decodeURIComponent(address.slice(prefix.length))]
            : undefined;
          return file ? response(file) : response(null, 404);
        });
      };
      const exists = (path: string) =>
        access(path).then(
          () => true,
          () => false,
        );

      const good = await build('9.9.9');
      const tampered = createUpdater({
        platform,
        config: DEFAULT_HOST_CONFIG,
        fetch: serve(good, Buffer.from('other')),
        publicKey,
      });
      await expect(tampered.update('ignore')).rejects.toThrow('HOST_UPDATE_UNVERIFIED');
      expect(await exists(marker)).toBe(false);

      const mislabelled = createUpdater({
        platform,
        config: DEFAULT_HOST_CONFIG,
        fetch: serve(await build('9.9.8')),
        publicKey,
      });
      await expect(mislabelled.update('ignore')).rejects.toThrow('HOST_UPDATE_FAILED');
      expect(await exists(marker)).toBe(false);

      const updater = createUpdater({ platform, config: DEFAULT_HOST_CONFIG, fetch: serve(good), publicKey });
      expect(await updater.update('ignore')).toEqual({ version: '9.9.9' });
      expect((await readFile(marker, 'utf8')).trim()).toBe('install');
    },
  );
});
