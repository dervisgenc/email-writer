import { access, constants, open, readFile, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import { appError, err, ok, type AppError, type Result } from '@email-writer/contracts';

/** How Claude Code is started: an executable and the arguments that precede Claude Code's own. */
export interface ClaudeCommand {
  readonly file: string;
  readonly args: readonly string[];
}

/** Windows command scripts run only through cmd.exe, which would re-parse every argument. */
const COMMAND_SCRIPT = /\.(cmd|bat)$/i;

async function isExecutableFile(path: string): Promise<boolean> {
  try {
    if (!(await stat(path)).isFile()) return false;
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** A Windows program starts with the "MZ" signature; npm leaves a text placeholder when its install script did not run. */
async function isWindowsProgram(path: string): Promise<boolean> {
  const file = await open(path, 'r');
  try {
    const { buffer, bytesRead } = await file.read(Buffer.alloc(2), 0, 2, 0);
    return bytesRead === 2 && buffer.toString('latin1') === 'MZ';
  } finally {
    await file.close();
  }
}

/**
 * npm installs Claude Code on Windows as `claude.cmd` next to its `node_modules`. The
 * script only starts the package's native `claude.exe`, which is started directly instead.
 */
async function npmExecutable(script: string): Promise<string | null> {
  if (basename(script).toLowerCase() !== 'claude.cmd') return null;
  const packageDirectory = join(dirname(script), 'node_modules', '@anthropic-ai', 'claude-code');
  try {
    const manifest: unknown = JSON.parse(await readFile(join(packageDirectory, 'package.json'), 'utf8'));
    const bin = (manifest as { bin?: unknown }).bin;
    const entry = typeof bin === 'string' ? bin : (bin as { claude?: unknown } | undefined)?.claude;
    if (typeof entry !== 'string' || !entry.toLowerCase().endsWith('.exe')) return null;
    const executable = join(packageDirectory, entry);
    const inside = relative(packageDirectory, executable);
    if (inside.startsWith('..') || isAbsolute(inside)) return null;
    return (await isExecutableFile(executable)) && (await isWindowsProgram(executable)) ? executable : null;
  } catch {
    return null;
  }
}

/**
 * Returns the first usable Claude Code installation among `locations` (absolute paths in
 * search order; see the helper's platform module). A command script is never run itself:
 * it is either resolved to the program it starts or reported as an unsupported installation.
 */
export async function findClaudeBinary(
  locations: readonly string[],
): Promise<Result<ClaudeCommand, AppError>> {
  let scriptOnly = false;
  for (const location of locations) {
    if (!(await isExecutableFile(location))) continue;
    if (!COMMAND_SCRIPT.test(location)) return ok({ file: location, args: [] });
    const executable = await npmExecutable(location);
    if (executable !== null) return ok({ file: executable, args: [] });
    scriptOnly = true;
  }
  return err(appError(scriptOnly ? 'AI_CLAUDE_UNSUPPORTED_INSTALL' : 'AI_CLAUDE_NOT_INSTALLED'));
}
