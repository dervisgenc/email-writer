import { labelText, opaqueHash, senderDisplayName, type IdentityRegistry } from '@writehand/mail-dom';

import { closest, MESSAGE_ID_ATTRIBUTES, MISSING_ID_VALUES, queryFirstOutside } from '../discovery/selectors';

export interface MessageHeader {
  readonly senderLabel: string | null;
  /** Displayed date text; not parsed because it depends on language and locale. */
  readonly sentAtText: string | null;
}

/** The message a body belongs to: its message container inside the conversation, or its parent. */
export function messageContainerOf(body: HTMLElement, threadRoot: Element): HTMLElement {
  const container = closest(body, 'message');
  return container !== null && threadRoot.contains(container) ? container : (body.parentElement ?? body);
}

/** Gmail's id of the message, from the container or the element that carries it. */
function messageId(container: HTMLElement): string | null {
  for (const attribute of MESSAGE_ID_ATTRIBUTES) {
    const value = (
      container.getAttribute(attribute) ??
      container.querySelector(`[${attribute}]`)?.getAttribute(attribute) ??
      ''
    ).trim();
    if (!MISSING_ID_VALUES.includes(value)) {
      return value;
    }
  }
  return null;
}

/**
 * The message's key. If Gmail's message id is on the page, an opaque hash of it is used, so the
 * same message keeps its key when the user opens the conversation again and is not counted
 * twice in the context. Otherwise the key is valid only while this DOM element lives.
 */
export function messageKeyOf(container: HTMLElement, registry: IdentityRegistry): string {
  const id = messageId(container);
  return id === null ? registry.keyFor(container, 'msg') : `msg-${opaqueHash(id)}`;
}

/**
 * The sender's display name and the displayed date, looked up only in the header, outside the
 * body: email HTML may contain look-alike markup. The address is never kept.
 */
export function readMessageHeader(container: HTMLElement, body: HTMLElement): MessageHeader {
  const sender = queryFirstOutside(container, body, 'messageSender');
  const date = queryFirstOutside(container, body, 'messageDate');
  const senderText = sender?.getAttribute('name') ?? sender?.textContent ?? '';
  // The date's tooltip has the full date; the visible text may be relative ("2 hours ago").
  const dateTitle = date?.getAttribute('title')?.replace(/\s+/g, ' ').trim() ?? '';
  return {
    senderLabel: senderDisplayName(senderText),
    sentAtText: dateTitle !== '' ? dateTitle.slice(0, 200) : labelText(date),
  };
}
