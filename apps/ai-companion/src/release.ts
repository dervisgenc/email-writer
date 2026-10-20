import { createHash, createPublicKey, verify, type KeyObject } from 'node:crypto';
import { AiFailure } from '@email-writer/ai-openai';
import {
  compareVersions,
  REPOSITORY,
  REPOSITORY_URL,
  versionSchema,
  type HostUpdateCheck,
} from '@email-writer/contracts';

import { ed25519PublicKey } from '../release-key.json';

/**
 * Rules for trusting a release, kept free of I/O. A release is installed only if its
 * SHA256SUMS carries a valid Ed25519 signature from the key built into this program
 * (scripts/generate-release-key.mjs) and lists the downloaded archive with its exact digest.
 */

export const RELEASE_PUBLIC_KEY: KeyObject = createPublicKey({
  key: Buffer.from(ed25519PublicKey, 'base64'),
  format: 'der',
  type: 'spki',
});

/** GitHub's latest published (not draft, not pre-release) release of this repository. */
export const LATEST_RELEASE_URL = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;

/** Files are downloaded only from this repository's releases. */
export function releaseFileUrl(version: string, name: string): string {
  return `${REPOSITORY_URL}/releases/download/v${versionSchema.parse(version)}/${encodeURIComponent(name)}`;
}

/** The version of a GitHub release response; tags are named vX.Y.Z. */
export function releaseVersionOf(body: unknown): string | null {
  const tag = typeof body === 'object' && body !== null ? (body as { tag_name?: unknown }).tag_name : null;
  if (typeof tag !== 'string' || !tag.startsWith('v')) return null;
  const version = versionSchema.safeParse(tag.slice(1));
  return version.success ? version.data : null;
}

export function updateCheck(current: string, latest: string | null): HostUpdateCheck {
  return { current, latest, available: latest !== null && compareVersions(latest, current) > 0 };
}

/** How long a check is reused: GitHub is asked at most once a day. */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface UpdateCache {
  readonly checkedAt: number;
  readonly latest: string | null;
}

export function parseUpdateCache(text: string | null, now: number): UpdateCache | null {
  try {
    const value = JSON.parse(text ?? '') as Partial<UpdateCache>;
    const fresh =
      typeof value.checkedAt === 'number' &&
      value.checkedAt <= now &&
      now - value.checkedAt < UPDATE_CHECK_INTERVAL_MS;
    const latest = value.latest === null ? null : versionSchema.safeParse(value.latest).data;
    return fresh && latest !== undefined ? { checkedAt: value.checkedAt as number, latest } : null;
  } catch {
    return null;
  }
}

/** "<sha256>  <file name>" lines, as written by scripts/sign-release.mjs and read by sha256sum -c. */
export function parseChecksums(text: string): Map<string, string> {
  const sums = new Map<string, string>();
  for (const line of text.split('\n')) {
    const match = /^([0-9a-f]{64}) [ *](.+)$/.exec(line.trimEnd());
    if (match) sums.set(match[2]!, match[1]!);
  }
  return sums;
}

export function verifyRelease(
  files: {
    readonly sums: Buffer;
    /** SHA256SUMS.sig: the base64 Ed25519 signature of SHA256SUMS. */
    readonly signature: string;
    readonly archive: { readonly name: string; readonly data: Buffer };
  },
  publicKey: KeyObject = RELEASE_PUBLIC_KEY,
): void {
  const signature = Buffer.from(files.signature.trim(), 'base64');
  if (signature.length !== 64 || !verify(null, files.sums, publicKey, signature))
    throw new AiFailure('HOST_UPDATE_UNVERIFIED');
  const expected = parseChecksums(files.sums.toString('utf8')).get(files.archive.name);
  const actual = createHash('sha256').update(files.archive.data).digest('hex');
  if (expected !== actual) throw new AiFailure('HOST_UPDATE_UNVERIFIED');
}
