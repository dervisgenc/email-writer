import { messageBodies } from './locate-thread';
import { closest, queryAll, queryFirst } from './selectors';

export interface LocatedComposer {
  readonly editor: HTMLElement;
  /** Okuma bölmesinde bir konuşmanın altında açılmış yanıt taslağı mı? */
  readonly isReply: boolean;
}

function isEditable(element: HTMLElement): boolean {
  if (element.getAttribute('contenteditable') !== 'true') {
    return false;
  }
  // Test DOM'u `isContentEditable` sağlamaz; tarayıcıda ek kontrol yapılır.
  return element.isContentEditable !== false;
}

function isVisible(element: HTMLElement): boolean {
  return typeof element.checkVisibility === 'function' ? element.checkVisibility() : true;
}

/**
 * Görünen taslak editörlerini bulur. `role="textbox"` tek başına yeterli
 * değildir: arama kutusu, kişi seçici ve eklentinin kendi arayüzü elenir.
 * "Sayfadaki ilk editörü seç" gibi bir davranış yoktur; her editör ayrı döner.
 */
export function locateComposers(document: Document, ownUiSelector: string): LocatedComposer[] {
  const pane = queryFirst(document, 'readingPane');
  const paneHasConversation = pane !== null && messageBodies(pane).length > 0;

  const candidates = queryAll(document, 'composeEditor').filter(
    (editor) =>
      closest(editor, 'composeExclusions') === null &&
      editor.closest(ownUiSelector) === null &&
      isEditable(editor) &&
      isVisible(editor),
  );
  const outermost = candidates.filter(
    (editor) => !candidates.some((other) => other !== editor && other.contains(editor)),
  );

  // Yanıt kanıtı: editör önceki yazışmayı alıntılıyor veya bir konuşmanın altında açılmış.
  // Outlook yeni iletileri de aynı yerleşik bölgede açtığı için bölge tek başına yeterli değil.
  return outermost.map((editor) => ({
    editor,
    isReply: queryFirst(editor, 'quoteStart') !== null || (paneHasConversation && pane.contains(editor)),
  }));
}

/** Hesap ipucu: erişilebilir ad veya metin. Yalnızca opak kapsam üretmek için kullanılır. */
export function readAccountHint(document: Document): string | null {
  const element = queryFirst(document, 'accountHint');
  if (element === null) {
    return null;
  }
  return element.getAttribute('aria-label') ?? element.textContent ?? null;
}
