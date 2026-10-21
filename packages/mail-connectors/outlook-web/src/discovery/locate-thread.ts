import { opaqueHash, type IdentityRegistry } from '../identity/identity-registry';
import { closest, CONVERSATION_SUBJECT_ID, queryAll, queryFirst, URL_ITEM_ID } from './selectors';

export interface LocatedThread {
  readonly root: HTMLElement;
  readonly key: string;
  /** Where the key came from; `local` is valid only for the current DOM instance. */
  readonly keySource: 'conversation-id' | 'url' | 'local';
  /**
   * The reading pane shows this conversation's reply draft instead of a message
   * ("Reply" turns the pane into an editor in the selected-message view). The
   * message body is not on the page; the replied-to message and subject were
   * recorded while the message was shown.
   */
  readonly replyView?: {
    readonly replyingTo: string | null;
    readonly subject: string | null;
    /** A quote-only fallback when the original message was not observed before the draft opened. */
    readonly quoteEditor?: HTMLElement;
  };
}

/** Bodies in the reading pane; for nested matches the innermost (most specific) element is kept. */
export function messageBodies(root: ParentNode): HTMLElement[] {
  const all = queryAll(root, 'messageBody').filter((body) => closest(body, 'composeEditor') === null);
  return all.filter((element) => !all.some((other) => other !== element && element.contains(other)));
}

/** Token of the conversation shown in the reading pane, read from the subject heading's id. */
function readingPaneConversationId(root: HTMLElement): string | null {
  const heading = queryFirst(root, 'subject');
  return heading === null ? null : (CONVERSATION_SUBJECT_ID.exec(heading.id)?.[1] ?? null);
}

/** Conversation id of the selected row in the message list; scrolling can remove the row from the DOM. */
export function selectedRowConversationId(document: Document): string | null {
  const row = queryFirst(document, 'selectedConversation');
  return row?.getAttribute('data-convid') ?? (row?.id || null);
}

/**
 * Finds the conversation in the reading pane and its key, without reading the
 * message bodies. The key comes, in order, from the reading pane's conversation
 * token, the selected list row or the URL. The subject text is never used as a
 * key; without a reliable page id, a local key valid only for the DOM instance is
 * created.
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
