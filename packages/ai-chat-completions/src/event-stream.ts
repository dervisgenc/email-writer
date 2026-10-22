import { ProviderFailure } from './failure';

/** A healthy stream never holds this much without an event boundary. */
const MAX_BUFFERED_CHARACTERS = 1_000_000;

/**
 * Reads a `text/event-stream` body and passes each event's data on until `onData` returns
 * `'stop'` or the stream ends. Comment lines (OpenRouter's keep-alive `: OPENROUTER PROCESSING`)
 * and fields other than `data` are ignored.
 */
export async function readEventStream(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => 'continue' | 'stop',
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const dispatch = (event: string): 'continue' | 'stop' => {
    const data = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    return data ? onData(data) : 'continue';
  };
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer)) !== null) {
        const event = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        if (dispatch(event) === 'stop') return;
      }
      if (buffer.length > MAX_BUFFERED_CHARACTERS) throw new ProviderFailure('AI_RESPONSE_INCOMPLETE');
    }
    buffer += decoder.decode();
    if (buffer.trim()) dispatch(buffer);
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
