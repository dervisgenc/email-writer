import { z } from 'zod';

import { OPERATIONS, TONES, type PreparedAction } from './actions';
import { ERROR_CODES } from './errors';
import { LANGUAGE_CODES } from './languages';

export const NATIVE_HOST_NAME = 'com.email_writer.ai';
export const CHATGPT_USAGE_URL = 'https://chatgpt.com/settings/usage';

/** Only the selected text crosses the AI boundary; DOM handles and mailbox IDs stay in the page. */
export const aiInputSchema = z
  .object({
    operation: z.enum(OPERATIONS),
    source: z.string().max(20_000),
    instruction: z.string().max(5_000),
    targetLanguage: z.enum(LANGUAGE_CODES).nullable(),
    tone: z.enum(TONES),
    messages: z
      .array(
        z
          .object({
            text: z.string().max(40_000),
            sender: z.string().max(500).nullable(),
            subject: z.string().max(1_000).nullable(),
            replyTarget: z.boolean(),
          })
          .strict(),
      )
      .max(40),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.messages.reduce((total, message) => total + message.text.length, 0) > 80_000) {
      ctx.addIssue({ code: 'custom', message: 'Context exceeds the transport limit.' });
    }
    if ((value.operation === 'revise' || value.operation === 'translate') && !value.source.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Source required.' });
    }
    if ((value.operation === 'reply' || value.operation === 'compose') && !value.instruction.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Instruction required.' });
    }
    if (value.operation === 'translate' && value.targetLanguage === null) {
      ctx.addIssue({ code: 'custom', message: 'Target language required.' });
    }
    if (value.operation === 'reply' && !value.messages.some((message) => message.replyTarget)) {
      ctx.addIssue({ code: 'custom', message: 'Reply target required.' });
    }
  });
export type AiInput = z.infer<typeof aiInputSchema>;

export function toAiInput(action: PreparedAction): AiInput {
  return {
    operation: action.operation,
    source: action.source.text,
    instruction: action.instruction,
    targetLanguage: action.targetLanguage,
    tone: action.tone,
    messages:
      action.context?.messages.map((message) => ({
        text: message.text,
        sender: message.senderLabel,
        subject: message.subject,
        replyTarget: message.messageKey === action.context?.activeMessageKey,
      })) ?? [],
  };
}

const id = z.string().min(1).max(256);
export const aiAccountLabelSchema = z.string().trim().min(1).max(80);
export const aiCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('connect'), accountId: id.nullable() }).strict(),
  z.object({ action: z.literal('cancel-sign-in') }).strict(),
  z.object({ action: z.literal('select-account'), accountId: id }).strict(),
  z.object({ action: z.literal('disconnect'), accountId: id }).strict(),
  z.object({ action: z.literal('remove-account'), accountId: id }).strict(),
  z.object({ action: z.literal('rename-account'), accountId: id, label: aiAccountLabelSchema }).strict(),
  z.object({ action: z.literal('set-model'), model: id }).strict(),
  z.object({ action: z.literal('set-mode'), mode: z.enum(['chatgpt', 'api-key']) }).strict(),
  z.object({ action: z.literal('save-api-key'), apiKey: z.string().min(10).max(512) }).strict(),
  z.object({ action: z.literal('clear-api-key') }).strict(),
  z.object({ action: z.literal('refresh-models') }).strict(),
  z.object({ action: z.literal('acknowledge-plan') }).strict(),
]);
export type AiCommand = z.infer<typeof aiCommandSchema>;
export const aiModelSchema = z.object({ id, label: z.string().min(1).max(256) }).strict();
export type AiModel = z.infer<typeof aiModelSchema>;
export const aiStatusSchema = z
  .object({
    mode: z.enum(['chatgpt', 'api-key']),
    accounts: z
      .array(
        z
          .object({
            id,
            label: z.string().max(256),
            email: z.string().max(320).nullable(),
            verified: z.boolean(),
            connected: z.boolean(),
            planEnabled: z.boolean(),
          })
          .strict(),
      )
      .max(100),
    activeAccountId: id.nullable(),
    apiKeyConfigured: z.boolean(),
    models: z.array(aiModelSchema).max(500),
    selectedModel: id.nullable(),
    ready: z.boolean(),
    signingIn: z.boolean(),
    needsPlanAcknowledgement: z.boolean(),
    error: z.enum(ERROR_CODES).nullable(),
  })
  .strict();
export type AiStatus = z.infer<typeof aiStatusSchema>;

/** Safe for the content script: no account identity, credentials or OAuth URL. */
export const aiSummarySchema = aiStatusSchema.pick({ mode: true, ready: true, selectedModel: true });
export type AiSummary = z.infer<typeof aiSummarySchema>;
