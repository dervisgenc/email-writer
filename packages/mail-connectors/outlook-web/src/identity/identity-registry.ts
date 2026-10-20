import type { MailScope } from '@writehand/contracts';

export const OUTLOOK_PROVIDER_ID = 'outlook-web';

/**
 * Derives a local, opaque id from an account hint (e.g. the account button's
 * accessible name). The raw value is never stored or exposed; the id only tells
 * account switches apart within the same page instance.
 */
export function opaqueHash(value: string): string {
  // 32-bit FNV-1a: not cryptographic, only for telling values apart locally.
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
   * On a new, different account hint, switches the scope, invalidates the old
   * element keys and returns `true`. A hint that is temporarily unreadable
   * (`null`) does not change the scope.
   */
  updateAccountHint(hint: string | null): boolean;
  /**
   * Gives a DOM element a local key that is valid only while that element lives.
   * A recreated element gets a new key.
   */
  keyFor(element: Element, prefix: string): string;
  /** Returns the element a key was given to; `null` once it is no longer connected. */
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
