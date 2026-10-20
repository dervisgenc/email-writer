import { PROTOCOL_VERSION, type RuntimeRequest } from '@writehand/contracts';

export interface NativePort {
  postMessage(message: unknown): void;
  disconnect(): void;
  onMessage: { addListener(listener: (message: unknown) => void): void };
  onDisconnect: { addListener(listener: () => void): void };
}

/** Generation may take up to two minutes; an update downloads a program of about 50 MB. */
const REQUEST_TIMEOUTS: Partial<Record<RuntimeRequest['type'], number>> = {
  AI_GENERATE: 130_000,
  HOST_UPDATE: 600_000,
};

/** One native process per background, correlated responses, no retries of generation requests. */
export function createNativeClient(connect: () => NativePort) {
  let port: NativePort | null = null;
  const pending = new Map<
    string,
    { finish: (response: unknown) => void; timer: ReturnType<typeof setTimeout> }
  >();
  const failure = (requestId: string, code = 'AI_HOST_UNAVAILABLE') => ({
    protocolVersion: PROTOCOL_VERSION,
    requestId,
    ok: false,
    error: { code },
  });
  const close = () => {
    port = null;
    for (const [id, entry] of pending) {
      clearTimeout(entry.timer);
      entry.finish(failure(id));
    }
    pending.clear();
  };
  const getPort = () => {
    if (port !== null) return port;
    const connection = connect();
    port = connection;
    connection.onMessage.addListener((raw) => {
      if (
        typeof raw !== 'object' ||
        raw === null ||
        !('requestId' in raw) ||
        typeof raw.requestId !== 'string'
      )
        return;
      const entry = pending.get(raw.requestId);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.delete(raw.requestId);
      entry.finish(raw);
    });
    connection.onDisconnect.addListener(() => {
      if (port === connection) close();
    });
    return connection;
  };
  return {
    send(request: RuntimeRequest): Promise<unknown> {
      return new Promise((resolve) => {
        try {
          const connection = getPort();
          const timer = setTimeout(() => {
            pending.delete(request.requestId);
            if (request.type === 'AI_GENERATE') {
              try {
                connection.postMessage({
                  protocolVersion: PROTOCOL_VERSION,
                  requestId: crypto.randomUUID(),
                  type: 'AI_CANCEL',
                  payload: { generationId: request.payload.generationId },
                });
              } catch {
                /* Host may have exited. */
              }
            }
            resolve(failure(request.requestId, 'AI_UNAVAILABLE'));
          }, REQUEST_TIMEOUTS[request.type] ?? 90_000);
          pending.set(request.requestId, { finish: resolve, timer });
          connection.postMessage(request);
        } catch {
          close();
          resolve(failure(request.requestId));
        }
      });
    },
    dispose() {
      port?.disconnect();
      close();
    },
  };
}
