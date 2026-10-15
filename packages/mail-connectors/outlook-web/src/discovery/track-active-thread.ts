import type { IdentityRegistry } from '../identity/identity-registry';
import { labelText, messageContainerOf, messageKeyOf } from '../reading/message-header';
import { locateThread, messageBodies, selectedRowConversationId, type LocatedThread } from './locate-thread';
import { queryAll, queryFirst } from './selectors';

/** Okuma bölmesinde son gösterilen konuşma ve o anki bilgileri. */
interface ShownThread {
  readonly located: LocatedThread;
  readonly selectedRow: string | null;
  /** Tek mesaj gösteriliyorsa o mesajın kimliği; yanıtlanacak mesaj odur. */
  readonly replyingTo: string | null;
  readonly subject: string | null;
}

export interface ActiveThreadTracker {
  /** Okuma bölmesindeki etkin konuşma; bölme yanıt taslağına dönüştüyse aynı konuşma. */
  locate(): LocatedThread | null;
  reset(): void;
}

/** Okuma bölmesinde açılmış bir taslak editörü var mı? */
function readingPaneHasEditor(pane: HTMLElement): boolean {
  return queryAll(pane, 'composeEditor').length > 0;
}

/**
 * Etkin konuşmayı izler. Seçili mesaj görünümünde Outlook, "Yanıtla"ya
 * basılınca okuma bölmesindeki mesajı kaldırıp yerine yanıt editörünü koyar.
 * Listede aynı satır seçili kaldığı sürece okuma bölmesindeki editör bu
 * konuşmaya aittir; konuşma değişmiş sayılmaz. Outlook editörü önce boş açıp
 * alıntıyı sonra doldurduğu için alıntı beklenmez; taslağın yanıt olup
 * olmadığına `locateComposers` alıntıya bakarak karar verir. Başka bir satır
 * (ör. Taslaklar klasöründen bir taslak) seçildiyse bağlanmaz. Taslak açık
 * kaldığı sürece bağ korunur.
 */
export function createActiveThreadTracker(
  document: Document,
  registry: IdentityRegistry,
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
        return null;
      }
      const sameRow = shown.selectedRow !== null && selectedRowConversationId(document) === shown.selectedRow;
      if (!parked && !sameRow) {
        return null;
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
