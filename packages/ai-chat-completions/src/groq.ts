import type { AiModel } from '@writehand/contracts';
import { z } from 'zod';

import { createChatCompletionsProvider, firstAvailable, type Fetcher } from './chat-completions';

export const GROQ_API_URL = 'https://api.groq.com/openai/v1';

/**
 * OpenAI's open-weight models, which Groq's free plan covers within its rate limits. The
 * larger one writes better; it is selected when the user connects a key.
 */
export const GROQ_FREE_MODELS: readonly string[] = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];

/**
 * Speech, safety classifier and compound models cannot draft email; compound models also run
 * web searches with the prompt, which would send email text to a search engine.
 */
const NOT_FOR_WRITING = /whisper|tts|orpheus|guard|compound/i;

const catalogSchema = z.object({
  data: z.array(z.object({ id: z.string().min(1).max(256), active: z.boolean().optional() })),
});

export function parseGroqModels(raw: unknown): AiModel[] {
  return catalogSchema
    .parse(raw)
    .data.filter((model) => model.active !== false && !NOT_FOR_WRITING.test(model.id))
    .map((model) => ({ id: model.id, label: model.id }))
    .sort((left, right) => left.label.localeCompare(right.label))
    .slice(0, 1_000);
}

export function createGroqProvider(fetcher?: Fetcher) {
  return createChatCompletionsProvider(
    {
      baseUrl: GROQ_API_URL,
      parseModels: parseGroqModels,
      defaultModel: (models) => firstAvailable(models, GROQ_FREE_MODELS),
    },
    fetcher,
  );
}
