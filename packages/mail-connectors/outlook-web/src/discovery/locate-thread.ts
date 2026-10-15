import { opaqueHash, type IdentityRegistry } from '../identity/identity-registry';
import { CONVERSATION_SUBJECT_ID, queryAll, queryFirst, URL_ITEM_ID } from './selectors';

export interface LocatedThread {
  readonly root: HTMLElement;
  readonly key: string;
  /** Kimliğin nereden geldiği; `local` yalnızca mevcut DOM örneği boyunca geçerlidir. */
  readonly keySource: 'conversation-id' | 'url' | 'local';
  /**
   * Okuma bölmesi mesaj yerine bu konuşmanın yanıt taslağını gösteriyor
   * (seçili mesaj görünümünde "Yanıtla" bölmeyi editöre çevirir). Mesaj
   * gövdesi sayfada yoktur; yanıtlanan mesaj ve konu, mesaj gösterilirken kaydedilir.
   */
  readonly replyView?: { readonly replyingTo: string | null; readonly subject: string | null };
}

/** Okuma bölmesindeki gövdeler; iç içe eşleşmelerde en içteki (en belirgin) eleman tutulur. */
export function messageBodies(root: ParentNode): HTMLElement[] {
  const all = queryAll(root, 'messageBody');
  return all.filter((element) => !all.some((other) => other !== element && element.contains(other)));
}

/** Okuma bölmesinin gösterdiği konuşmanın belirteci; konu başlığının kimliğinden okunur. */
function readingPaneConversationId(root: HTMLElement): string | null {
  const heading = queryFirst(root, 'subject');
  return heading === null ? null : (CONVERSATION_SUBJECT_ID.exec(heading.id)?.[1] ?? null);
}

/** İleti listesindeki seçili satırın konuşma kimliği; satır kaydırmayla DOM'dan çıkabilir. */
export function selectedRowConversationId(document: Document): string | null {
  const row = queryFirst(document, 'selectedConversation');
  return row?.getAttribute('data-convid') ?? (row?.id || null);
}

/**
 * Okuma bölmesindeki konuşmayı ve kimliğini bulur. Mesaj gövdelerini okumaz.
 * Kimlik sırasıyla okuma bölmesindeki konuşma belirtecinden, seçili liste
 * satırından veya URL'den gelir. Konu metni kimlik olarak kullanılmaz; güvenilir
 * bir sayfa kimliği yoksa yalnızca DOM örneği boyunca geçerli yerel kimlik üretilir.
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

  const conversationId = readingPaneConversationId(root) ?? selectedRowConversationId(document);
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
