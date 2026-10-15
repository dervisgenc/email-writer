// Küçük WebDriver BiDi istemcisi: komut gönderir, yanıtı ve olayları dağıtır.
// Yalnızca test ve geliştirme araçlarında kullanılır; eklenti paketine girmez.

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
      waiter.reject(new Error('BiDi bağlantısı kapandı.'));
    }
    pending.clear();
  });

  await new Promise((done, fail) => {
    socket.addEventListener('open', done, { once: true });
    socket.addEventListener('error', () => fail(new Error(`BiDi bağlantısı kurulamadı (${port}).`)), {
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
 * BiDi oturumu açar ve `run` bittiğinde, hata olsa bile kapatır. Firefox,
 * bağlantı koptuğunda oturumu kendiliğinden kapatmıyor; açık kalan oturum
 * sonraki bağlantıları "Maximum number of active sessions" hatasıyla engeller.
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

/** Bir BiDi `script.evaluate` / `script.callFunction` sonucunu değerine çevirir; hata fırlatır. */
export function unwrapScriptResult(result) {
  if (result.type === 'exception') {
    throw new Error(result.exceptionDetails.text);
  }
  return result.result;
}
