import {
  PROTOCOL_VERSION,
  type AiInput,
  type PreparedAction,
  type RuntimeRequest,
} from '@email-writer/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAiHandlers } from '../../../apps/browser-extension/src/platform/ai-background';
import { createAiSenderPolicy } from '../../../apps/browser-extension/src/platform/ai-sender-policy';
import { createConnectedProcessor } from '../../../apps/browser-extension/src/platform/connected-processor';
import {
  createNativeClient,
  type NativePort,
} from '../../../apps/browser-extension/src/platform/native-client';
import { createRequest } from '../../../apps/browser-extension/src/platform/runtime-messaging';

afterEach(() => vi.useRealTimers());

const action: PreparedAction = {
  requestId: 'action',
  sessionId: 'session',
  formRevision: 4,
  operation: 'revise',
  source: { origin: 'draft', text: 'Fix me' },
  instruction: '',
  targetLanguage: null,
  tone: 'neutral',
  context: null,
  target: null,
  refinement: null,
  createdAt: '2026-10-15T00:00:00Z',
};

describe('AI message boundaries', () => {
  it('blocks mailbox scripts from account management and blocks unsupported senders from generation', () => {
    const policy = createAiSenderPolicy({
      extensionId: 'ours',
      isOwnPage: (sender) => sender.id === 'ours' && sender.url === 'chrome-extension://ours/options.html',
      isMailUrl: (url) => url.startsWith('https://outlook.live.com/'),
    });
    const mail = { id: 'ours', tab: { id: 1 }, url: 'https://outlook.live.com/mail/' };
    expect(policy(mail, 'AI_GENERATE')).toBe(true);
    expect(policy(mail, 'AI_SUMMARY')).toBe(true);
    expect(policy(mail, 'OPEN_OPTIONS')).toBe(true);
    expect(policy(mail, 'AI_STATUS')).toBe(false);
    expect(policy(mail, 'AI_COMMAND')).toBe(false);
    for (const type of ['HOST_INFO', 'HOST_UPDATE_CHECK', 'HOST_UPDATE'] as const)
      expect(policy(mail, type)).toBe(false);
    expect(policy({ ...mail, id: 'other' }, 'AI_GENERATE')).toBe(false);
    expect(policy({ ...mail, url: 'https://evil.test/' }, 'AI_GENERATE')).toBe(false);
    const options = { id: 'ours', tab: { id: 2 }, url: 'chrome-extension://ours/options.html' };
    expect(policy(options, 'AI_COMMAND')).toBe(true);
    expect(policy(options, 'HOST_INFO')).toBe(true);
    expect(policy(options, 'HOST_UPDATE')).toBe(true);
  });

  it('restricts cancellation to the tab that started a generation', async () => {
    let finish!: (value: unknown) => void;
    const sendNative = vi
      .fn<(request: RuntimeRequest) => Promise<unknown>>()
      .mockImplementation((request) => {
        if (request.type === 'AI_GENERATE')
          return new Promise((resolve) => {
            finish = (payload) =>
              resolve({ protocolVersion: PROTOCOL_VERSION, requestId: request.requestId, ok: true, payload });
          });
        return Promise.resolve({
          protocolVersion: PROTOCOL_VERSION,
          requestId: request.requestId,
          ok: true,
          payload: { cancelled: true },
        });
      });
    const handlers = createAiHandlers({ sendNative, openOptions: vi.fn() });
    const owner = { tab: { id: 1 }, url: 'https://outlook.live.com/mail/' };
    const generationId = crypto.randomUUID();
    const result = handlers.AI_GENERATE!(
      {
        generationId,
        input: {
          operation: 'revise',
          source: 'text',
          instruction: '',
          tone: 'neutral',
          targetLanguage: null,
          standingInstructions: '',
          format: 'rich',
          refinement: null,
          messages: [],
        },
      },
      owner,
    );
    expect(await handlers.AI_CANCEL!({ generationId }, { ...owner, tab: { id: 2 } })).toEqual({
      ok: true,
      value: { cancelled: false },
    });
    expect(await handlers.AI_CANCEL!({ generationId }, owner)).toEqual({
      ok: true,
      value: { cancelled: true },
    });
    finish({ text: 'Complete' });
    await result;
  });

  it('correlates real results with the local action and sends only selected text', async () => {
    const transport = vi.fn<(message: unknown) => Promise<unknown>>().mockImplementation(async (raw) => {
      const request = raw as RuntimeRequest;
      expect(request.type).toBe('AI_GENERATE');
      expect(request.payload).not.toHaveProperty('target');
      expect(request.payload).not.toHaveProperty('sessionId');
      return {
        protocolVersion: PROTOCOL_VERSION,
        requestId: request.requestId,
        ok: true,
        payload: { text: 'Fixed' },
      };
    });
    expect(
      await createConnectedProcessor(transport, async () => ({ standingInstructions: '' })).process(action, {
        aborted: false,
      }),
    ).toEqual({
      ok: true,
      value: { requestId: 'action', sessionId: 'session', formRevision: 4, text: 'Fixed', sample: false },
    });
  });

  it('adds the standing instructions read at generation time and picks the output format from the target', async () => {
    const inputs: AiInput[] = [];
    const transport = vi.fn<(message: unknown) => Promise<unknown>>().mockImplementation(async (raw) => {
      const request = raw as RuntimeRequest & { payload: { input: AiInput } };
      inputs.push(request.payload.input);
      return {
        protocolVersion: PROTOCOL_VERSION,
        requestId: request.requestId,
        ok: true,
        payload: { text: 'x' },
      };
    });
    let instructions = 'Kurumsal yaz.';
    const processor = createConnectedProcessor(transport, async () => ({
      standingInstructions: instructions,
    }));
    const composerRef = {
      scope: { providerId: 'p', accountScopeId: 'a', documentInstanceId: 'd' },
      composerKey: 'c',
      threadKey: null,
    };

    await processor.process(
      { ...action, target: { mode: 'replace-body', composerRef, expectedRevision: 1 } },
      { aborted: false },
    );
    instructions = 'Kısa yaz.';
    await processor.process(
      {
        ...action,
        target: { mode: 'replace-selection', composerRef, expectedRevision: 1, selectionId: 's' },
      },
      { aborted: false },
    );

    expect(inputs.map((input) => [input.standingInstructions, input.format])).toEqual([
      ['Kurumsal yaz.', 'rich'],
      ['Kısa yaz.', 'plain'],
    ]);
  });

  it('cancels requests on conversation changes and drops late results', async () => {
    vi.useFakeTimers();
    const abort = new AbortController();
    let finish!: () => void;
    const transport = vi.fn<(raw: unknown) => Promise<unknown>>().mockImplementation((raw) => {
      const request = raw as RuntimeRequest;
      if (request.type === 'AI_CANCEL')
        return Promise.resolve({
          protocolVersion: PROTOCOL_VERSION,
          requestId: request.requestId,
          ok: true,
          payload: { cancelled: true },
        });
      return new Promise((resolve) => {
        finish = () =>
          resolve({
            protocolVersion: PROTOCOL_VERSION,
            requestId: request.requestId,
            ok: true,
            payload: { text: 'Late result' },
          });
      });
    });
    const pending = createConnectedProcessor(transport, async () => ({ standingInstructions: '' })).process(
      action,
      abort.signal,
    );
    abort.abort();
    await vi.advanceTimersByTimeAsync(50);
    finish();
    expect(await pending).toEqual({ ok: false, error: { code: 'READ_CANCELLED' } });
    expect(transport.mock.calls.map(([raw]) => (raw as RuntimeRequest).type)).toEqual([
      'AI_GENERATE',
      'AI_CANCEL',
    ]);
  });
});

describe('Native client', () => {
  function port() {
    let receive!: (message: unknown) => void;
    let disconnect!: () => void;
    const native: NativePort = {
      postMessage: vi.fn(),
      disconnect: () => disconnect(),
      onMessage: {
        addListener: (listener) => {
          receive = listener;
        },
      },
      onDisconnect: {
        addListener: (listener) => {
          disconnect = listener;
        },
      },
    };
    return { native, receive: (message: unknown) => receive(message), disconnect: () => disconnect() };
  }
  it('correlates out-of-order responses through one native port', async () => {
    const fake = port();
    const connect = vi.fn(() => fake.native);
    const client = createNativeClient(connect);
    const first = client.send(createRequest('AI_STATUS', {}, 'one'));
    const second = client.send(createRequest('AI_STATUS', {}, 'two'));
    fake.receive({ requestId: 'two', value: 2 });
    fake.receive({ requestId: 'one', value: 1 });
    expect(await first).toEqual({ requestId: 'one', value: 1 });
    expect(await second).toEqual({ requestId: 'two', value: 2 });
    expect(connect).toHaveBeenCalledOnce();
    client.dispose();
  });
  it('fails all pending requests when the host exits and reconnects on the next explicit request', async () => {
    const fake = port();
    const connect = vi.fn(() => fake.native);
    const client = createNativeClient(connect);
    const first = client.send(createRequest('AI_STATUS', {}, 'one'));
    fake.disconnect();
    expect(await first).toMatchObject({ ok: false, error: { code: 'AI_HOST_UNAVAILABLE' } });
    const next = client.send(createRequest('AI_STATUS', {}, 'two'));
    fake.receive({ requestId: 'two' });
    await next;
    expect(connect).toHaveBeenCalledTimes(2);
    client.dispose();
  });
});
