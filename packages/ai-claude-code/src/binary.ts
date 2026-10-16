import { access, constants } from 'node:fs/promises';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';

/**
 * The browser starts the native host with a minimal PATH, so the installer records the
 * path it found (EMAIL_WRITER_CLAUDE_PATH). Common install locations are the fallback.
 */
export async function findClaudeBinary(
  env: Readonly<Record<string, string | undefined>>,
  home: string = homedir(),
  systemDirectories: readonly string[] = ['/opt/homebrew/bin', '/usr/local/bin'],
): Promise<string | null> {
  const candidates = [
    env.EMAIL_WRITER_CLAUDE_PATH,
    ...(env.PATH ?? '').split(delimiter).map((directory) => join(directory, 'claude')),
    join(home, '.local', 'bin', 'claude'),
    join(home, '.claude', 'local', 'claude'),
    ...systemDirectories.map((directory) => join(directory, 'claude')),
  ];
  for (const candidate of candidates) {
    if (!candidate || !isAbsolute(candidate)) continue;
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      /* Try the next location. */
    }
  }
  return null;
}
