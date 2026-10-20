import { endianness } from 'node:os';
import { Transform, type TransformCallback } from 'node:stream';

const MAX_BYTES = 900_000;
const littleEndian = endianness() === 'LE';

/**
 * The reply to an unrecognized request. When the request id is readable, the extension
 * does not wait long: most likely the extension and the helper app are different versions.
 */
export function rejectionFor(raw: unknown, protocolVersion: number): object | null {
  if (typeof raw !== 'object' || raw === null || !('requestId' in raw)) return null;
  const { requestId } = raw;
  if (typeof requestId !== 'string' || requestId.length === 0 || requestId.length > 64) return null;
  return { protocolVersion, requestId, ok: false, error: { code: 'AI_VERSION_MISMATCH' } };
}

export function encodeNativeMessage(value: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(value), 'utf8');
  if (json.length > MAX_BYTES) throw new Error('Native message too large.');
  const header = Buffer.alloc(4);
  if (littleEndian) header.writeUInt32LE(json.length);
  else header.writeUInt32BE(json.length);
  return Buffer.concat([header, json]);
}

export class NativeMessageDecoder extends Transform {
  private buffer = Buffer.alloc(0);
  constructor() {
    super({ readableObjectMode: true });
  }
  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    try {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      while (this.buffer.length >= 4) {
        const length = littleEndian ? this.buffer.readUInt32LE(0) : this.buffer.readUInt32BE(0);
        if (length === 0 || length > MAX_BYTES) throw new Error('Invalid native message length.');
        if (this.buffer.length < length + 4) break;
        const message: unknown = JSON.parse(this.buffer.subarray(4, length + 4).toString('utf8'));
        this.buffer = this.buffer.subarray(length + 4);
        // Null is a stream sentinel, so invalid non-object messages are rejected here.
        if (message === null || typeof message !== 'object' || Array.isArray(message))
          throw new Error('Invalid native message.');
        this.push(message);
      }
      callback();
    } catch {
      callback(new Error('Invalid native message.'));
    }
  }
}
