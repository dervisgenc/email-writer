import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { lock } from 'proper-lockfile';
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
    mode: z.enum(['chatgpt', 'api-key']),
    apiKey: z.string().nullable(),
    apiModel: z.string().nullable(),
  })
  .strict();
export type Credentials = z.infer<typeof credentialsSchema>;
export type Account = z.infer<typeof accountSchema>;
export type CredentialState = z.infer<typeof stateSchema>;

export interface CredentialStore {
  read(): Promise<CredentialState>;
  update<T>(operation: (state: CredentialState) => Promise<T> | T): Promise<T>;
}

/** Private runtime storage, atomic replacement and a cross-process lock for rotating refresh tokens. */
export function createCredentialStore(directory: string): CredentialStore {
  const file = join(directory, 'credentials.json');
  const prepare = async () => {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
  };
  const readState = async (): Promise<CredentialState> => {
    try {
      return stateSchema.parse(JSON.parse(await readFile(file, 'utf8')));
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
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
      await rename(temporary, file);
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
