import { z } from 'zod';

import { aiInputSchema } from './ai';
import { ERROR_CODES } from './errors';

/**
 * The message envelope shared by the extension's own messages (`runtime-messages.ts`) and by
 * native messaging with the helper app (`host-protocol.ts`). Its version increases only when
 * the envelope format changes; new capabilities are added as new request types. For helper
 * app compatibility, see `host.ts`.
 */
export const PROTOCOL_VERSION = 1 as const;

/** One request type: the envelope, the type name and a strict payload. */
export function requestSchema<Type extends string, Payload extends z.ZodType>(type: Type, payload: Payload) {
  return z
    .object({
      protocolVersion: z.literal(PROTOCOL_VERSION),
      requestId: z.string().min(1).max(64),
      type: z.literal(type),
      payload,
    })
    .strict();
}

export const emptyPayloadSchema = z.object({}).strict();

/** A generation carries only the text the user chose for it. */
export const generationRequestSchema = z
  .object({ generationId: z.string().uuid(), input: aiInputSchema })
  .strict();
export const generationResultSchema = z.object({ text: z.string().min(1).max(30_000) }).strict();
export const cancellationRequestSchema = z.object({ generationId: z.string().uuid() }).strict();
export const cancellationResultSchema = z.object({ cancelled: z.boolean() }).strict();

export const runtimeErrorSchema = z.object({ code: z.enum(ERROR_CODES) }).strict();

const envelope = {
  protocolVersion: z.literal(PROTOCOL_VERSION),
  requestId: z.string().min(1).max(64),
};

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
