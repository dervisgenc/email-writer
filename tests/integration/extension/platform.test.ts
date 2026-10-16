import { DEFAULT_SETTINGS, PROTOCOL_VERSION } from '@email-writer/contracts';
import { describe, expect, it } from 'vitest';

import {
  createRequest,
  createRuntimeHandler,
  sendRequest,
} from '../../../apps/browser-extension/src/platform/runtime-messaging';
import {
  applySettingsChanges,
  createSettingsStore,
  parseStoredSettings,
  SETTINGS_STORAGE_KEY,
  type SettingsStorageArea,
} from '../../../apps/browser-extension/src/platform/settings-store';

function memoryArea(
  initial: Record<string, unknown> = {},
): SettingsStorageArea & { data: Record<string, unknown> } {
  const data = { ...initial };
  return {
    data,
    get: async (key) => (key in data ? { [key]: data[key] } : {}),
    set: async (items) => {
      Object.assign(data, items);
    },
  };
}

describe('Ayar deposu', () => {
  it('eksik kaydı varsayılanlarla tamamlar', () => {
    expect(parseStoredSettings(undefined)).toEqual({
      settings: DEFAULT_SETTINGS,
      issue: 'missing',
      writable: true,
    });
  });

  it('geçersiz kayıttan geçerli alanları kurtarır; içerik içermeyen sorun kodu döner', () => {
    const result = parseStoredSettings({
      schemaVersion: 1,
      revision: 4,
      uiLanguage: 'en',
      tone: 'bağırarak',
      extra: 'x',
    });
    expect(result.issue).toBe('invalid');
    expect(result.settings).toMatchObject({ uiLanguage: 'en', tone: 'neutral', revision: 4 });
  });

  it('ilk sürüm kaydını ikinci sürüme taşır; seçimleri korur, yeni alanları varsayılanla doldurur', async () => {
    const v1 = {
      schemaVersion: 1,
      revision: 7,
      uiLanguage: 'en',
      targetLanguage: 'de',
      tone: 'formal',
      theme: 'dark',
      siteEnabled: { 'outlook-web': false },
      onboardingSeen: true,
    };
    const area = memoryArea({ [SETTINGS_STORAGE_KEY]: v1 });
    const stored = await createSettingsStore(area).ensureInitialized();

    expect(stored.issue).toBe('migrated');
    expect(stored.settings).toEqual({
      ...v1,
      schemaVersion: 2,
      favoriteLanguages: ['en', 'tr', 'de', 'fr', 'es'],
      writingInstructions: '',
    });
    expect(area.data[SETTINGS_STORAGE_KEY]).toEqual(stored.settings);
  });

  it('kalıcı talimat ve favori diller sınırları aşamaz; elle yazılan dil adı kabul edilir', () => {
    const current = { ...DEFAULT_SETTINGS, revision: 2 };
    expect(
      applySettingsChanges(current, 2, { favoriteLanguages: ['en', 'Kurmancî'] }).settings.favoriteLanguages,
    ).toEqual(['en', 'Kurmancî']);
    expect(() => applySettingsChanges(current, 2, { writingInstructions: 'x'.repeat(1001) })).toThrow();
    expect(() => applySettingsChanges(current, 2, { favoriteLanguages: ['en', 'en'] })).toThrow();
    expect(() => applySettingsChanges(current, 2, { targetLanguage: 'line\nbreak' })).toThrow();
  });

  it('daha yeni şemayla yazılmış kaydı bozmadan korur', async () => {
    const future = { schemaVersion: 3, revision: 9, somethingNew: true };
    const area = memoryArea({ [SETTINGS_STORAGE_KEY]: future });
    const store = createSettingsStore(area);

    expect((await store.patch(9, { tone: 'formal' })).status).toBe('read-only');
    expect(area.data[SETTINGS_STORAGE_KEY]).toBe(future);
  });

  it('eski sürümle gelen değişiklik eski bütün nesneyle üzerine yazmaz', () => {
    const current = { ...DEFAULT_SETTINGS, revision: 5, theme: 'dark' as const };
    const result = applySettingsChanges(current, 3, { tone: 'formal' });

    expect(result.status).toBe('conflict');
    expect(result.settings).toMatchObject({ theme: 'dark', tone: 'formal', revision: 6 });
  });

  it('yazma isteklerini sırayla işler', async () => {
    const area = memoryArea();
    const store = createSettingsStore(area);
    const [first, second] = await Promise.all([
      store.patch(1, { tone: 'formal' }),
      store.patch(1, { theme: 'dark' }),
    ]);

    expect(first.status).toBe('saved');
    expect(second.status).toBe('conflict');
    expect(area.data[SETTINGS_STORAGE_KEY]).toMatchObject({ tone: 'formal', theme: 'dark', revision: 3 });
  });
});

describe('Çalışma ortamları arası mesajlar', () => {
  const pageStatus = {
    providerId: 'outlook-web',
    support: 'ready',
    canOpenPanel: true,
    panelOpen: false,
  } as const;
  const handler = createRuntimeHandler(
    { GET_PAGE_STATUS: async () => ({ ok: true, value: pageStatus }) },
    {
      context: 'content-script',
      isAllowedSender: (sender) => sender.id === 'self' && sender.tab === undefined,
    },
  );

  it('bilinmeyen tür veya fazladan alan içeren mesajı reddeder', () => {
    expect(
      handler(
        { protocolVersion: PROTOCOL_VERSION, requestId: 'r', type: 'WRITE_TEXT', payload: {} },
        { id: 'self' },
      ),
    ).toBeNull();
    expect(
      handler(
        { protocolVersion: PROTOCOL_VERSION, requestId: 'r', type: 'OPEN_PANEL', payload: { text: 'x' } },
        { id: 'self' },
      ),
    ).toBeNull();
  });

  it('başka bir ortama ait mesajı yanıtlamaz', () => {
    expect(handler(createRequest('GET_SETTINGS', {}, 'r1'), { id: 'self' })).toBeNull();
  });

  it('izin verilmeyen göndericiyi reddeder', async () => {
    const response = await handler(createRequest('GET_PAGE_STATUS', {}, 'r2'), {
      id: 'self',
      tab: { id: 4 },
    });
    expect(response).toEqual({
      protocolVersion: 1,
      requestId: 'r2',
      ok: false,
      error: { code: 'MESSAGE_REJECTED' },
    });
  });

  it('yanıtın şemasını ve istek kimliğini doğrular', async () => {
    const request = createRequest('GET_PAGE_STATUS', {}, 'r3');
    const ok = await sendRequest((message) => handler(message, { id: 'self' })!, request);
    expect(ok).toEqual({ ok: true, value: pageStatus });

    const spoofed = await sendRequest(
      async () => ({ protocolVersion: 1, requestId: 'baska', ok: true, payload: pageStatus }),
      request,
    );
    expect(spoofed).toEqual({ ok: false, error: expect.objectContaining({ code: 'MESSAGE_REJECTED' }) });

    const unreachable = await sendRequest(async () => {
      throw new Error('Could not establish connection');
    }, request);
    expect(unreachable).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'CONTENT_SCRIPT_UNREACHABLE' }),
    });
  });
});
