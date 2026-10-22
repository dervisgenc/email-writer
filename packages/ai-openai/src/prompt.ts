import { buildTaskPrompt, type AiInput } from '@writehand/contracts';

/**
 * Mail is data, never a developer instruction. No tools or executable output are requested.
 * The user message is sent as content parts, the form both the public API and ChatGPT's Codex
 * backend accept.
 */
export function buildEmailRequest(input: AiInput, model: string) {
  const prompt = buildTaskPrompt(input);
  return {
    model,
    store: false,
    stream: true,
    instructions: prompt.system,
    input: [{ role: 'user' as const, content: [{ type: 'input_text' as const, text: prompt.user }] }],
  };
}
