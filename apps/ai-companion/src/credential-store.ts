import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { lock } from 'proper-lockfile';
import { AI_MODES } from '@email-writer/contracts';
import { z } from 'zod';

const credentialsSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string().optional(),
    idToken: z.string().optional(),
    expiresAt: z.number(),
    scopes: z.array(z.string()),
  })
  .strict();
const accountSchema = z
  .object({
    clientId: z.string(),
    subject: z.string().nullable(),
    email: z.string().nullable(),
    label: z.string(),
    customLabel: z.boolean().optional(),
    credentials: credentialsSchema.nullable(),
    model: z.string().nullable(),
    welcomed: z.boolean(),
  })
  .strict();
const stateSchema = z
  .object({
    version: z.literal(1),
    hostId: z.string(),
    accounts: z.array(accountSchema).max(100),
    activeAccountId: z.string().nullable(),
    mode: z.enum(AI_MODES),
    apiKey: z.string().nullable(),
    apiModel: z.string().nullable(),
    // Added with Claude Code support; files written earlier do not have it.
    claudeModel: z.string().nullable().optional(),
  })
  .strict();
export type Credentials = z.infer<typeof credentialsSchema>;
export type Account = z.infer<typeof accountSchema>;
export type CredentialState = z.infer<typeof stateSchema>;

export interface CredentialStore {
  read(): Promise<CredentialState>;
  update<T>(operation: (state: CredentialState) => Promise<T> | T): Promise<T>;
}

const errorCode = (error: unknown) => (error instanceof Error && 'code' in error ? error.code : undefined);

/**
 * Replaces the credential file in one step. Windows briefly refuses to replace a file that
 * another program (antivirus, search indexing) has just opened; the store's lock is held,
 * so trying again is safe.
 */
async function replaceFile(source: string, target: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(source, target);
      return;
    } catch (error) {
      const code = errorCode(error);
      if (attempt >= 8 || (code !== 'EPERM' && code !== 'EACCES' && code !== 'EBUSY')) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 50));
    }
  }
}

/** Private runtime storage, atomic replacement and a cross-process lock for rotating refresh tokens. */
export function createCredentialStore(
  directory: string,
  options: {
    /** Limits a newly created directory to its owner where mode bits cannot (Windows ACL). */
    restrictDirectory?: ((directory: string) => Promise<void>) | null;
  } = {},
): CredentialStore {
  const file = join(directory, 'credentials.json');
  const prepare = async () => {
    const created = await mkdir(directory, { recursive: true, mode: 0o700 });
    if (created !== undefined && options.restrictDirectory) {
      try {
        await options.restrictDirectory(directory);
      } catch (error) {
        // Never keep an unprotected directory: the next attempt creates and restricts it again.
        await rmdir(directory).catch(() => undefined);
        throw error;
      }
    }
    await chmod(directory, 0o700);
  };
  const readState = async (): Promise<CredentialState> => {
    try {
      return stateSchema.parse(JSON.parse(await readFile(file, 'utf8')));
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') throw error;
      return {
        version: 1,
        hostId: `urn:uuid:${randomUUID()}`,
        accounts: [],
        activeAccountId: null,
        mode: 'chatgpt',
        apiKey: null,
        apiModel: null,
      };
    }
  };
  const update = async <T>(operation: (state: CredentialState) => Promise<T> | T): Promise<T> => {
    await prepare();
    const release = await lock(directory, {
      stale: 60_000,
      retries: { retries: 30, minTimeout: 100, maxTimeout: 1_000 },
    });
    const temporary = join(directory, `.credentials-${randomUUID()}.tmp`);
    try {
      const state = await readState();
      const result = await operation(state);
      await writeFile(temporary, JSON.stringify(stateSchema.parse(state)), { mode: 0o600, flag: 'wx' });
      await replaceFile(temporary, file);
      return result;
    } finally {
      await rm(temporary, { force: true });
      await release();
    }
  };
  return {
    // Even the first read persists the host ID exactly once under the lock.
    read: () => update((state) => structuredClone(state)),
    update,
  };
}
