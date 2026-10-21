import { aiModelSchema, type AiInput, type AiModel } from '@writehand/contracts';
import { z } from 'zod';

import { AiFailure, providerFailure } from './errors';
import { CODEX_ORIGINATOR } from './oauth';
import { buildEmailRequest } from './prompt';

/**
 * Where requests go and how they are authorized: an API key or a Sign in with ChatGPT token
 * on the public API, or a Codex sign-in token on ChatGPT's Codex backend, which also needs
 * the ChatGPT account (workspace) the token was issued for.
 */
export type OpenAiConnection =
  | { readonly kind: 'api-key' | 'chatgpt'; readonly token: string }
  | { readonly kind: 'codex'; readonly token: string; readonly workspaceId: string };

const apiEndpoint = 'https://api.openai.com/v1';
const codexEndpoint = 'https://chatgpt.com/backend-api/codex';
/**
 * The Codex backend lists the models available to a client of the given version. This app's
 * requests were checked against this Codex CLI version (October 2026).
 */
const codexClientVersion = '0.163.0';
// The Codex backend names some errors in `type` instead of `code`.
const errorBody = z.object({
  error: z.object({ code: z.string().optional(), type: z.string().optional() }).optional(),
});
const eventSchema = z.object({
  type: z.string(),
  delta: z.string().optional(),
  code: z.string().optional(),
  response: z.object({ error: z.object({ code: z.string().optional() }).nullable().optional() }).optional(),
});

function target(connection: OpenAiConnection): { base: string; headers: Record<string, string> } {
  const authorization = { Authorization: `Bearer ${connection.token}` };
  if (connection.kind !== 'codex') return { base: apiEndpoint, headers: authorization };
  return {
    base: codexEndpoint,
    headers: {
      ...authorization,
      'chatgpt-account-id': connection.workspaceId,
      originator: CODEX_ORIGINATOR,
      'OpenAI-Beta': 'responses=experimental',
    },
  };
}

async function checkResponse(response: Response): Promise<void> {
  if (response.ok) return;
  const body = errorBody.safeParse(await response.json().catch(() => null));
  const error = body.success ? body.data.error : undefined;
  throw providerFailure(response.status, error?.code ?? error?.type);
}

/** A stream is successful only after response.completed, including when text arrived earlier. */
export async function readResponseStream(response: Response): Promise<string> {
  await checkResponse(response);
  if (response.body === null) throw new AiFailure('AI_RESPONSE_INCOMPLETE');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let completed = false;
  const consume = (frame: string) => {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data || data === '[DONE]') return;
    let raw: unknown;
    try {
      raw = JSON.parse(data);
    } catch {
      throw new AiFailure('AI_RESPONSE_INCOMPLETE');
    }
    const parsed = eventSchema.safeParse(raw);
    if (!parsed.success) throw new AiFailure('AI_RESPONSE_INCOMPLETE');
    const event = parsed.data;
    if (event.type === 'response.output_text.delta') text += event.delta ?? '';
    if (text.length > 30_000) throw new AiFailure('RESULT_INVALID');
    if (event.type === 'response.failed' || event.type === 'error')
      throw providerFailure(0, event.response?.error?.code ?? event.code);
    if (event.type === 'response.incomplete') throw new AiFailure('AI_RESPONSE_INCOMPLETE');
    if (event.type === 'response.completed') completed = true;
  };
  try {
    while (!completed) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer)) !== null) {
        consume(buffer.slice(0, boundary.index));
        buffer = buffer.slice(boundary.index + boundary[0].length);
      }
      if (buffer.length > 1_000_000) throw new AiFailure('AI_RESPONSE_INCOMPLETE');
    }
    if (!completed || !text.trim()) throw new AiFailure('AI_RESPONSE_INCOMPLETE');
    return text.trim();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function createOpenAiProvider(fetcher: typeof fetch = fetch) {
  return {
    async listModels(connection: OpenAiConnection): Promise<AiModel[]> {
      const { base, headers } = target(connection);
      const query = connection.kind === 'codex' ? `?client_version=${codexClientVersion}` : '';
      const response = await fetcher(`${base}/models${query}`, {
        headers,
        signal: AbortSignal.timeout(20_000),
      });
      await checkResponse(response);
      const raw: unknown = await response.json();
      if (connection.kind !== 'api-key') {
        // ChatGPT plans (either sign-in) get an account-specific catalog in the same format.
        const catalog = z
          .object({
            models: z.array(z.object({ slug: z.string(), display_name: z.string(), visibility: z.string() })),
          })
          .parse(raw);
        return z
          .array(aiModelSchema)
          .max(500)
          .parse(
            catalog.models
              .filter((model) => model.visibility === 'list')
              .map((model) => ({ id: model.slug, label: model.display_name })),
          );
      }
      const catalog = z.object({ data: z.array(z.object({ id: z.string() })) }).parse(raw);
      return catalog.data
        .filter(({ id }) => /^(gpt-|o\d)/.test(id) && !/(audio|realtime|image|transcri|tts)/.test(id))
        .slice(0, 500)
        .map(({ id }) => ({ id, label: id }));
    },
    async generate(input: AiInput, model: string, connection: OpenAiConnection, signal: AbortSignal) {
      const { base, headers } = target(connection);
      const response = await fetcher(`${base}/responses`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(buildEmailRequest(input, model)),
        signal,
      });
      return readResponseStream(response);
    },
  };
}
