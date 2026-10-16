import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createClaudeCodeProvider } from '@email-writer/ai-claude-code';
import { createOpenAiOAuth, createOpenAiProvider, failureCode } from '@email-writer/ai-openai';
import { PROTOCOL_VERSION, runtimeRequestSchema } from '@email-writer/contracts';

import { createAiService } from './ai-service';
import { createCredentialStore } from './credential-store';
import { encodeNativeMessage, NativeMessageDecoder } from './native-protocol';

// Native hosts write ONLY framed protocol messages to stdout, never logs or email content.
const service = createAiService({
  store: createCredentialStore(join(homedir(), '.config', 'email-writer')),
  oauth: createOpenAiOAuth(),
  provider: createOpenAiProvider(),
  claude: createClaudeCodeProvider({ env: process.env }),
  openBrowser: (url) =>
    new Promise<void>((resolve, reject) => {
      const child = spawn(process.platform === 'darwin' ? '/usr/bin/open' : 'xdg-open', [url], {
        stdio: 'ignore',
      });
      child.once('error', () => reject(new Error('Browser could not open.')));
      child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error('Browser could not open.'))));
    }),
});

let inFlight = 0;
async function handle(raw: unknown): Promise<void> {
  const parsed = runtimeRequestSchema.safeParse(raw);
  if (!parsed.success) return;
  const request = parsed.data;
  const base = { protocolVersion: PROTOCOL_VERSION, requestId: request.requestId };
  if (inFlight >= 32) {
    process.stdout.write(encodeNativeMessage({ ...base, ok: false, error: { code: 'AI_BUSY' } }));
    return;
  }
  inFlight++;
  try {
    let payload: unknown;
    switch (request.type) {
      case 'AI_STATUS':
        payload = await service.status();
        break;
      case 'AI_COMMAND':
        payload = await service.command(request.payload);
        break;
      case 'AI_GENERATE':
        payload = await service.generate(request.payload.generationId, request.payload.input);
        break;
      case 'AI_CANCEL':
        payload = service.cancel(request.payload.generationId);
        break;
      default:
        return;
    }
    process.stdout.write(encodeNativeMessage({ ...base, ok: true, payload }));
  } catch (caught) {
    process.stdout.write(encodeNativeMessage({ ...base, ok: false, error: { code: failureCode(caught) } }));
  } finally {
    inFlight--;
  }
}

const decoder = new NativeMessageDecoder();
decoder.on('data', (message: unknown) => {
  void handle(message);
});
const shutdown = () => {
  service.dispose();
  process.exit(0);
};
decoder.on('error', shutdown);
process.stdin.on('end', shutdown);
process.stdin.on('error', shutdown);
process.stdout.on('error', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.stdin.pipe(decoder);
