import { appError, err, ok, type AiInput, type AppError, type Result } from '@writehand/contracts';

import { failureCode } from './errors';
import { createOpenAiProvider } from './responses';

async function settle<T>(work: () => Promise<T>): Promise<Result<T, AppError>> {
  try {
    return ok(await work());
  } catch (caught) {
    const code = failureCode(caught);
    // For an API key, a refused session means that OpenAI refused the key.
    return err(appError(code === 'AI_NOT_CONNECTED' ? 'AI_KEY_INVALID' : code));
  }
}

/**
 * The user's OpenAI API key, used by the browser extension itself through the Responses API.
 * This entry point (`@writehand/ai-openai/api-key`) and its imports contain no Node.js or OAuth
 * code, so it runs in the extension's background.
 */
export function createOpenAiApiKeyProvider(fetcher: typeof fetch = fetch) {
  const provider = createOpenAiProvider(fetcher);
  return {
    listModels: (apiKey: string) => settle(() => provider.listModels(apiKey, 'api-key')),
    // Pay as you go: the user always chooses the model.
    defaultModel: (): string | null => null,
    generate: (input: AiInput, model: string, apiKey: string, signal: AbortSignal) =>
      settle(() => provider.generate(input, model, apiKey, signal)),
  };
}
