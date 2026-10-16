import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appError,
  buildTaskPrompt,
  err,
  ok,
  type AiInput,
  type AiModel,
  type AppError,
  type ErrorCode,
  type Result,
} from '@email-writer/contracts';
import { z } from 'zod';

import type { ClaudeCommand } from './binary';

/**
 * Claude Code resolves these aliases to the latest model of each family. Haiku is not
 * offered: in Turkish replies it repeatedly doubled letters ("bbana", "bbizim"; checked
 * 16 October 2026), which would go straight into the user's email.
 */
export const CLAUDE_CODE_MODELS: readonly AiModel[] = [
  { id: 'sonnet', label: 'Claude Sonnet' },
  { id: 'opus', label: 'Claude Opus' },
];
export const DEFAULT_CLAUDE_CODE_MODEL = 'sonnet';

export interface ClaudeCodeStatus {
  readonly installed: boolean;
  readonly loggedIn: boolean;
  readonly subscription: boolean;
  readonly plan: string | null;
  readonly account: string | null;
  readonly organization: string | null;
  /** Set when Claude Code was found but cannot be started safely (e.g. only a claude.cmd script). */
  readonly problem?: ErrorCode;
}

const MAX_OUTPUT_BYTES = 1_000_000;
const MAX_RESULT_LENGTH = 30_000;
const STATUS_TIMEOUT_MS = 15_000;

/**
 * Print-mode arguments. Email is untrusted input, so Claude Code runs without tools,
 * MCP servers, skills or user/project settings (which may define hooks), and never
 * saves the conversation to its session transcripts. The prompt itself goes to stdin.
 * The system prompt holds no email content and stays far below Windows' command line limit.
 */
export function claudeCodeArgs(model: string, systemPrompt: string): string[] {
  return [
    '-p',
    '--output-format',
    'json',
    '--model',
    model,
    '--restricted',
    '--tools',
    '',
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--no-session-persistence',
    '--system-prompt',
    systemPrompt,
  ];
}

interface RunOutcome {
  readonly started: boolean;
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly overflow: boolean;
}

function run(
  command: ClaudeCommand,
  args: readonly string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; input: string; signal: AbortSignal },
): Promise<RunOutcome> {
  return new Promise((resolve) => {
    // Never through a shell: the system prompt is an argument and must reach Claude Code unchanged.
    const child = spawn(command.file, [...command.args, ...args], {
      cwd: options.cwd,
      env: options.env,
      // stderr is never read: it may contain fragments of the request.
      stdio: ['pipe', 'pipe', 'ignore'],
      windowsHide: true,
    });
    const chunks: Buffer[] = [];
    let size = 0;
    let overflow = false;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      child.kill('SIGTERM');
      killTimer ??= setTimeout(() => child.kill('SIGKILL'), 3_000);
    };
    const onAbort = () => stop();
    options.signal.addEventListener('abort', onAbort, { once: true });
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_OUTPUT_BYTES) {
        overflow = true;
        stop();
        return;
      }
      chunks.push(chunk);
    });
    // The process may exit before reading stdin (e.g. when it is not installed correctly).
    child.stdin.on('error', () => undefined);
    child.once('error', () => {
      options.signal.removeEventListener('abort', onAbort);
      resolve({ started: false, exitCode: null, stdout: '', overflow: false });
    });
    child.once('close', (exitCode) => {
      clearTimeout(killTimer);
      options.signal.removeEventListener('abort', onAbort);
      resolve({ started: true, exitCode, stdout: Buffer.concat(chunks).toString('utf8'), overflow });
    });
    if (options.signal.aborted) stop();
    child.stdin.end(options.input);
  });
}

const authStatusSchema = z.object({
  loggedIn: z.boolean(),
  authMethod: z.string().optional(),
  subscriptionType: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  orgName: z.string().nullable().optional(),
});

const resultSchema = z.object({
  type: z.literal('result'),
  subtype: z.string(),
  is_error: z.boolean(),
  result: z.string().optional(),
  stop_reason: z.string().nullable().optional(),
  api_error_status: z.number().nullable().optional(),
});
type ClaudeResult = z.infer<typeof resultSchema>;

/** Maps a failed print-mode result to a stable code. The message text is never surfaced. */
export function claudeFailureCode(result: ClaudeResult): ErrorCode {
  const message = result.result ?? '';
  const status = result.api_error_status ?? null;
  if (status === 401 || /not logged in|\/login|invalid api key|oauth token/i.test(message))
    return 'AI_CLAUDE_NOT_LOGGED_IN';
  if (status === 429 || /usage limit|rate limit|limit reached/i.test(message)) return 'AI_LIMIT_REACHED';
  if (status === 403) return 'AI_ACCESS_DENIED';
  if (status === 404) return 'AI_MODEL_UNAVAILABLE';
  if (result.subtype === 'error_max_turns') return 'AI_RESPONSE_INCOMPLETE';
  return 'AI_UNAVAILABLE';
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Runs the user's own, unmodified Claude Code. Sign-in happens only through Claude
 * Code's own flow; this provider never reads or stores Claude credentials.
 */
export function createClaudeCodeProvider(options: {
  env: NodeJS.ProcessEnv;
  /** Locates Claude Code on this computer (see `findClaudeBinary`). */
  findBinary: () => Promise<Result<ClaudeCommand, AppError>>;
}) {
  const { findBinary } = options;
  const withWorkspace = async <T>(operation: (cwd: string) => Promise<T>): Promise<T> => {
    // An empty private directory: no project instructions or files are in reach.
    const cwd = await mkdtemp(join(tmpdir(), 'email-writer-claude-'));
    try {
      return await operation(cwd);
    } finally {
      // Windows may release the finished process's hold on the directory a moment later.
      await rm(cwd, { recursive: true, force: true, maxRetries: 3 });
    }
  };

  return {
    models: CLAUDE_CODE_MODELS,

    async status(): Promise<ClaudeCodeStatus> {
      const missing = {
        installed: false,
        loggedIn: false,
        subscription: false,
        plan: null,
        account: null,
        organization: null,
      };
      const binary = await findBinary();
      if (!binary.ok)
        return binary.error.code === 'AI_CLAUDE_NOT_INSTALLED'
          ? missing
          : { ...missing, problem: binary.error.code };
      const outcome = await withWorkspace((cwd) =>
        run(binary.value, ['auth', 'status', '--json'], {
          cwd,
          env: options.env,
          input: '',
          signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
        }),
      );
      if (!outcome.started) return missing;
      const parsed = authStatusSchema.safeParse(parseJson(outcome.stdout));
      if (!parsed.success) return { ...missing, installed: true };
      const status = parsed.data;
      return {
        installed: true,
        loggedIn: status.loggedIn,
        subscription: status.loggedIn && status.authMethod === 'claude.ai',
        plan: status.loggedIn ? (status.subscriptionType ?? null) : null,
        account: status.loggedIn ? (status.email ?? null) : null,
        organization: status.loggedIn ? (status.orgName ?? null) : null,
      };
    },

    async generate(input: AiInput, model: string, signal: AbortSignal): Promise<Result<string, AppError>> {
      if (!CLAUDE_CODE_MODELS.some((item) => item.id === model)) return err(appError('AI_MODEL_UNAVAILABLE'));
      const binary = await findBinary();
      if (!binary.ok) return err(binary.error);
      const prompt = buildTaskPrompt(input);
      const outcome = await withWorkspace((cwd) =>
        run(binary.value, claudeCodeArgs(model, prompt.system), {
          cwd,
          env: options.env,
          input: prompt.user,
          signal,
        }),
      );
      if (signal.aborted) return err(appError('READ_CANCELLED'));
      if (!outcome.started) return err(appError('AI_CLAUDE_NOT_INSTALLED'));
      if (outcome.overflow) return err(appError('AI_RESPONSE_INCOMPLETE'));
      const parsed = resultSchema.safeParse(parseJson(outcome.stdout));
      if (!parsed.success)
        return err(appError(outcome.exitCode === 0 ? 'AI_RESPONSE_INCOMPLETE' : 'AI_UNAVAILABLE'));
      const result = parsed.data;
      if (result.is_error || result.subtype !== 'success') return err(appError(claudeFailureCode(result)));
      // A truncated answer is never offered as a result.
      if (result.stop_reason === 'max_tokens') return err(appError('AI_RESPONSE_INCOMPLETE'));
      const text = (result.result ?? '').trim();
      if (!text) return err(appError('AI_RESPONSE_INCOMPLETE'));
      if (text.length > MAX_RESULT_LENGTH) return err(appError('RESULT_INVALID'));
      return ok(text);
    },
  };
}

export type ClaudeCodeProvider = ReturnType<typeof createClaudeCodeProvider>;
