import {
  HOST_RESPONSE_PAYLOADS,
  hostRequestSchema,
  PROTOCOL_VERSION,
  type AiInput,
  type AppError,
  type HelperCommand,
  type HostRequest,
  type HostRequestType,
  type HostResponsePayload,
  type Result,
} from '@writehand/contracts';

import { readResponse } from './runtime-messaging';

type HostRequestOf<T extends HostRequestType> = Extract<HostRequest, { type: T }>;

/** The helper app's requests, validated on the way out and on the way back. */
export function createHelperClient(send: (request: HostRequest) => Promise<unknown>) {
  const request = async <T extends HostRequestType>(
    type: T,
    payload: HostRequestOf<T>['payload'],
  ): Promise<Result<HostResponsePayload<T>, AppError>> => {
    // Once the schema validates, the type is already determined by the input's `type` field.
    const message = hostRequestSchema.parse({
      protocolVersion: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(),
      type,
      payload,
    }) as HostRequestOf<T>;
    // The schema is the one for the request's type, so the payload has that type's response shape.
    return readResponse(await send(message), message.requestId, HOST_RESPONSE_PAYLOADS[type]) as Result<
      HostResponsePayload<T>,
      AppError
    >;
  };
  return {
    status: () => request('AI_STATUS', {}),
    command: (command: HelperCommand) => request('AI_COMMAND', command),
    generate: (generationId: string, input: AiInput) => request('AI_GENERATE', { generationId, input }),
    cancel: (generationId: string) => request('AI_CANCEL', { generationId }),
    info: () => request('HOST_INFO', {}),
    checkUpdate: () => request('HOST_UPDATE_CHECK', {}),
    update: () => request('HOST_UPDATE', {}),
  };
}

export type HelperClient = ReturnType<typeof createHelperClient>;
