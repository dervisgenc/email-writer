import { z } from 'zod';

import { MAX_REFINEMENT_LENGTH, OPERATIONS, TONES, type PreparedAction } from './actions';
import { ERROR_CODES } from './errors';
import { targetLanguageSchema } from './languages';
import { MAX_WRITING_INSTRUCTIONS } from './settings';

export const NATIVE_HOST_NAME = 'com.email_writer.ai';

/** Üretim yöntemi: ChatGPT planı, OpenAI API anahtarı veya bilgisayardaki Claude Code. */
export const AI_MODES = ['chatgpt', 'api-key', 'claude-code'] as const;
export type AiMode = (typeof AI_MODES)[number];
export const CHATGPT_USAGE_URL = 'https://chatgpt.com/settings/usage';
export const OPENAI_API_KEYS_URL = 'https://platform.openai.com/api-keys';
export const CLAUDE_CODE_SETUP_URL = 'https://code.claude.com/docs/en/setup';

/**
 * Çıktı biçimi: `rich` sınırlı Markdown'a (liste, tablo, grafik) izin verir ve
 * taslağa biçimli yazılır; `plain` düz metindir (ör. bir cümlenin içindeki seçim).
 */
export const OUTPUT_FORMATS = ['plain', 'rich'] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

/** Only the selected text crosses the AI boundary; DOM handles and mailbox IDs stay in the page. */
export const aiInputSchema = z
  .object({
    operation: z.enum(OPERATIONS),
    source: z.string().max(20_000),
    instruction: z.string().max(5_000),
    targetLanguage: targetLanguageSchema.nullable(),
    tone: z.enum(TONES),
    /** Kullanıcının ayarlardaki kalıcı yazım tercihi; her üretime eklenir. */
    standingInstructions: z.string().max(MAX_WRITING_INSTRUCTIONS),
    format: z.enum(OUTPUT_FORMATS),
    refinement: z
      .object({
        instruction: z.string().trim().min(1).max(MAX_REFINEMENT_LENGTH),
        previous: z.string().min(1).max(30_000),
      })
      .strict()
      .nullable(),
    messages: z
      .array(
        z
          .object({
            text: z.string().max(40_000),
            sender: z.string().max(500).nullable(),
            subject: z.string().max(1_000).nullable(),
            sentAt: z.string().max(100).nullable(),
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

/** Üretim anında eklenen, işlem kaydında tutulmayan kullanıcı tercihleri. */
export interface AiPreferences {
  readonly standingInstructions: string;
}

/**
 * Sonucun yazılacağı yere göre biçim: cümle içindeki bir seçim ve alınan
 * mesajdan seçim (yalnızca kopyalanır) düz metin ister; taslağın tamamı biçimli olabilir.
 */
export function outputFormatFor(action: PreparedAction): OutputFormat {
  return action.target?.mode === 'replace-selection' || action.source.origin === 'received-message'
    ? 'plain'
    : 'rich';
}

export function toAiInput(action: PreparedAction, preferences: AiPreferences): AiInput {
  return {
    operation: action.operation,
    source: action.source.text,
    instruction: action.instruction,
    targetLanguage: action.targetLanguage,
    tone: action.tone,
    standingInstructions: preferences.standingInstructions.trim().slice(0, MAX_WRITING_INSTRUCTIONS),
    format: outputFormatFor(action),
    refinement: action.refinement,
    messages:
      action.context?.messages.map((message) => ({
        text: message.text,
        sender: message.senderLabel,
        subject: message.subject,
        sentAt: message.sentAtText?.slice(0, 100) ?? null,
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
  z.object({ action: z.literal('set-mode'), mode: z.enum(AI_MODES) }).strict(),
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
    mode: z.enum(AI_MODES),
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
    /** Bilgisayardaki Claude Code'un durumu; yalnızca o yöntem seçiliyken denetlenir. */
    claudeCode: z
      .object({
        installed: z.boolean(),
        loggedIn: z.boolean(),
        /** Claude aboneliğiyle mi (true), API anahtarı veya başka yöntemle mi çalışıyor. */
        subscription: z.boolean(),
        plan: z.string().max(64).nullable(),
        account: z.string().max(320).nullable(),
        organization: z.string().max(256).nullable(),
      })
      .strict()
      .nullable(),
    error: z.enum(ERROR_CODES).nullable(),
  })
  .strict();
export type AiStatus = z.infer<typeof aiStatusSchema>;

/** Safe for the content script: no account identity, credentials or OAuth URL. */
export const aiSummarySchema = aiStatusSchema.pick({ mode: true, ready: true, selectedModel: true });
export type AiSummary = z.infer<typeof aiSummarySchema>;
