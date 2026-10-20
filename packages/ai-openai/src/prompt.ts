import { buildTaskPrompt, type AiInput } from '@writehand/contracts';

/** Mail is data, never a developer instruction. No tools or executable output are requested. */
export function buildEmailRequest(input: AiInput, model: string) {
  const prompt = buildTaskPrompt(input);
  return {
    model,
    store: false,
    stream: true,
    instructions: prompt.system,
    input: [{ role: 'user' as const, content: prompt.user }],
  };
}
