import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClaudeCodeProvider, findClaudeBinary } from '@email-writer/ai-claude-code';
import { buildTaskPrompt, type AiInput } from '@email-writer/contracts';
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
 * `claude -p --output-format json` or `claude auth status --json`.
 */
const FAKE_CLAUDE = `#!/usr/bin/env node
const fs = require('node:fs');
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
  let binary: string;
  let record: string;
  const provider = (mode: string, findBinary?: () => Promise<string | null>) =>
    createClaudeCodeProvider({
      env: { ...process.env, FAKE_MODE: mode, FAKE_RECORD: record },
      findBinary: findBinary ?? (async () => binary),
    });
  const generate = (mode: string, model = 'sonnet', signal = new AbortController().signal) =>
    provider(mode).generate(input, model, signal);

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'email-writer-fake-claude-'));
    binary = join(directory, 'claude');
    record = join(directory, 'record.json');
    await writeFile(binary, FAKE_CLAUDE);
    await chmod(binary, 0o700);
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
    expect(
      await provider('success', async () => null).generate(input, 'sonnet', new AbortController().signal),
    ).toMatchObject({
      ok: false,
      error: { code: 'AI_CLAUDE_NOT_INSTALLED' },
    });
    const vanished = provider('success', async () => join(directory, 'missing'));
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
    expect((await provider('success', async () => null).status()).installed).toBe(false);
  });

  it('finds the recorded path first, then PATH, then the usual install locations', async () => {
    const home = join(directory, 'home');
    const pathDirectory = join(directory, 'bin');
    await mkdir(join(home, '.local', 'bin'), { recursive: true });
    await mkdir(pathDirectory);
    const local = join(home, '.local', 'bin', 'claude');
    const onPath = join(pathDirectory, 'claude');
    await writeFile(local, FAKE_CLAUDE, { mode: 0o700 });
    await writeFile(onPath, FAKE_CLAUDE, { mode: 0o600 });

    expect(await findClaudeBinary({ EMAIL_WRITER_CLAUDE_PATH: binary, PATH: pathDirectory }, home, [])).toBe(
      binary,
    );
    // Not executable, and relative PATH entries are ignored.
    expect(await findClaudeBinary({ PATH: `bin:${pathDirectory}` }, home, [])).toBe(local);
    await chmod(onPath, 0o700);
    expect(await findClaudeBinary({ PATH: pathDirectory }, home, [])).toBe(onPath);
    expect(await findClaudeBinary({}, join(directory, 'empty'), [])).toBeNull();
  });
});
