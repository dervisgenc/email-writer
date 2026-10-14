import {
  appError,
  err,
  ok,
  PROTOCOL_VERSION,
  RUNTIME_RESPONSE_PAYLOADS,
  RUNTIME_ROUTES,
  runtimeRequestSchema,
  runtimeResponseEnvelopeSchema,
  type AppError,
  type Result,
  type RuntimeRequest,
  type RuntimeRequestType,
  type RuntimeResponseEnvelope,
  type RuntimeResponsePayload,
} from '@email-writer/contracts';

type RequestOf<T extends RuntimeRequestType> = Extract<RuntimeRequest, { type: T }>;
export type RequestPayload<T extends RuntimeRequestType> = RequestOf<T>['payload'];

/** Tarayıcının verdiği gönderici bilgisi; mesajın iddia ettiği değerler kullanılmaz. */
export interface MessageSender {
  readonly id?: string;
  readonly url?: string;
  readonly tab?: { readonly id?: number };
}

export type RuntimeContext = 'background' | 'content-script';

export function createRequest<T extends RuntimeRequestType>(
  type: T,
  payload: RequestPayload<T>,
  requestId: string,
): RequestOf<T> {
  const request = { protocolVersion: PROTOCOL_VERSION, requestId, type, payload };
  // Şema doğrulandıktan sonra tür, girdinin `type` alanıyla zaten belirlenmiştir.
  return runtimeRequestSchema.parse(request) as RequestOf<T>;
}

/**
 * Bir isteği gönderir ve yanıtın şemasını doğrular. Tarayıcı mesaj kanalı
 * `transport` olarak verilir (runtime veya belirli bir sekme).
 */
export async function sendRequest<T extends RuntimeRequestType>(
  transport: (message: unknown) => Promise<unknown>,
  request: RequestOf<T>,
): Promise<Result<RuntimeResponsePayload<T>, AppError>> {
  let raw: unknown;
  try {
    raw = await transport(request);
  } catch {
    return err(appError('CONTENT_SCRIPT_UNREACHABLE'));
  }
  const envelope = runtimeResponseEnvelopeSchema.safeParse(raw);
  if (!envelope.success || envelope.data.requestId !== request.requestId) {
    return err(appError('MESSAGE_REJECTED'));
  }
  if (!envelope.data.ok) {
    return err(appError(envelope.data.error.code));
  }
  const schema = RUNTIME_RESPONSE_PAYLOADS[request.type];
  const payload = schema.safeParse(envelope.data.payload);
  if (!payload.success) {
    return err(appError('MESSAGE_REJECTED'));
  }
  // Yanıt, isteğin türüne ait şemayla doğrulandı.
  return ok(payload.data as RuntimeResponsePayload<T>);
}

export type RuntimeHandlers = {
  readonly [T in RuntimeRequestType]?: (
    payload: RequestPayload<T>,
    sender: MessageSender,
  ) => Promise<Result<RuntimeResponsePayload<T>, AppError>>;
};

export interface HandlerPolicy {
  readonly context: RuntimeContext;
  /** Gönderenin bu eklentiye ve izin verilen bir ekrana ait olup olmadığı. */
  readonly isAllowedSender: (sender: MessageSender, type: RuntimeRequestType) => boolean;
}

/**
 * Gelen mesajı doğrular, yönlendirme tablosuna ve göndericiye göre süzer.
 * Bu ortama ait olmayan mesajlar için `null` döner; başka dinleyiciler
 * yanıtlayabilir. Bilinmeyen türler ve alanlar reddedilir.
 */
export function createRuntimeHandler(handlers: RuntimeHandlers, policy: HandlerPolicy) {
  return (message: unknown, sender: MessageSender): Promise<RuntimeResponseEnvelope> | null => {
    const parsed = runtimeRequestSchema.safeParse(message);
    if (!parsed.success) {
      return null;
    }
    const request = parsed.data;
    if (RUNTIME_ROUTES[request.type] !== policy.context) {
      return null;
    }
    const base = { protocolVersion: PROTOCOL_VERSION, requestId: request.requestId };
    if (!policy.isAllowedSender(sender, request.type)) {
      return Promise.resolve({ ...base, ok: false, error: { code: 'MESSAGE_REJECTED' } });
    }
    // TypeScript ayrımlı birleşimi tablo erişiminde ilişkilendiremez; yük şemayla doğrulandı.
    const handler = handlers[request.type] as
      ((payload: unknown, sender: MessageSender) => Promise<Result<unknown, AppError>>) | undefined;
    if (handler === undefined) {
      return null;
    }
    return handler(request.payload, sender).then(
      (result): RuntimeResponseEnvelope =>
        result.ok
          ? { ...base, ok: true, payload: result.value }
          : { ...base, ok: false, error: { code: result.error.code } },
      (): RuntimeResponseEnvelope => ({ ...base, ok: false, error: { code: 'UNEXPECTED' } }),
    );
  };
}

/** Chrome ve Firefox'ta çalışan `sendResponse` + `return true` köprüsü. */
export function toMessageListener(handle: ReturnType<typeof createRuntimeHandler>) {
  return (message: unknown, sender: MessageSender, sendResponse: (response: unknown) => void): boolean => {
    const response = handle(message, sender);
    if (response === null) {
      return false;
    }
    void response.then(sendResponse);
    return true;
  };
}
