import { messageBodies } from '../discovery/locate-thread';
import { MESSAGE_HEADER_PART_ID, queryAll, queryFirstOutside } from '../discovery/selectors';
import { opaqueHash, type IdentityRegistry } from '../identity/identity-registry';

const MAX_LABEL_LENGTH = 200;

export interface MessageHeader {
  readonly senderLabel: string | null;
  /** Displayed date text; not parsed because it depends on language and locale. */
  readonly sentAtText: string | null;
}

/** Collapses the visible text to one line; `null` if empty. */
export function labelText(element: Element | null): string | null {
  const text = element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return text === '' ? null : text.slice(0, MAX_LABEL_LENGTH);
}

/**
 * Extracts the display name from sender text (`Jane Doe <jane.doe@example.com>`).
 * The address is not kept: bracketed and bare addresses are dropped, and if no
 * name is left the name counts as unknown.
 */
export function senderDisplayName(text: string): string | null {
  const name = text
    .replace(/<[^<>]*@[^<>]*>/g, ' ')
    .replace(/\S+@\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return name === '' ? null : name.slice(0, MAX_LABEL_LENGTH);
}

/** Distinct item ids of the message header parts inside the element. */
function headerItemIds(element: Element): Set<string> {
  const itemIds = new Set<string>();
  for (const part of queryAll(element, 'messageHeaderPart')) {
    const itemId = MESSAGE_HEADER_PART_ID.exec(part.id)?.[1];
    if (itemId !== undefined) {
      itemIds.add(itemId);
    }
  }
  return itemIds;
}

/**
 * A message's container: the smallest ancestor holding both the body and the
 * header of the same message. The walk up stops at a second body or another
 * message's header; otherwise a neighboring message's sender could be assigned
 * to this one. Without a header, the body's parent is used and the sender and
 * date count as unknown.
 */
export function messageContainerOf(body: HTMLElement, threadRoot: Element): HTMLElement {
  for (
    let element = body.parentElement;
    element !== null && threadRoot.contains(element);
    element = element.parentElement
  ) {
    if (messageBodies(element).length > 1) {
      break;
    }
    const itemIds = headerItemIds(element);
    if (itemIds.size > 1) {
      break;
    }
    if (itemIds.size === 1) {
      return element;
    }
  }
  return body.parentElement ?? body;
}

/**
 * The message's key. If Outlook's item id is visible in the header, an opaque
 * hash of it is used, so when the user switches to another message and back the
 * same message gets the same key and is not counted twice in the context.
 * Otherwise the key is valid only for the lifetime of this DOM element.
 */
export function messageKeyOf(container: HTMLElement, registry: IdentityRegistry): string {
  const itemIds = headerItemIds(container);
  const [itemId] = itemIds;
  return itemIds.size === 1 && itemId !== undefined
    ? `msg-${opaqueHash(itemId)}`
    : registry.keyFor(container, 'msg');
}

/**
 * The sender and displayed date are looked up only in the header, i.e. outside
 * the body: the email HTML may contain similar ids or addresses.
 */
export function readMessageHeader(container: HTMLElement, body: HTMLElement): MessageHeader {
  const sender = queryFirstOutside(container, body, 'messageSender');
  // In "X on behalf of Y", the message's author is the last person card.
  const author = sender === null ? null : (queryAll(sender, 'senderPersona').at(-1) ?? sender);
  return {
    senderLabel: author === null ? null : senderDisplayName(author.textContent ?? ''),
    sentAtText: labelText(queryFirstOutside(container, body, 'messageDate')),
  };
}
