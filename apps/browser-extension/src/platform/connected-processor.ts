import {
  appError,
  err,
  ok,
  toAiInput,
  type AiPreferences,
  type TextProcessor,
} from '@email-writer/contracts';

import { createRequest, sendRequest } from './runtime-messaging';

/**
 * Üretimi arka plandaki yerel bağlantıya gönderir. Kalıcı talimat her üretimde
 * ayardan okunur; ayarlar sayfasında yapılan değişiklik açık sekmede de geçerlidir.
 */
export function createConnectedProcessor(
  transport: (message: unknown) => Promise<unknown>,
  readPreferences: () => Promise<AiPreferences>,
): TextProcessor {
  return {
    kind: 'connected',
    async process(action, signal) {
      if (signal.aborted) return err(appError('READ_CANCELLED'));
      const generationId = crypto.randomUUID();
      // AbortSignalLike intentionally has no DOM dependency. Polling also covers session disposal.
      let cancelled = false;
      const cancel = () => {
        if (cancelled || !signal.aborted) return;
        cancelled = true;
        void sendRequest(transport, createRequest('AI_CANCEL', { generationId }, crypto.randomUUID()));
      };
      const timer = setInterval(cancel, 50);
      try {
        const input = toAiInput(action, await readPreferences());
        const result = await sendRequest(
          transport,
          createRequest('AI_GENERATE', { generationId, input }, crypto.randomUUID()),
        );
        if (signal.aborted) return err(appError('READ_CANCELLED'));
        return result.ok
          ? ok({
              requestId: action.requestId,
              sessionId: action.sessionId,
              formRevision: action.formRevision,
              text: result.value.text,
              sample: false,
            })
          : result;
      } catch {
        return err(appError('RESULT_INVALID'));
      } finally {
        cancel();
        clearInterval(timer);
      }
    },
  };
}
