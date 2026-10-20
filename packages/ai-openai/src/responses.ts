import { aiModelSchema, type AiInput, type AiModel } from '@writehand/contracts';
import { z } from 'zod';

import { AiFailure, providerFailure } from './errors';
import { buildEmailRequest } from './prompt';

const endpoint = 'https://api.openai.com/v1';
const errorBody = z.object({ error: z.object({ code: z.string().optional() }).optional() });
const eventSchema = z.object({
  type: z.string(),
  delta: z.string().optional(),
  code: z.string().optional(),
  response: z.object({ error: z.object({ code: z.string().optional() }).nullable().optional() }).optional(),
});

async function checkResponse(response: Response): Promise<void> {
  if (response.ok) return;
  const body = errorBody.safeParse(await response.json().catch(() => null));
  throw providerFailure(response.status, body.success ? body.data.error?.code : undefined);
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
    async listModels(token: string, mode: 'chatgpt' | 'api-key'): Promise<AiModel[]> {
      const response = await fetcher(`${endpoint}/models`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(20_000),
      });
      await checkResponse(response);
      const raw: unknown = await response.json();
      if (mode === 'chatgpt') {
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
    async generate(input: AiInput, model: string, token: string, signal: AbortSignal) {
      const response = await fetcher(`${endpoint}/responses`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEmailRequest(input, model)),
        signal,
      });
      return readResponseStream(response);
    },
  };
}
