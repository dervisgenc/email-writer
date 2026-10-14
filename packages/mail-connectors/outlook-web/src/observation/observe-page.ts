export interface PageObserver {
  /** Bekleyen yeniden keşfi hemen çalıştırır. */
  flush(): void;
  dispose(): void;
}

export interface ObservePageOptions {
  readonly document: Document;
  readonly onChange: () => void;
  /** Eklentinin kendi arayüzü ve izlenen editörler sayfa keşfini tetiklemez. */
  readonly isIgnored: (node: Node) => boolean;
  /** SPA gezinmesi: konum değişikliği yeniden keşif için bir işarettir. */
  readonly subscribeLocation?: (listener: () => void) => () => void;
  readonly debounceMs?: number;
}

/**
 * Sayfa değişikliklerini kısa aralıkta birleştirir. Her DOM değişikliğinde
 * bütün sayfa taranmaz; yalnızca eklenti dışı ve izlenen editör dışı
 * değişiklikler yeniden keşfi tetikler. Sabit aralıklı polling yapılmaz.
 */
export function observePage(options: ObservePageOptions): PageObserver {
  const { document } = options;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const run = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (!disposed) {
      options.onChange();
    }
  };

  const schedule = () => {
    if (!disposed && timer === null) {
      timer = setTimeout(run, options.debounceMs ?? 150);
    }
  };

  const observer = new MutationObserver((records) => {
    if (records.some((record) => !options.isIgnored(record.target))) {
      schedule();
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    // Konuşma seçimi ve editörün düzenlenebilirliği öznitelikle değişebilir.
    attributes: true,
    attributeFilter: ['aria-selected', 'aria-expanded', 'data-convid', 'contenteditable'],
  });
  const unsubscribeLocation = options.subscribeLocation?.(schedule);

  return {
    flush() {
      if (timer !== null) {
        run();
      }
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      unsubscribeLocation?.();
      if (timer !== null) {
        clearTimeout(timer);
      }
    },
  };
}
