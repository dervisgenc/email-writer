import type { AiModel } from '@writehand/contracts';
import { z } from 'zod';

import { createChatCompletionsProvider, firstAvailable, type Fetcher } from './chat-completions';

export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

/** Free variants of OpenAI's open-weight models; one is selected when the user connects a key. */
export const OPENROUTER_FREE_MODELS: readonly string[] = [
  'openai/gpt-oss-120b:free',
  'openai/gpt-oss-20b:free',
];

/** Prices are per-token strings such as "0.0000003"; "-1" marks a router with variable pricing. */
const price = z.union([z.string(), z.number()]).transform(Number);
const entrySchema = z.object({
  id: z.string().min(1).max(256),
  name: z.string().min(1).optional(),
  pricing: z.object({ prompt: price, completion: price }),
  architecture: z
    .object({
      input_modalities: z.array(z.string()).optional(),
      output_modalities: z.array(z.string()).optional(),
    })
    .optional(),
});
type Entry = z.infer<typeof entrySchema>;

const writesText = ({ architecture }: Entry) =>
  (architecture?.input_modalities?.includes('text') ?? true) &&
  (architecture?.output_modalities?.includes('text') ?? true);

const knownPrice = ({ pricing }: Entry) =>
  [pricing.prompt, pricing.completion].every((value) => Number.isFinite(value) && value >= 0);

/**
 * Text models with a known price, free ones first. Entries in an unexpected format are skipped
 * rather than failing the whole list, which holds several hundred models.
 */
export function parseOpenRouterModels(raw: unknown): AiModel[] {
  const { data } = z.object({ data: z.array(z.unknown()) }).parse(raw);
  const models: AiModel[] = [];
  for (const item of data) {
    const entry = entrySchema.safeParse(item);
    if (!entry.success || !writesText(entry.data) || !knownPrice(entry.data)) continue;
    const { id, name, pricing } = entry.data;
    models.push({
      id,
      label: (name ?? id).slice(0, 256),
      free: id.endsWith(':free') || (pricing.prompt === 0 && pricing.completion === 0),
    });
  }
  return models
    .sort((left, right) => Number(right.free) - Number(left.free) || left.label.localeCompare(right.label))
    .slice(0, 1_000);
}

export function createOpenRouterProvider(fetcher?: Fetcher) {
  return createChatCompletionsProvider(
    {
      baseUrl: OPENROUTER_API_URL,
      parseModels: parseOpenRouterModels,
      // The model list is public, so the key is checked on its own.
      keyCheckPath: '/key',
      defaultModel: (models) => firstAvailable(models, OPENROUTER_FREE_MODELS),
    },
    fetcher,
  );
}
