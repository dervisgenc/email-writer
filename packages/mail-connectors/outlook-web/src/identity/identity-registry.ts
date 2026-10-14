import type { MailScope } from '@email-writer/contracts';

export const OUTLOOK_PROVIDER_ID = 'outlook-web';

/**
 * Hesap ipucundan (ör. hesap düğmesinin erişilebilir adı) yerel ve opak bir
 * kimlik üretir. Ham değer saklanmaz veya dışarı verilmez; yalnızca aynı sayfa
 * örneğinde hesap değişimini ayırt etmek için kullanılır.
 */
export function opaqueHash(value: string): string {
  // FNV-1a 32 bit: kriptografik değildir, yalnızca yerel ayrım içindir.
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export interface IdentityRegistry {
  readonly documentInstanceId: string;
  scope(): MailScope;
  /**
   * Yeni ve farklı bir hesap ipucu görülürse kapsamı değiştirir, eski eleman
   * kimliklerini geçersiz kılar ve `true` döner. Geçici olarak okunamayan ipucu
   * (`null`) kapsamı değiştirmez.
   */
  updateAccountHint(hint: string | null): boolean;
  /**
   * Bir DOM elemanına yalnızca o eleman yaşadığı sürece geçerli yerel kimlik
   * verir. Eleman yeniden oluşturulursa yeni kimlik alır.
   */
  keyFor(element: Element, prefix: string): string;
  /** Daha önce kimlik verilmiş elemanı döndürür; artık bağlı değilse `null`. */
  elementFor(key: string): Element | null;
  clear(): void;
}

export function createIdentityRegistry(createId: () => string): IdentityRegistry {
  const documentInstanceId = createId();
  let accountScopeId = 'unknown';
  let keys = new WeakMap<Element, string>();
  let elements = new Map<string, WeakRef<Element>>();

  return {
    documentInstanceId,

    scope() {
      return { providerId: OUTLOOK_PROVIDER_ID, accountScopeId, documentInstanceId };
    },

    updateAccountHint(hint) {
      const normalized = hint?.trim() ?? '';
      if (normalized === '') {
        return false;
      }
      const next = `acct-${opaqueHash(normalized)}`;
      if (next === accountScopeId) {
        return false;
      }
      accountScopeId = next;
      keys = new WeakMap();
      elements = new Map();
      return true;
    },

    keyFor(element, prefix) {
      const existing = keys.get(element);
      if (existing !== undefined) {
        return existing;
      }
      const key = `${prefix}-${createId()}`;
      keys.set(element, key);
      elements.set(key, new WeakRef(element));
      return key;
    },

    elementFor(key) {
      const element = elements.get(key)?.deref() ?? null;
      if (element === null || !element.isConnected) {
        elements.delete(key);
        return null;
      }
      return element;
    },

    clear() {
      keys = new WeakMap();
      elements = new Map();
    },
  };
}
