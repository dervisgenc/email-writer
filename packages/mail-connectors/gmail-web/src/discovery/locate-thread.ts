import { innermostElements, isRenderedElement, opaqueHash, type IdentityRegistry } from '@writehand/mail-dom';

import { closest, MISSING_ID_VALUES, queryAll, THREAD_ID_ATTRIBUTES } from './selectors';

export interface LocatedThread {
  /** The open conversation: its subject, its messages and its inline reply. */
  readonly root: HTMLElement;
  /** Where the conversation's "Draft reply" button is placed: the full-width subject row. */
  readonly anchor: HTMLElement;
  readonly key: string;
  /** Where the key came from; `local` is valid only for the current DOM instance. */
  readonly keySource: 'thread-id' | 'url' | 'local';
}

/** Gmail's own icon buttons at the end of the subject row, which the conversation's button must not cover. */
export function subjectRowActions(thread: LocatedThread): HTMLElement[] {
  return queryAll(thread.anchor, 'subjectRowActions').filter(isRenderedElement);
}

/** Expanded message bodies, outside draft editors; for nested matches the innermost is kept. */
export function messageBodies(root: ParentNode): HTMLElement[] {
  return innermostElements(
    queryAll(root, 'messageBody').filter((body) => closest(body, 'composeEditor') === null),
  );
}

/** Collapsed messages whose text is not on the page (the count Gmail shows for a hidden group is not read). */
export function collapsedMessages(root: ParentNode): number {
  return queryAll(root, 'collapsedMessage').filter((row) => queryAll(row, 'messageBody').length === 0).length;
}

/** Message count, collapsed count and body text length; detects changes without reading the thread. */
export function threadSignature(thread: LocatedThread): string {
  const bodies = messageBodies(thread.root);
  const length = bodies.reduce((total, body) => total + (body.textContent?.length ?? 0), 0);
  return `${bodies.length}:${collapsedMessages(thread.root)}:${length}`;
}

/**
 * The key of a conversation with Gmail's id. The open conversation and a reply opened from the
 * message list get the same key when they name the same conversation.
 */
export function threadKeyForId(id: string): string {
  return `thread-${opaqueHash(id)}`;
}

/** Gmail's id of the conversation, from the subject heading. */
function threadId(subject: HTMLElement): string | null {
  for (const attribute of THREAD_ID_ATTRIBUTES) {
    const value = subject.getAttribute(attribute)?.trim() ?? '';
    if (!MISSING_ID_VALUES.includes(value)) {
      return value;
    }
  }
  return null;
}

/** The conversation token at the end of the URL hash (`#inbox/<token>`, `#label/x/<token>`). */
function urlThreadToken(document: Document): string | null {
  const hash = decodeURIComponent(document.location?.hash ?? '');
  const token = /\/([A-Za-z0-9_-]{16,})$/.exec(hash)?.[1];
  return token ?? null;
}

/**
 * Finds the open conversation and its key without reading the message bodies. Gmail keeps
 * views it is not showing in the DOM, hidden, so only a rendered subject counts. The key comes,
 * in order, from Gmail's conversation id on the subject heading or the token in the URL; the
 * subject text is never used as a key. Without either, a local key valid only for this DOM
 * instance is created.
 */
export function locateThread(document: Document, registry: IdentityRegistry): LocatedThread | null {
  const subject = queryAll(document, 'threadSubject').find(isRenderedElement);
  if (subject === undefined) {
    return null;
  }
  const root = closest(subject, 'threadView');
  if (root === null || (messageBodies(root).length === 0 && collapsedMessages(root) === 0)) {
    return null;
  }
  const anchor = closest(subject, 'subjectRow') ?? subject.parentElement ?? subject;
  const id = threadId(subject);
  if (id !== null) {
    return { root, anchor, key: threadKeyForId(id), keySource: 'thread-id' };
  }
  const token = urlThreadToken(document);
  if (token !== null) {
    return { root, anchor, key: `url-${opaqueHash(token)}`, keySource: 'url' };
  }
  return { root, anchor, key: registry.keyFor(subject, 'thread-local'), keySource: 'local' };
}
