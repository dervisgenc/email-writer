import type { IdentityRegistry } from '../identity/identity-registry';
import { labelText, messageContainerOf, messageKeyOf } from '../reading/message-header';
import { locateQuotedReply } from './locate-quoted-reply';
import { locateThread, messageBodies, selectedRowConversationId, type LocatedThread } from './locate-thread';
import { queryAll, queryFirst } from './selectors';

/** The conversation last shown in the reading pane and what was known about it then. */
interface ShownThread {
  readonly located: LocatedThread;
  readonly selectedRow: string | null;
  /** Key of the message if only one is shown; that is the message being replied to. */
  readonly replyingTo: string | null;
  readonly subject: string | null;
}

export interface ActiveThreadTracker {
  /** The active conversation in the reading pane; unchanged if the pane turned into a reply draft. */
  locate(): LocatedThread | null;
  reset(): void;
}

/** Is a draft editor open in the reading pane? */
function readingPaneHasEditor(pane: HTMLElement): boolean {
  return queryAll(pane, 'composeEditor').length > 0;
}

/**
 * Tracks the active conversation. In the selected-message view, pressing
 * "Reply" makes Outlook replace the message in the reading pane with the reply
 * editor. As long as the same row stays selected in the list, that editor
 * belongs to this conversation and the conversation does not count as changed.
 * Outlook opens the editor empty and fills in the quote later, so the quote is
 * not awaited; `locateComposers` decides from the quote whether the draft is a
 * reply. If another row (e.g. a draft from the Drafts folder) was selected, the
 * editor is not bound. The binding holds while the draft stays open.
 */
export function createActiveThreadTracker(
  document: Document,
  registry: IdentityRegistry,
  ownUiSelector: string,
): ActiveThreadTracker {
  let shown: ShownThread | null = null;
  let parked = false;

  const remember = (located: LocatedThread): void => {
    const bodies = messageBodies(located.root);
    const [only] = bodies;
    shown = {
      located,
      selectedRow: selectedRowConversationId(document),
      replyingTo:
        bodies.length === 1 && only !== undefined
          ? messageKeyOf(messageContainerOf(only, located.root), registry)
          : null,
      subject: labelText(queryFirst(located.root, 'subject')),
    };
    parked = false;
  };

  return {
    locate() {
      const located = locateThread(document, registry);
      if (located !== null) {
        remember(located);
        return located;
      }
      const pane = queryFirst(document, 'readingPane');
      if (shown === null || pane === null || !readingPaneHasEditor(pane)) {
        parked = false;
        return locateQuotedReply(document, registry, ownUiSelector);
      }
      const sameRow = shown.selectedRow !== null && selectedRowConversationId(document) === shown.selectedRow;
      if (!parked && !sameRow) {
        return locateQuotedReply(document, registry, ownUiSelector);
      }
      parked = true;
      return {
        root: pane,
        key: shown.located.key,
        keySource: shown.located.keySource,
        replyView: { replyingTo: shown.replyingTo, subject: shown.subject },
      };
    },
    reset() {
      shown = null;
      parked = false;
    },
  };
}
