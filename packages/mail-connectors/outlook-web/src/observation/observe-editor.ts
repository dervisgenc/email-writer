export interface StoredRange {
  readonly startContainer: Node;
  readonly startOffset: number;
  readonly endContainer: Node;
  readonly endOffset: number;
}

/**
 * Tek bir editörün sürümünü, IME durumunu ve son seçimini izler. Sürüm,
 * editörün anlamlı içeriğinin parmak izi değiştiğinde artar; böylece içeriği
 * değiştirmeyen DOM gürültüsü hedefleri gereksiz yere geçersiz kılmaz.
 */
export interface EditorTracker {
  readonly editor: HTMLElement;
  /** Parmak izini hemen hesaplar, değiştiyse sürümü artırır ve güncel sürümü döner. */
  sync(): number;
  isComposing(): boolean;
  /** Klavye kullanımında odak kaybolsa bile son geçerli seçim. */
  lastSelection(): StoredRange | null;
  dispose(): void;
}

export interface ObserveEditorOptions {
  readonly document: Document;
  /** Editörün içerik ve yapı parmak izi. */
  readonly fingerprint: (editor: HTMLElement) => string;
  readonly onRevision: (revision: number) => void;
  /** Birleştirilen her DOM değişikliğinden sonra çağrılır; sürüm değişmemiş olabilir. */
  readonly onSettled?: () => void;
  /** Eklentinin kendi arayüzüne ait düğümler; oraya geçen odak seçimi silmez. */
  readonly isOwnUi: (node: Node) => boolean;
  /** Pahalı metin çıkarımının birleştirileceği süre. */
  readonly debounceMs?: number;
}

export function observeEditor(editor: HTMLElement, options: ObserveEditorOptions): EditorTracker {
  const { document } = options;
  let revision = 1;
  let lastFingerprint = options.fingerprint(editor);
  let composing = false;
  let storedSelection: StoredRange | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const sync = (): number => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const next = options.fingerprint(editor);
    if (next !== lastFingerprint) {
      lastFingerprint = next;
      revision += 1;
      options.onRevision(revision);
    }
    return revision;
  };

  const schedule = (): void => {
    if (disposed || timer !== null) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      if (!disposed) {
        sync();
        options.onSettled?.();
      }
    }, options.debounceMs ?? 120);
  };

  // `beforeinput` tek başına yeterli değildir; input, IME ve DOM değişiklikleri
  // birlikte izlenir.
  const observer = new MutationObserver(schedule);
  observer.observe(editor, { childList: true, characterData: true, subtree: true });

  const onCompositionStart = () => {
    composing = true;
  };
  const onCompositionEnd = () => {
    composing = false;
    schedule();
  };
  const onSelectionChange = () => {
    const selection = document.getSelection();
    if (selection === null || selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    if (options.isOwnUi(range.startContainer)) {
      return;
    }
    const isInside = editor.contains(range.startContainer) && editor.contains(range.endContainer);
    // Kullanıcı başka bir yeri seçtiyse eski seçim geçerliliğini yitirir.
    storedSelection =
      isInside && !range.collapsed
        ? {
            startContainer: range.startContainer,
            startOffset: range.startOffset,
            endContainer: range.endContainer,
            endOffset: range.endOffset,
          }
        : null;
  };

  editor.addEventListener('input', schedule);
  editor.addEventListener('compositionstart', onCompositionStart);
  editor.addEventListener('compositionend', onCompositionEnd);
  document.addEventListener('selectionchange', onSelectionChange);

  return {
    editor,
    sync,
    isComposing: () => composing,
    lastSelection: () => {
      if (storedSelection === null) {
        return null;
      }
      const { startContainer, endContainer } = storedSelection;
      return startContainer.isConnected && endContainer.isConnected ? storedSelection : null;
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      if (timer !== null) {
        clearTimeout(timer);
      }
      editor.removeEventListener('input', schedule);
      editor.removeEventListener('compositionstart', onCompositionStart);
      editor.removeEventListener('compositionend', onCompositionEnd);
      document.removeEventListener('selectionchange', onSelectionChange);
    },
  };
}
