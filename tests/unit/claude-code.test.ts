import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  claudeCodeArgs,
  createClaudeCodeProvider,
  findClaudeBinary,
  type ClaudeCommand,
} from '@email-writer/ai-claude-code';
import {
  appError,
  buildTaskPrompt,
  err,
  ok,
  OPERATIONS,
  type AiInput,
  type AppError,
  type Result,
} from '@email-writer/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const input: AiInput = {
  operation: 'revise',
  source: 'yarin ki toplanti saat 3 te mi',
  instruction: '',
  tone: 'neutral',
  targetLanguage: null,
  standingInstructions: '',
  format: 'rich',
  refinement: null,
  messages: [],
};

/**
 * Stands in for the real CLI: records what it received and answers like
 * `claude -p --output-format json` or `claude auth status --json`. It runs as
 * `node fake-claude.cjs`, so the same fake works on every operating system.
 */
const FAKE_CLAUDE = `const fs = require('node:fs');
const args = process.argv.slice(2);
let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  if (process.env.FAKE_RECORD) {
    fs.writeFileSync(process.env.FAKE_RECORD, JSON.stringify({ args, cwd: process.cwd(), entries: fs.readdirSync(process.cwd()), input }));
  }
  const reply = (value, code = 0) => { process.stdout.write(JSON.stringify(value)); process.exit(code); };
  const mode = process.env.FAKE_MODE;
  if (args[0] === 'auth') {
    if (mode === 'signed-out') reply({ loggedIn: false, authMethod: 'none' }, 1);
    reply({ loggedIn: true, authMethod: mode === 'api-key' ? 'api_key' : 'claude.ai', subscriptionType: 'max', email: 'c@example.test', orgName: 'Org' });
  }
  const result = (fields, code = 0) => reply({ type: 'result', subtype: 'success', is_error: false, stop_reason: 'end_turn', ...fields }, code);
  switch (mode) {
    case 'signed-out': return result({ is_error: true, result: 'Not logged in · Please run /login' }, 1);
    case 'limit': return result({ is_error: true, api_error_status: 429, result: 'limit' }, 1);
    case 'max-tokens': return result({ result: 'Yarım', stop_reason: 'max_tokens' });
    case 'garbage': process.stdout.write('not json'); return process.exit(1);
    case 'hang': return setInterval(() => undefined, 1000);
    default: return result({ result: '  Yarınki toplantı saat 15:00’te mi?  ' });
  }
});
`;

describe('Claude Code provider', () => {
  let directory: string;
  let fake: ClaudeCommand;
  let record: string;
  const provider = (mode: string, findBinary?: () => Promise<Result<ClaudeCommand, AppError>>) =>
    createClaudeCodeProvider({
      env: { ...process.env, FAKE_MODE: mode, FAKE_RECORD: record },
      findBinary: findBinary ?? (async () => ok(fake)),
    });
  const generate = (mode: string, model = 'sonnet', signal = new AbortController().signal) =>
    provider(mode).generate(input, model, signal);

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'email-writer-fake-claude-'));
    const script = join(directory, 'fake-claude.cjs');
    record = join(directory, 'record.json');
    await writeFile(script, FAKE_CLAUDE);
    fake = { file: process.execPath, args: [script] };
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('runs without tools, settings, MCP servers or session transcripts; the email goes only to stdin', async () => {
    expect(await generate('success')).toEqual({ ok: true, value: 'Yarınki toplantı saat 15:00’te mi?' });

    const seen = JSON.parse(await readFile(record, 'utf8')) as {
      args: string[];
      cwd: string;
      entries: string[];
      input: string;
    };
    expect(seen.args.slice(0, 5)).toEqual(['-p', '--output-format', 'json', '--model', 'sonnet']);
    expect(seen.args).toEqual(
      expect.arrayContaining([
        '--restricted',
        '--strict-mcp-config',
        '--disable-slash-commands',
        '--no-session-persistence',
      ]),
    );
    // The empty tool list and the multi-line system prompt arrive unchanged (no shell re-parsing).
    expect(seen.args[seen.args.indexOf('--tools') + 1]).toBe('');
    expect(seen.args[seen.args.indexOf('--system-prompt') + 1]).toBe(buildTaskPrompt(input).system);
    expect(seen.args.join(' ')).not.toContain(input.source);
    expect(seen.input).toBe(buildTaskPrompt(input).user);
    // An empty private working directory that is removed afterwards.
    expect(seen.entries).toEqual([]);
    await expect(stat(seen.cwd)).rejects.toThrow();
  });

  it.each([
    ['signed-out', 'AI_CLAUDE_NOT_LOGGED_IN'],
    ['limit', 'AI_LIMIT_REACHED'],
    ['max-tokens', 'AI_RESPONSE_INCOMPLETE'],
    ['garbage', 'AI_UNAVAILABLE'],
  ])('maps the %s outcome to %s without passing the message on', async (mode, code) => {
    expect(await generate(mode)).toEqual({ ok: false, error: expect.objectContaining({ code }) });
  });

  it('rejects unknown models and missing installations before running anything', async () => {
    expect(await generate('success', 'gpt-5')).toMatchObject({
      ok: false,
      error: { code: 'AI_MODEL_UNAVAILABLE' },
    });
    const missing = provider('success', async () => err(appError('AI_CLAUDE_NOT_INSTALLED')));
    expect(await missing.generate(input, 'sonnet', new AbortController().signal)).toMatchObject({
      ok: false,
      error: { code: 'AI_CLAUDE_NOT_INSTALLED' },
    });
    const vanished = provider('success', async () => ok({ file: join(directory, 'missing'), args: [] }));
    expect(await vanished.generate(input, 'sonnet', new AbortController().signal)).toMatchObject({
      ok: false,
      error: { code: 'AI_CLAUDE_NOT_INSTALLED' },
    });
  });

  it('stops the process when the request is cancelled', async () => {
    const abort = new AbortController();
    const started = Date.now();
    setTimeout(() => abort.abort(), 200);

    expect(await generate('hang', 'sonnet', abort.signal)).toMatchObject({
      ok: false,
      error: { code: 'READ_CANCELLED' },
    });
    expect(Date.now() - started).toBeLessThan(3_000);
  });

  it('reads the sign-in state from Claude Code without touching credentials', async () => {
    expect(await provider('success').status()).toEqual({
      installed: true,
      loggedIn: true,
      subscription: true,
      plan: 'max',
      account: 'c@example.test',
      organization: 'Org',
    });
    expect(await provider('api-key').status()).toMatchObject({ loggedIn: true, subscription: false });
    expect(await provider('signed-out').status()).toEqual({
      installed: true,
      loggedIn: false,
      subscription: false,
      plan: null,
      account: null,
      organization: null,
    });
    expect(await provider('success', async () => err(appError('AI_CLAUDE_NOT_INSTALLED'))).status()).toEqual({
      installed: false,
      loggedIn: false,
      subscription: false,
      plan: null,
      account: null,
      organization: null,
    });
  });

  it('reports an installation that cannot be started safely instead of "not installed"', async () => {
    const scriptOnly = provider('success', async () => err(appError('AI_CLAUDE_UNSUPPORTED_INSTALL')));
    expect(await scriptOnly.status()).toMatchObject({
      installed: false,
      problem: 'AI_CLAUDE_UNSUPPORTED_INSTALL',
    });
    expect(await scriptOnly.generate(input, 'sonnet', new AbortController().signal)).toMatchObject({
      ok: false,
      error: { code: 'AI_CLAUDE_UNSUPPORTED_INSTALL' },
    });
  });

  it('keeps the command line far below the Windows limit; the email itself goes to stdin', () => {
    const lengths = OPERATIONS.flatMap((operation) =>
      (['plain', 'rich'] as const).flatMap((format) =>
        [null, { instruction: 'x'.repeat(500), previous: 'y'.repeat(30_000) }].map((refinement) => {
          const prompt = buildTaskPrompt({
            ...input,
            operation,
            format,
            refinement,
            standingInstructions: 'z'.repeat(1_000),
          });
          return claudeCodeArgs('sonnet', prompt.system).join(' ').length;
        }),
      ),
    );
    // CreateProcess accepts 32,767 characters; quoting adds little.
    expect(Math.max(...lengths)).toBeLessThan(16_000);
  });
});

describe('Finding Claude Code', () => {
  let directory: string;
  const file = async (path: string, content: string | Buffer = 'program') => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, { mode: 0o700 });
    return path;
  };
  /** npm's global layout on Windows: claude.cmd next to the package that holds claude.exe. */
  const npmInstall = async (prefix: string, executable: string | Buffer) => {
    const script = await file(join(prefix, 'claude.cmd'), '@"%~dp0\\node_modules\\claude.exe" %*');
    const packageDirectory = join(prefix, 'node_modules', '@anthropic-ai', 'claude-code');
    await file(join(packageDirectory, 'package.json'), JSON.stringify({ bin: { claude: 'bin/claude.exe' } }));
    await file(join(packageDirectory, 'bin', 'claude.exe'), executable);
    return { script, executable: join(packageDirectory, 'bin', 'claude.exe') };
  };
  const program = Buffer.from('MZ program');

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'email-writer-find-claude-'));
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('returns the first existing location and skips missing paths and directories', async () => {
    const first = await file(join(directory, 'a', 'claude'));
    await file(join(directory, 'b', 'claude'));
    await mkdir(join(directory, 'folder', 'claude'), { recursive: true });

    expect(
      await findClaudeBinary([
        join(directory, 'none', 'claude'),
        join(directory, 'folder', 'claude'),
        first,
        join(directory, 'b', 'claude'),
      ]),
    ).toEqual(ok({ file: first, args: [] }));
    expect(await findClaudeBinary([join(directory, 'none', 'claude')])).toEqual(
      err(appError('AI_CLAUDE_NOT_INSTALLED')),
    );
  });

  it("starts the program behind npm's claude.cmd directly instead of running the script", async () => {
    const npm = await npmInstall(join(directory, 'npm'), program);
    expect(await findClaudeBinary([npm.script])).toEqual(ok({ file: npm.executable, args: [] }));
  });

  it('reports a script it cannot resolve, unless a usable installation comes later', async () => {
    // npm leaves a text placeholder instead of the program when its install script did not run.
    const placeholder = await npmInstall(join(directory, 'npm'), '#!/bin/sh\necho placeholder');
    const other = await file(join(directory, 'pnpm', 'claude.cmd'), '@node claude.js %*');
    const later = await file(join(directory, 'native', 'claude.exe'), program);

    expect(await findClaudeBinary([placeholder.script, other])).toEqual(
      err(appError('AI_CLAUDE_UNSUPPORTED_INSTALL')),
    );
    expect(await findClaudeBinary([other, later])).toEqual(ok({ file: later, args: [] }));
  });

  // Windows has no execute permission bit; there every existing file counts.
  it.skipIf(process.platform === 'win32')('skips files that are not executable', async () => {
    const plain = join(directory, 'plain', 'claude');
    await mkdir(dirname(plain));
    await writeFile(plain, 'program', { mode: 0o600 });
    expect(await findClaudeBinary([plain])).toEqual(err(appError('AI_CLAUDE_NOT_INSTALLED')));
  });
});
