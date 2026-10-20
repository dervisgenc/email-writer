// A small WebDriver BiDi client: sends commands and dispatches replies and events.
// Used only by test and development tools; it is not part of the extension package.

export async function connectBidi(port) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/session`);
  let nextId = 0;
  const pending = new Map();
  const eventListeners = new Set();

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.type === 'event') {
      for (const listener of eventListeners) {
        listener(message);
      }
      return;
    }
    const waiter = pending.get(message.id);
    if (waiter === undefined) {
      return;
    }
    pending.delete(message.id);
    if (message.type === 'error') {
      waiter.reject(new Error(`${message.error}: ${message.message}`));
    } else {
      waiter.resolve(message.result);
    }
  });
  socket.addEventListener('close', () => {
    for (const waiter of pending.values()) {
      waiter.reject(new Error('BiDi connection closed.'));
    }
    pending.clear();
  });

  await new Promise((done, fail) => {
    socket.addEventListener('open', done, { once: true });
    socket.addEventListener('error', () => fail(new Error(`Could not open a BiDi connection (${port}).`)), {
      once: true,
    });
  });

  return {
    send(method, params = {}) {
      nextId += 1;
      const id = nextId;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    onEvent(listener) {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
    close: () => socket.close(),
  };
}

/**
 * Opens a BiDi session and ends it when `run` finishes, even on error. Firefox
 * does not end the session by itself when the connection drops, and a session
 * left open blocks later connections with "Maximum number of active sessions".
 */
export async function withBidiSession(port, run) {
  const bidi = await connectBidi(port);
  try {
    await bidi.send('session.new', { capabilities: {} });
    return await run(bidi);
  } finally {
    await bidi.send('session.end', {}).catch(() => {});
    bidi.close();
  }
}

/** Unwraps a BiDi `script.evaluate` / `script.callFunction` result to its value; throws on an exception. */
export function unwrapScriptResult(result) {
  if (result.type === 'exception') {
    throw new Error(result.exceptionDetails.text);
  }
  return result.result;
}
