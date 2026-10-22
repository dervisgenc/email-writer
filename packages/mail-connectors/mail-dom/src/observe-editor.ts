export interface StoredRange {
  readonly startContainer: Node;
  readonly startOffset: number;
  readonly endContainer: Node;
  readonly endOffset: number;
}

/**
 * Tracks one editor's revision, IME state and last selection. The revision goes
 * up when the fingerprint of the editor's meaningful content changes, so DOM
 * noise that leaves the content alone does not needlessly invalidate targets.
 */
export interface EditorTracker {
  readonly editor: HTMLElement;
  /** Computes the fingerprint now, bumps the revision if it changed and returns the current revision. */
  sync(): number;
  isComposing(): boolean;
  /** The last valid selection, even if focus was lost while using the keyboard. */
  lastSelection(): StoredRange | null;
  dispose(): void;
}

export interface ObserveEditorOptions {
  readonly document: Document;
  /** Fingerprint of the editor's content and structure. */
  readonly fingerprint: (editor: HTMLElement) => string;
  readonly onRevision: (revision: number) => void;
  /** Called after each debounced batch of DOM changes; the revision may be unchanged. */
  readonly onSettled?: () => void;
  /** Nodes of the extension's own UI; moving focus there does not clear the selection. */
  readonly isOwnUi: (node: Node) => boolean;
  /** Debounce window for the expensive text extraction. */
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

  // `beforeinput` alone is not enough; input, IME and DOM changes are watched
  // together.
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
    // If the user selected something elsewhere, the old selection is no longer valid.
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
