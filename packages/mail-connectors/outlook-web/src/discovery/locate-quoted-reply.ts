import type { IdentityRegistry } from '../identity/identity-registry';
import { locateComposers } from './locate-composers';
import type { LocatedThread } from './locate-thread';
import { queryAll, queryFirst } from './selectors';

/**
 * A draft may already be open when the extension starts. Its own quote is usable
 * context, but the selected list row is not proof of the draft's conversation.
 * Keep this fallback local to the one quoted editor in the reading pane.
 */
export function locateQuotedReply(
  document: Document,
  registry: IdentityRegistry,
  ownUiSelector: string,
): LocatedThread | null {
  const pane = queryFirst(document, 'readingPane');
  if (pane === null) return null;
  const editors = locateComposers(document, ownUiSelector)
    .map(({ editor }) => editor)
    .filter(
      (editor) =>
        pane.contains(editor) &&
        // An empty appendonsend marker can also be present in a new message.
        queryAll(editor, 'quoteStart').some((marker) => (marker.textContent ?? '').trim() !== ''),
    );
  const [editor] = editors;
  if (editors.length !== 1 || editor === undefined) return null;
  const editorKey = registry.keyFor(editor, 'composer');
  return {
    root: editor,
    key: `thread-quote-${editorKey}`,
    keySource: 'local',
    replyView: {
      replyingTo: `message-quote-${editorKey}`,
      subject: null,
      quoteEditor: editor,
    },
  };
}
