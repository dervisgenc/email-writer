import { z } from 'zod';

import { MAX_REFINEMENT_LENGTH, OPERATIONS, TONES, type PreparedAction } from './actions';
import { API_PROVIDERS } from './api-providers';
import { ERROR_CODES } from './errors';
import { targetLanguageSchema } from './languages';
import { MAX_WRITING_INSTRUCTIONS } from './settings';

/**
 * Generation method: a ChatGPT plan, the user's own API key or Claude Code on the user's
 * computer. The API key method runs in the extension itself; the other two need the helper app.
 */
export const AI_MODES = ['chatgpt', 'api-key', 'claude-code'] as const;
export type AiMode = (typeof AI_MODES)[number];
/** Methods the helper app runs. */
export const HELPER_AI_MODES = ['chatgpt', 'claude-code'] as const;
export type HelperAiMode = (typeof HELPER_AI_MODES)[number];
export function isHelperMode(mode: AiMode): mode is HelperAiMode {
  return (HELPER_AI_MODES as readonly AiMode[]).includes(mode);
}
export const CHATGPT_USAGE_URL = 'https://chatgpt.com/settings/usage';
export const CLAUDE_CODE_SETUP_URL = 'https://code.claude.com/docs/en/setup';

/**
 * Output format: `rich` allows a limited Markdown subset (lists, tables, charts) and is
 * written to the draft formatted; `plain` is plain text (e.g. a selection inside a sentence).
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
    /** The user's standing writing preference from settings; added to every generation. */
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

/** User preferences added at generation time and not kept in the action record. */
export interface AiPreferences {
  readonly standingInstructions: string;
}

/**
 * Format by destination: a selection inside a sentence and a selection from a received
 * message (copy only) need plain text; the whole draft may be formatted.
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
/** An API key becomes an HTTP header value: printable ASCII without spaces. */
export const apiKeySchema = z
  .string()
  .min(10)
  .max(512)
  .regex(/^[\x21-\x7e]+$/);

/** Account and model commands, shared by the settings pages and the helper app. */
const accountAndModelCommands = [
  z.object({ action: z.literal('connect'), accountId: id.nullable() }).strict(),
  z.object({ action: z.literal('cancel-sign-in') }).strict(),
  z.object({ action: z.literal('select-account'), accountId: id }).strict(),
  z.object({ action: z.literal('disconnect'), accountId: id }).strict(),
  z.object({ action: z.literal('remove-account'), accountId: id }).strict(),
  z.object({ action: z.literal('rename-account'), accountId: id, label: aiAccountLabelSchema }).strict(),
  z.object({ action: z.literal('set-model'), model: id }).strict(),
  z.object({ action: z.literal('refresh-models') }).strict(),
  z.object({ action: z.literal('acknowledge-plan') }).strict(),
] as const;

/** Commands the background forwards to the helper app over native messaging. */
export const helperCommandSchema = z.discriminatedUnion('action', [
  ...accountAndModelCommands,
  z.object({ action: z.literal('set-mode'), mode: z.enum(HELPER_AI_MODES) }).strict(),
]);
export type HelperCommand = z.infer<typeof helperCommandSchema>;

/**
 * Commands from the extension's own pages. The background handles the method choice and the
 * API key commands itself and forwards the rest to the helper app; model commands apply to
 * the chosen method.
 */
export const aiCommandSchema = z.discriminatedUnion('action', [
  ...accountAndModelCommands,
  z.object({ action: z.literal('set-mode'), mode: z.enum(AI_MODES) }).strict(),
  z.object({ action: z.literal('select-api-provider'), provider: z.enum(API_PROVIDERS) }).strict(),
  z
    .object({ action: z.literal('save-api-key'), provider: z.enum(API_PROVIDERS), apiKey: apiKeySchema })
    .strict(),
  z.object({ action: z.literal('remove-api-key'), provider: z.enum(API_PROVIDERS) }).strict(),
]);
export type AiCommand = z.infer<typeof aiCommandSchema>;

export const aiModelSchema = z
  .object({
    id,
    label: z.string().min(1).max(256),
    /** Free to use, as the provider states it (OpenRouter's free variants). Absent when unknown. */
    free: z.boolean().optional(),
  })
  .strict();
export type AiModel = z.infer<typeof aiModelSchema>;

/** The helper app's methods as the helper app reports them. Never contains credentials. */
export const helperStatusSchema = z
  .object({
    /** Helper app 0.1.0 may still report its retired `api-key` method. */
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
    /** Reported only by helper app 0.1.0, which kept an OpenAI API key itself. */
    apiKeyConfigured: z.boolean().optional(),
    models: z.array(aiModelSchema).max(500),
    selectedModel: id.nullable(),
    ready: z.boolean(),
    signingIn: z.boolean(),
    needsPlanAcknowledgement: z.boolean(),
    /** State of Claude Code on the user's computer; checked only while that method is selected. */
    claudeCode: z
      .object({
        installed: z.boolean(),
        loggedIn: z.boolean(),
        /** Whether it runs on a Claude subscription (true) or with an API key or another method. */
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
export type HelperStatus = z.infer<typeof helperStatusSchema>;

/**
 * The extension's own API key connection. Keys never leave the background; the status only
 * says which providers have one.
 */
export const apiKeyStatusSchema = z
  .object({
    provider: z.enum(API_PROVIDERS),
    savedKeys: z.array(z.enum(API_PROVIDERS)).max(API_PROVIDERS.length),
    /** Whether the browser lets the extension reach the selected provider (optional host permission). */
    access: z.boolean(),
    /** The selected provider's models; empty until they are loaded with its key. */
    models: z.array(aiModelSchema).max(1_000),
    selectedModel: id.nullable(),
  })
  .strict();
export type ApiKeyStatus = z.infer<typeof apiKeyStatusSchema>;

/** The AI connection as the extension's pages see it: the chosen method and both ways to reach a model. */
export const aiStatusSchema = z
  .object({
    mode: z.enum(AI_MODES),
    ready: z.boolean(),
    /** What keeps the chosen method from generating, if anything. */
    error: z.enum(ERROR_CODES).nullable(),
    /** The helper app's state; null while the helper app cannot be reached. */
    helper: helperStatusSchema.nullable(),
    apiKey: apiKeyStatusSchema,
  })
  .strict();
export type AiStatus = z.infer<typeof aiStatusSchema>;

/** Safe for the content script: no account identity, credentials or OAuth URL. */
export const aiSummarySchema = z.union([
  z
    .object({
      mode: z.literal('api-key'),
      ready: z.boolean(),
      selectedModel: id.nullable(),
      provider: z.enum(API_PROVIDERS),
    })
    .strict(),
  z.object({ mode: z.enum(HELPER_AI_MODES), ready: z.boolean(), selectedModel: id.nullable() }).strict(),
]);
export type AiSummary = z.infer<typeof aiSummarySchema>;
