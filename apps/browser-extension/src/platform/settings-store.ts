import {
  DEFAULT_SETTINGS,
  SETTINGS_SCHEMA_VERSION,
  settingsChangesSchema,
  settingsSchema,
  settingsV1Schema,
  type Settings,
  type SettingsChanges,
} from '@email-writer/contracts';

export const SETTINGS_STORAGE_KEY = 'settings';

/** Tarayıcı depolamasının ayar deposunun ihtiyaç duyduğu dar kısmı. */
export interface SettingsStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export type StoredSettingsIssue = 'missing' | 'invalid' | 'migrated' | 'newer-schema' | null;

export interface StoredSettings {
  readonly settings: Settings;
  readonly issue: StoredSettingsIssue;
  /** Daha yeni bir şemayla yazılmış kayıt bozulmadan korunur; üzerine yazılmaz. */
  readonly writable: boolean;
}

export type PatchSettingsResult =
  | { readonly status: 'saved'; readonly settings: Settings }
  /** Kayıt bu sırada değişmişti: güncel kayda yalnızca istenen alanlar uygulandı. */
  | { readonly status: 'conflict'; readonly settings: Settings }
  | { readonly status: 'read-only'; readonly settings: Settings };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Geçersiz kayıttan geçerli alanları kurtarır, eksikleri varsayılanlarla tamamlar. */
function salvage(raw: Record<string, unknown>): Settings {
  const recovered: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(settingsChangesSchema.shape)) {
    if (raw[key] !== undefined && field.safeParse(raw[key]).success) {
      recovered[key] = raw[key];
    }
  }
  const revision =
    typeof raw.revision === 'number' && Number.isInteger(raw.revision) && raw.revision > 0
      ? raw.revision
      : DEFAULT_SETTINGS.revision;
  const parsed = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...recovered, revision });
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

/**
 * Depodaki kaydı okur ve doğrular. Geçersiz kayıt güvenli varsayılanlarla ele
 * alınır; içerik taşımayan bir sorun kodu döner. Bütün depolama silinmez.
 */
export function parseStoredSettings(raw: unknown): StoredSettings {
  if (raw === undefined) {
    return { settings: DEFAULT_SETTINGS, issue: 'missing', writable: true };
  }
  if (!isRecord(raw)) {
    return { settings: DEFAULT_SETTINGS, issue: 'invalid', writable: true };
  }
  if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > SETTINGS_SCHEMA_VERSION) {
    return { settings: DEFAULT_SETTINGS, issue: 'newer-schema', writable: false };
  }
  const parsed = settingsSchema.safeParse(raw);
  if (parsed.success) {
    return { settings: parsed.data, issue: null, writable: true };
  }
  if (settingsV1Schema.safeParse(raw).success) {
    // İlk sürümün bütün alanları ikinci sürümde de geçerlidir; yeni alanlar varsayılanla gelir.
    return { settings: salvage(raw), issue: 'migrated', writable: true };
  }
  return { settings: salvage(raw), issue: 'invalid', writable: true };
}

/**
 * Değişiklikleri güncel kayda alan düzeyinde uygular. İstemcinin bildiği sürüm
 * eskiyse eski bütün nesneyle üzerine yazılmaz; yalnızca istenen alanlar
 * güncel kayda uygulanır ve durum `conflict` olarak bildirilir.
 */
export function applySettingsChanges(
  current: Settings,
  expectedRevision: number,
  changes: SettingsChanges,
): PatchSettingsResult {
  const next = settingsSchema.parse({
    ...current,
    ...changes,
    revision: current.revision + 1,
  });
  return { status: expectedRevision === current.revision ? 'saved' : 'conflict', settings: next };
}

export interface SettingsStore {
  read(): Promise<StoredSettings>;
  /** Yazma istekleri sıralı işlenir; başarı ancak depolama tamamlanınca döner. */
  patch(expectedRevision: number, changes: SettingsChanges): Promise<PatchSettingsResult>;
  /** Kurulumda eksik veya bozuk kaydı varsayılanlarla onarır. */
  ensureInitialized(): Promise<StoredSettings>;
}

export function createSettingsStore(area: SettingsStorageArea): SettingsStore {
  let queue: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  const read = async (): Promise<StoredSettings> => {
    const items = await area.get(SETTINGS_STORAGE_KEY);
    return parseStoredSettings(items[SETTINGS_STORAGE_KEY]);
  };

  return {
    read,

    patch(expectedRevision, changes) {
      return enqueue(async () => {
        const stored = await read();
        if (!stored.writable) {
          return { status: 'read-only', settings: stored.settings };
        }
        const result = applySettingsChanges(stored.settings, expectedRevision, changes);
        await area.set({ [SETTINGS_STORAGE_KEY]: result.settings });
        return result;
      });
    },

    ensureInitialized() {
      return enqueue(async () => {
        const stored = await read();
        if (stored.writable && stored.issue !== null) {
          await area.set({ [SETTINGS_STORAGE_KEY]: stored.settings });
        }
        return stored;
      });
    },
  };
}
