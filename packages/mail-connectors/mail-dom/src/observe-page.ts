export interface PageObserver {
  /** Runs a pending rediscovery right away. */
  flush(): void;
  /** Requests a rediscovery when an unobserved change (e.g. inside a tracked editor) needs one. */
  request(): void;
  dispose(): void;
}

export interface ObservePageOptions {
  readonly document: Document;
  readonly onChange: () => void;
  /** The extension's own UI and tracked editors do not trigger page discovery. */
  readonly isIgnored: (node: Node) => boolean;
  /** SPA navigation: a location change is a signal to rediscover. */
  readonly subscribeLocation?: (listener: () => void) => () => void;
  /**
   * Attributes whose changes also trigger rediscovery, such as a list row's selection or an
   * editor's editability. Other attribute changes are ignored.
   */
  readonly attributes: readonly string[];
  readonly debounceMs?: number;
}

/**
 * Debounces page changes over a short window. The whole page is not rescanned on
 * every DOM change; only changes outside the extension and outside tracked
 * editors trigger rediscovery. There is no fixed-interval polling.
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
    attributes: options.attributes.length > 0,
    ...(options.attributes.length > 0 ? { attributeFilter: [...options.attributes] } : {}),
  });
  const unsubscribeLocation = options.subscribeLocation?.(schedule);

  return {
    flush() {
      if (timer !== null) {
        run();
      }
    },
    request: schedule,
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
