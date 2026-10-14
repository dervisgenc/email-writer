import { z } from 'zod';

import { ERROR_CODES } from './errors';
import { settingsChangesSchema, settingsV1Schema } from './settings';

/**
 * Yalnızca eklenti ortamları arasında gerçekten geçmesi gereken küçük mesajlar.
 * E-posta ve önizleme içeriği bu protokole dahil değildir; `OPEN_PANEL`
 * doğrudan yazma işlemi yapamaz.
 */
export const PROTOCOL_VERSION = 1 as const;

const envelope = {
  protocolVersion: z.literal(PROTOCOL_VERSION),
  requestId: z.string().min(1).max(64),
};

const emptyPayload = z.object({}).strict();

export const runtimeRequestSchema = z.discriminatedUnion('type', [
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

export const settingsResultSchema = z.object({ settings: settingsV1Schema }).strict();

/**
 * `conflict`: kayıt bu sırada başka bir ekranda değişmişti; yalnızca istenen
 * alanlar güncel kayda uygulandı. `read-only`: daha yeni bir şemayla yazılmış
 * kayıt korunuyor, üzerine yazılmadı.
 */
export const patchSettingsResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('saved'), settings: settingsV1Schema }).strict(),
  z.object({ status: z.literal('conflict'), settings: settingsV1Schema }).strict(),
  z.object({ status: z.literal('read-only'), settings: settingsV1Schema }).strict(),
]);

/** Her istek türünün yanıt şeması. */
export const RUNTIME_RESPONSE_PAYLOADS = {
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
