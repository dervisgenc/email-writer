import { z } from 'zod';

import { aiCommandSchema, aiStatusSchema, aiSummarySchema } from './ai';
import { hostInfoSchema, hostUpdateCheckSchema, hostUpdateResultSchema } from './host';
import {
  cancellationRequestSchema,
  cancellationResultSchema,
  emptyPayloadSchema,
  generationRequestSchema,
  generationResultSchema,
  requestSchema,
} from './protocol';
import { settingsChangesSchema, settingsSchema } from './settings';

/**
 * Schema-validated messages between the extension's runtime contexts. AI_GENERATE carries
 * only the text the user chose for generation. Connection management (AI_COMMAND, HOST_*) is
 * limited to extension pages; OPEN_PANEL and OPEN_OPTIONS cannot write or start a generation
 * directly. The background answers AI_* requests itself, with the user's API key or through
 * the helper app (`host-protocol.ts`), and forwards HOST_* requests to the helper app.
 */
export const runtimeRequestSchema = z.discriminatedUnion('type', [
  requestSchema('AI_STATUS', emptyPayloadSchema),
  requestSchema('AI_SUMMARY', emptyPayloadSchema),
  requestSchema('AI_COMMAND', aiCommandSchema),
  requestSchema('AI_GENERATE', generationRequestSchema),
  requestSchema('AI_CANCEL', cancellationRequestSchema),
  requestSchema('HOST_INFO', emptyPayloadSchema),
  requestSchema('HOST_UPDATE_CHECK', emptyPayloadSchema),
  requestSchema('HOST_UPDATE', emptyPayloadSchema),
  requestSchema('OPEN_OPTIONS', emptyPayloadSchema),
  requestSchema('GET_PAGE_STATUS', emptyPayloadSchema),
  requestSchema('OPEN_PANEL', emptyPayloadSchema),
  requestSchema('GET_SELECTOR_REPORT', emptyPayloadSchema),
  requestSchema('GET_SETTINGS', emptyPayloadSchema),
  requestSchema(
    'PATCH_SETTINGS',
    z
      .object({
        expectedRevision: z.number().int().positive(),
        changes: settingsChangesSchema,
      })
      .strict(),
  ),
]);

export type RuntimeRequest = z.infer<typeof runtimeRequestSchema>;
export type RuntimeRequestType = RuntimeRequest['type'];

/** Which message may be sent to which context. The receiver rejects anything else based on this table. */
export const RUNTIME_ROUTES = {
  AI_STATUS: 'background',
  AI_SUMMARY: 'background',
  AI_COMMAND: 'background',
  AI_GENERATE: 'background',
  AI_CANCEL: 'background',
  HOST_INFO: 'background',
  HOST_UPDATE_CHECK: 'background',
  HOST_UPDATE: 'background',
  OPEN_OPTIONS: 'background',
  GET_PAGE_STATUS: 'content-script',
  OPEN_PANEL: 'content-script',
  GET_SELECTOR_REPORT: 'content-script',
  GET_SETTINGS: 'background',
  PATCH_SETTINGS: 'background',
} as const satisfies Record<RuntimeRequestType, 'content-script' | 'background'>;

export const pageStatusSchema = z
  .object({
    providerId: z.string().min(1).max(64),
    support: z.enum(['waiting', 'ready', 'unsupported', 'disabled']),
    canOpenPanel: z.boolean(),
    panelOpen: z.boolean(),
  })
  .strict();

export type PageStatus = z.infer<typeof pageStatusSchema>;

export const openPanelResultSchema = z.object({ opened: z.boolean() }).strict();

/** Content-free diagnostics for selector verification: only key, status and match count. */
export const selectorReportSchema = z
  .object({
    entries: z
      .array(
        z
          .object({
            key: z.string().min(1).max(64),
            status: z.enum(['candidate', 'verified']),
            matches: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(64),
  })
  .strict();

export type SelectorReport = z.infer<typeof selectorReportSchema>;

export const settingsResultSchema = z.object({ settings: settingsSchema }).strict();

/**
 * `conflict`: the record had changed in another view in the meantime; only the requested
 * fields were applied to the current record. `read-only`: a record written with a newer
 * schema is kept and was not overwritten.
 */
export const patchSettingsResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('saved'), settings: settingsSchema }).strict(),
  z.object({ status: z.literal('conflict'), settings: settingsSchema }).strict(),
  z.object({ status: z.literal('read-only'), settings: settingsSchema }).strict(),
]);

/** Response schema for each request type. */
export const RUNTIME_RESPONSE_PAYLOADS = {
  AI_STATUS: aiStatusSchema,
  AI_SUMMARY: aiSummarySchema,
  AI_COMMAND: aiStatusSchema,
  AI_GENERATE: generationResultSchema,
  AI_CANCEL: cancellationResultSchema,
  HOST_INFO: hostInfoSchema,
  HOST_UPDATE_CHECK: hostUpdateCheckSchema,
  HOST_UPDATE: hostUpdateResultSchema,
  OPEN_OPTIONS: z.object({ opened: z.boolean() }).strict(),
  GET_PAGE_STATUS: pageStatusSchema,
  OPEN_PANEL: openPanelResultSchema,
  GET_SELECTOR_REPORT: selectorReportSchema,
  GET_SETTINGS: settingsResultSchema,
  PATCH_SETTINGS: patchSettingsResultSchema,
} as const satisfies Record<RuntimeRequestType, z.ZodType>;

export type RuntimeResponsePayload<T extends RuntimeRequestType> = z.infer<
  (typeof RUNTIME_RESPONSE_PAYLOADS)[T]
>;
