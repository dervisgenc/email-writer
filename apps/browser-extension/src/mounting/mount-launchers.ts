import type { Theme } from '@email-writer/contracts';
import type { UiText } from '@email-writer/ui';
import { createApp, type Ref } from 'vue';
import { createShadowRootUi, type ContentScriptContext, type ShadowRootContentScriptUi } from '#imports';

import { OWN_UI_ATTRIBUTE, type LauncherAnchor } from '../bootstrap/mail-provider';
import LauncherHost from './LauncherHost.vue';
import { ISOLATED_EVENTS } from './mount-panel';

export interface LauncherCallbacks {
  readonly onOpen: (anchor: LauncherAnchor, opener: HTMLElement | null) => void;
  readonly onQuickAction: (
    anchor: LauncherAnchor,
    operation: 'revise' | 'translate',
    opener: HTMLElement | null,
  ) => void;
}

export interface LauncherMounter {
  /** Doğrulanan bölgelere düğme ekler; kaybolan bölgelerin düğmelerini kaldırır. */
  sync(anchors: readonly LauncherAnchor[]): void;
  removeAll(): void;
}

interface MountedLauncher {
  readonly anchor: LauncherAnchor;
  ui: ShadowRootContentScriptUi<unknown> | null;
  removed: boolean;
}

/** Düğme ile bölgenin kenarı arasındaki boşluk (px). */
const OFFSET = 8;
const Z_INDEX = '2147483000';

function position(entry: MountedLauncher): void {
  const host = entry.ui?.shadowHost;
  if (host === undefined) {
    return;
  }
  const rect = entry.anchor.element.getBoundingClientRect();
  const isVisible = entry.anchor.element.isConnected && rect.width > 0 && rect.height > 0;
  host.style.display = isVisible ? 'block' : 'none';
  if (!isVisible) {
    return;
  }
  const top = entry.anchor.placement === 'top-end' ? rect.top + OFFSET : rect.bottom - OFFSET;
  host.style.top = `${Math.max(0, top)}px`;
  host.style.left = `${Math.max(0, rect.right - OFFSET)}px`;
  host.style.transform =
    entry.anchor.placement === 'top-end' ? 'translateX(-100%)' : 'translate(-100%, -100%)';
}

/**
 * Başlatma düğmelerini Outlook'un DOM ağacına eklemeden, sayfa gövdesinde
 * ilgili bölgenin köşesine yüzen gölge köklerde gösterir. Böylece Outlook'un
 * yeniden çizimi düğmeleri veya düğmeler Outlook'u bozmaz.
 */
export function createLauncherMounter(
  ctx: ContentScriptContext,
  options: { text: Readonly<Ref<UiText>>; theme: Readonly<Ref<Theme>> } & LauncherCallbacks,
): LauncherMounter {
  const mounted = new Map<string, MountedLauncher>();
  let frame: number | null = null;

  const repositionAll = () => {
    frame = null;
    for (const entry of mounted.values()) {
      position(entry);
    }
  };
  const scheduleReposition = () => {
    if (frame === null) {
      frame = ctx.requestAnimationFrame(repositionAll);
    }
  };
  const resizeObserver = new ResizeObserver(scheduleReposition);
  ctx.addEventListener(window, 'scroll', scheduleReposition, { capture: true, passive: true });
  ctx.addEventListener(window, 'resize', scheduleReposition, { passive: true });
  ctx.onInvalidated(() => resizeObserver.disconnect());

  const remove = (key: string) => {
    const entry = mounted.get(key);
    if (entry !== undefined) {
      entry.removed = true;
      resizeObserver.unobserve(entry.anchor.element);
      entry.ui?.remove();
      mounted.delete(key);
    }
  };

  const mount = (anchor: LauncherAnchor) => {
    const entry: MountedLauncher = { anchor, ui: null, removed: false };
    mounted.set(anchor.key, entry);
    let opener: HTMLElement | null = null;

    void createShadowRootUi(ctx, {
      name: 'email-writer-launcher',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      isolateEvents: ISOLATED_EVENTS,
      onMount(container, shadow, host) {
        host.setAttribute(OWN_UI_ATTRIBUTE, 'launcher');
        Object.assign(host.style, { position: 'fixed', zIndex: Z_INDEX, display: 'none' });
        const app = createApp(LauncherHost, {
          text: options.text,
          theme: options.theme,
          showQuickActions: anchor.target.kind === 'composer',
          onOpen: () => options.onOpen(anchor, opener),
          onQuickAction: (operation: 'revise' | 'translate') =>
            options.onQuickAction(anchor, operation, opener),
        });
        app.mount(container);
        opener = shadow.querySelector<HTMLElement>('.ew-launcher__open');
        return app;
      },
      onRemove(app) {
        app?.unmount();
      },
    }).then((ui) => {
      // Montaj beklenirken bölge kaybolduysa düğme eklenmez.
      if (entry.removed || !anchor.element.isConnected) {
        return;
      }
      entry.ui = ui;
      ui.mount();
      resizeObserver.observe(anchor.element);
      position(entry);
    });
  };

  return {
    sync(anchors) {
      const wanted = new Map(anchors.map((anchor) => [anchor.key, anchor]));
      for (const [key, entry] of mounted) {
        const next = wanted.get(key);
        if (
          next === undefined ||
          next.element !== entry.anchor.element ||
          !entry.anchor.element.isConnected
        ) {
          remove(key);
        }
      }
      for (const anchor of anchors) {
        // Aynı konuma ikinci kez düğme eklenmez.
        if (!mounted.has(anchor.key)) {
          mount(anchor);
        }
      }
      scheduleReposition();
    },
    removeAll() {
      for (const key of [...mounted.keys()]) {
        remove(key);
      }
    },
  };
}
