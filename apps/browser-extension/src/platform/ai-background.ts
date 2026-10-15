import { appError, err, ok, type RuntimeRequest, type RuntimeRequestType } from '@email-writer/contracts';

import { createRequest, sendRequest, type RequestPayload, type RuntimeHandlers } from './runtime-messaging';

export function createAiHandlers(options: {
  sendNative: (request: RuntimeRequest) => Promise<unknown>;
  openOptions: () => Promise<void>;
}): RuntimeHandlers {
  const owners = new Map<string, string>();
  const native = <T extends RuntimeRequestType>(type: T, payload: RequestPayload<T>) =>
    sendRequest(
      (raw) => options.sendNative(raw as RuntimeRequest),
      createRequest(type, payload, crypto.randomUUID()),
    );
  return {
    AI_STATUS: () => native('AI_STATUS', {}),
    AI_COMMAND: (command) => native('AI_COMMAND', command),
    AI_SUMMARY: async () => {
      const result = await native('AI_STATUS', {});
      return result.ok
        ? ok({
            mode: result.value.mode,
            ready: result.value.ready,
            selectedModel: result.value.selectedModel,
          })
        : result;
    },
    AI_GENERATE: async (payload, sender) => {
      if (owners.has(payload.generationId)) return err(appError('MESSAGE_REJECTED'));
      owners.set(payload.generationId, `${sender.tab?.id}:${sender.url}`);
      try {
        return await native('AI_GENERATE', payload);
      } finally {
        owners.delete(payload.generationId);
      }
    },
    AI_CANCEL: (payload, sender) => {
      if (owners.get(payload.generationId) !== `${sender.tab?.id}:${sender.url}`)
        return Promise.resolve(ok({ cancelled: false }));
      return native('AI_CANCEL', payload);
    },
    OPEN_OPTIONS: async () => {
      await options.openOptions();
      return ok({ opened: true });
    },
  };
}
