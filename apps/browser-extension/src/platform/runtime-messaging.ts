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
} from '@writehand/contracts';

type RequestOf<T extends RuntimeRequestType> = Extract<RuntimeRequest, { type: T }>;
export type RequestPayload<T extends RuntimeRequestType> = RequestOf<T>['payload'];

/** Sender info supplied by the browser; values claimed by the message itself are never used. */
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
  // Once the schema validates, the type is already determined by the input's `type` field.
  return runtimeRequestSchema.parse(request) as RequestOf<T>;
}

/**
 * Sends a request and validates the response schema. The browser message channel
 * is passed as `transport` (runtime or a specific tab).
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
  // The response was validated against the schema for the request's type.
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
  /** Whether the sender belongs to this extension and to an allowed screen. */
  readonly isAllowedSender: (sender: MessageSender, type: RuntimeRequestType) => boolean;
}

/**
 * Validates an incoming message and filters it by the routing table and sender.
 * Returns `null` for messages that do not belong to this context so other listeners
 * can respond. Unknown types and fields are rejected.
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
    // TypeScript cannot correlate the union through the table lookup; the payload is schema-validated.
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

/** `sendResponse` + `return true` bridge that works in both Chrome and Firefox. */
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
