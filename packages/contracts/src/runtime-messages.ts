import { z } from 'zod';

import { ERROR_CODES } from './errors';
import { aiCommandSchema, aiInputSchema, aiStatusSchema, aiSummarySchema } from './ai';
import { settingsChangesSchema, settingsSchema } from './settings';

/**
 * Ortamlar arası şema doğrulamalı mesajlar. AI_GENERATE yalnızca kullanıcının
 * üretim için seçtiği metni taşır. Hesap yönetimi eklenti sayfalarıyla sınırlı;
 * OPEN_PANEL ve OPEN_OPTIONS doğrudan yazma veya üretim başlatamaz.
 */
export const PROTOCOL_VERSION = 1 as const;

const envelope = {
  protocolVersion: z.literal(PROTOCOL_VERSION),
  requestId: z.string().min(1).max(64),
};

const emptyPayload = z.object({}).strict();

export const runtimeRequestSchema = z.discriminatedUnion('type', [
  z.object({ ...envelope, type: z.literal('AI_STATUS'), payload: emptyPayload }).strict(),
  z.object({ ...envelope, type: z.literal('AI_SUMMARY'), payload: emptyPayload }).strict(),
  z.object({ ...envelope, type: z.literal('AI_COMMAND'), payload: aiCommandSchema }).strict(),
  z
    .object({
      ...envelope,
      type: z.literal('AI_GENERATE'),
      payload: z.object({ generationId: z.string().uuid(), input: aiInputSchema }).strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal('AI_CANCEL'),
      payload: z.object({ generationId: z.string().uuid() }).strict(),
    })
    .strict(),
  z.object({ ...envelope, type: z.literal('OPEN_OPTIONS'), payload: emptyPayload }).strict(),
  z.object({ ...envelope, type: z.literal('GET_PAGE_STATUS'), payload: emptyPayload }).strict(),
  z.object({ ...envelope, type: z.literal('OPEN_PANEL'), payload: emptyPayload }).strict(),
  z.object({ ...envelope, type: z.literal('GET_SELECTOR_REPORT'), payload: emptyPayload }).strict(),
  z.object({ ...envelope, type: z.literal('GET_SETTINGS'), payload: emptyPayload }).strict(),
  z
    .object({
      ...envelope,
      type: z.literal('PATCH_SETTINGS'),
      payload: z
        .object({
          expectedRevision: z.number().int().positive(),
          changes: settingsChangesSchema,
        })
        .strict(),
    })
    .strict(),
]);

export type RuntimeRequest = z.infer<typeof runtimeRequestSchema>;
export type RuntimeRequestType = RuntimeRequest['type'];

/** Hangi mesajın hangi ortama gönderilebileceği. Alıcı bu tabloya göre reddeder. */
export const RUNTIME_ROUTES = {
  AI_STATUS: 'background',
  AI_SUMMARY: 'background',
  AI_COMMAND: 'background',
  AI_GENERATE: 'background',
  AI_CANCEL: 'background',
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

/** Seçici doğrulaması için içeriksiz tanı: yalnızca anahtar, durum ve eşleşme sayısı. */
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
 * `conflict`: kayıt bu sırada başka bir ekranda değişmişti; yalnızca istenen
 * alanlar güncel kayda uygulandı. `read-only`: daha yeni bir şemayla yazılmış
 * kayıt korunuyor, üzerine yazılmadı.
 */
export const patchSettingsResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('saved'), settings: settingsSchema }).strict(),
  z.object({ status: z.literal('conflict'), settings: settingsSchema }).strict(),
  z.object({ status: z.literal('read-only'), settings: settingsSchema }).strict(),
]);

/** Her istek türünün yanıt şeması. */
export const RUNTIME_RESPONSE_PAYLOADS = {
  AI_STATUS: aiStatusSchema,
  AI_SUMMARY: aiSummarySchema,
  AI_COMMAND: aiStatusSchema,
  AI_GENERATE: z.object({ text: z.string().min(1).max(30_000) }).strict(),
  AI_CANCEL: z.object({ cancelled: z.boolean() }).strict(),
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

export const runtimeErrorSchema = z.object({ code: z.enum(ERROR_CODES) }).strict();

export const runtimeResponseEnvelopeSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ...envelope,
      ok: z.literal(true),
      payload: z.unknown(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      ok: z.literal(false),
      error: runtimeErrorSchema,
    })
    .strict(),
]);

export type RuntimeResponseEnvelope = z.infer<typeof runtimeResponseEnvelopeSchema>;
