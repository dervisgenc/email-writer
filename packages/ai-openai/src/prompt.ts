import { AI_TASK_INSTRUCTIONS, type AiInput } from '@email-writer/contracts';

/** Mail is data, never a developer instruction. No tools or executable output are requested. */
export function buildEmailRequest(input: AiInput, model: string) {
  return {
    model,
    store: false,
    stream: true,
    instructions: AI_TASK_INSTRUCTIONS,
    input: [{ role: 'user' as const, content: JSON.stringify(input) }],
  };
}
