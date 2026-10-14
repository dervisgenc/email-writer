import { opaqueHash, type IdentityRegistry } from '../identity/identity-registry';
import { queryAll, queryFirst, URL_ITEM_ID } from './selectors';

export interface LocatedThread {
  readonly root: HTMLElement;
  readonly key: string;
  /** Kimliğin nereden geldiği; `local` yalnızca mevcut DOM örneği boyunca geçerlidir. */
  readonly keySource: 'conversation-id' | 'url' | 'local';
}

/** Okuma bölmesindeki gövdeler; iç içe eşleşmelerde en içteki (en belirgin) eleman tutulur. */
export function messageBodies(root: ParentNode): HTMLElement[] {
  const all = queryAll(root, 'messageBody');
  return all.filter((element) => !all.some((other) => other !== element && element.contains(other)));
}

/**
 * Okuma bölmesindeki konuşmayı ve kimliğini bulur. Mesaj gövdelerini okumaz.
 * Konu başlığı kimlik olarak kullanılmaz; güvenilir bir sayfa kimliği yoksa
 * yalnızca DOM örneği boyunca geçerli yerel kimlik üretilir.
 */
export function locateThread(document: Document, registry: IdentityRegistry): LocatedThread | null {
  const root = queryFirst(document, 'readingPane');
  if (root === null) {
    return null;
  }
  const bodies = messageBodies(root);
  const collapsed = queryAll(root, 'collapsedMessage');
  if (bodies.length === 0 && collapsed.length === 0) {
    return null;
  }

  const selectedRow = queryFirst(document, 'selectedConversation');
  const conversationId = selectedRow?.getAttribute('data-convid') ?? (selectedRow?.id || null);
  if (conversationId) {
    return { root, key: `conv-${opaqueHash(conversationId)}`, keySource: 'conversation-id' };
  }
  const urlId = URL_ITEM_ID.exec(document.location?.pathname ?? '')?.[1];
  if (urlId !== undefined) {
    return { root, key: `url-${opaqueHash(decodeURIComponent(urlId))}`, keySource: 'url' };
  }
  const firstMessage = bodies[0] ?? collapsed[0];
  return firstMessage === undefined
    ? null
    : { root, key: registry.keyFor(firstMessage, 'thread-local'), keySource: 'local' };
}
