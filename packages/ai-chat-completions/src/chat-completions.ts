import {
  buildTaskPrompt,
  type AiInput,
  type AiModel,
  type AppError,
  type Result,
} from '@writehand/contracts';
import { z } from 'zod';

import { readEventStream } from './event-stream';
import { failureFor, ProviderFailure, settle } from './failure';

const MAX_RESULT_LENGTH = 30_000;
const LIST_TIMEOUT_MS = 20_000;

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** What differs between OpenAI-compatible providers. */
export interface ChatCompletionsConfig {
  /** API base URL, e.g. `https://api.groq.com/openai/v1`. */
  readonly baseUrl: string;
  /** Reads the `/models` response into the models that can write email. */
  readonly parseModels: (raw: unknown) => AiModel[];
  /** Request that verifies a key when the model list itself needs none (OpenRouter). */
  readonly keyCheckPath?: string;
  /** The model used until the user chooses one: one that is free to use, or none. */
  readonly defaultModel: (models: readonly AiModel[]) => string | null;
}

export interface ChatCompletionsProvider {
  /** Checks the key and lists the models it can use; never generates text. */
  listModels(apiKey: string): Promise<Result<AiModel[], AppError>>;
  defaultModel(models: readonly AiModel[]): string | null;
  generate(
    input: AiInput,
    model: string,
    apiKey: string,
    signal: AbortSignal,
  ): Promise<Result<string, AppError>>;
}

/** The first preferred model the catalog offers. */
export function firstAvailable(models: readonly AiModel[], preferred: readonly string[]): string | null {
  return preferred.find((id) => models.some((model) => model.id === id)) ?? null;
}

const errorCodeSchema = z.union([z.string(), z.number()]).nullable().optional();
const errorBodySchema = z.object({ error: z.object({ code: errorCodeSchema }).optional() });
const chunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z.object({ content: z.string().nullable().optional() }).optional(),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .optional(),
  error: z.object({ code: errorCodeSchema }).optional(),
});

/** Groq names the error (`model_not_found`); OpenRouter repeats the HTTP status as a number. */
function failureFromCode(status: number, code: string | number | null | undefined): ProviderFailure {
  return typeof code === 'number' ? failureFor(code) : failureFor(status, code ?? undefined);
}

async function failureOf(response: Response): Promise<ProviderFailure> {
  const body = errorBodySchema.safeParse(await response.json().catch(() => null));
  return failureFromCode(response.status, body.success ? body.data.error?.code : undefined);
}

/** The same task prompt as every other method; email is data inside the user message. */
export function buildChatRequest(input: AiInput, model: string) {
  const prompt = buildTaskPrompt(input);
  return {
    model,
    stream: true,
    messages: [
      { role: 'system' as const, content: prompt.system },
      { role: 'user' as const, content: prompt.user },
    ],
  };
}

/**
 * Streams the answer so that a long generation keeps the connection active, and accepts it
 * only after the model finished normally: a cut-off answer is never returned.
 */
export async function readCompletionStream(response: Response): Promise<string> {
  if (!response.ok) throw await failureOf(response);
  if (response.body === null) throw new ProviderFailure('AI_RESPONSE_INCOMPLETE');
  let text = '';
  let finished = false;
  await readEventStream(response.body, (data) => {
    if (data === '[DONE]') return 'stop';
    let raw: unknown;
    try {
      raw = JSON.parse(data);
    } catch {
      throw new ProviderFailure('AI_RESPONSE_INCOMPLETE');
    }
    const chunk = chunkSchema.safeParse(raw);
    if (!chunk.success) throw new ProviderFailure('AI_RESPONSE_INCOMPLETE');
    if (chunk.data.error) throw failureFromCode(0, chunk.data.error.code);
    const choice = chunk.data.choices?.[0];
    text += choice?.delta?.content ?? '';
    if (text.length > MAX_RESULT_LENGTH) throw new ProviderFailure('RESULT_INVALID');
    const reason = choice?.finish_reason;
    if (!reason) return 'continue';
    if (reason === 'stop') {
      finished = true;
      return 'stop';
    }
    if (reason === 'length' || reason === 'content_filter')
      throw new ProviderFailure('AI_RESPONSE_INCOMPLETE');
    // No tools are offered, so anything else is a provider error.
    throw new ProviderFailure(reason === 'error' ? 'AI_UNAVAILABLE' : 'RESULT_INVALID');
  });
  if (!finished || !text.trim()) throw new ProviderFailure('AI_RESPONSE_INCOMPLETE');
  return text.trim();
}

export function createChatCompletionsProvider(
  config: ChatCompletionsConfig,
  fetcher: Fetcher = (url, init) => fetch(url, init),
): ChatCompletionsProvider {
  const read = async (path: string, apiKey: string): Promise<unknown> => {
    const response = await fetcher(`${config.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
    });
    if (!response.ok) throw await failureOf(response);
    return response.json();
  };
  return {
    listModels: (apiKey) =>
      settle(async () => {
        if (config.keyCheckPath !== undefined) await read(config.keyCheckPath, apiKey);
        const models = config.parseModels(await read('/models', apiKey));
        if (models.length === 0) throw new ProviderFailure('AI_MODEL_UNAVAILABLE');
        return models;
      }),
    defaultModel: config.defaultModel,
    generate: (input, model, apiKey, signal) =>
      settle(async () => {
        const response = await fetcher(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(buildChatRequest(input, model)),
          signal,
        });
        return readCompletionStream(response);
      }),
  };
}
