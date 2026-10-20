import type { TargetLanguage } from '@writehand/contracts';
import type { QuickActionRequest, UiText } from '@writehand/ui';
import { createApp, shallowRef, type Ref, type ShallowRef } from 'vue';
import { createShadowRootUi, type ContentScriptContext, type ShadowRootContentScriptUi } from '#imports';

import { OWN_UI_ATTRIBUTE, type LauncherAnchor } from '../bootstrap/mail-provider';
import type { PanelSessionDependencies } from '../composables/use-panel-session';
import type { PanelSurface } from '../controllers/panel-controller';
import type { Appearance } from './appearance';
import LauncherHost from './LauncherHost.vue';
import { ISOLATED_EVENTS } from './mount-panel';

/** What a launcher shows: the reading pane button or the draft toolbar. */
export type LauncherTarget =
  | { readonly kind: 'thread' }
  | { readonly kind: 'composer'; readonly composerKey: string; readonly isReply: boolean };

export interface LauncherCallbacks {
  readonly onOpenThread: (anchor: LauncherAnchor, opener: HTMLElement | null) => void;
  readonly onQuickAction: (anchor: LauncherAnchor, request: QuickActionRequest) => void;
  readonly onOpenPanel: (anchor: LauncherAnchor, opener: HTMLElement | null) => void;
}

export interface LauncherOptions extends LauncherCallbacks {
  readonly text: Readonly<Ref<UiText>>;
  readonly appearance: Readonly<Ref<Appearance>>;
  readonly session: PanelSessionDependencies;
  readonly surface: Readonly<Ref<PanelSurface>>;
  readonly defaultLanguage: Readonly<Ref<TargetLanguage>>;
  readonly favoriteLanguages: Readonly<Ref<readonly TargetLanguage[]>>;
}

export interface LauncherMounter {
  /** Adds buttons to verified regions and removes the buttons of regions that disappeared. */
  sync(anchors: readonly LauncherAnchor[]): void;
  removeAll(): void;
}

interface MountedLauncher {
  /** Updated when the same region is reported with a new identity (e.g. the draft became a reply). */
  anchor: LauncherAnchor;
  readonly target: ShallowRef<LauncherTarget>;
  ui: ShadowRootContentScriptUi<unknown> | null;
  removed: boolean;
  /** Elements whose size is observed: the region itself and its nearest clipping ancestors. */
  observed: readonly Element[];
  /**
   * The user is holding the button down. The position is frozen meanwhile: Outlook may
   * redraw the draft and grow the region on focus loss, and if the button slides out from
   * under the pointer, releasing it does not produce a click.
   */
  pressed: boolean;
}

/** How many clipping ancestors are observed; more distant ones change with the window size. */
const OBSERVED_CLIP_ANCESTORS = 3;

/**
 * The nearest ancestors that clip the region. Outlook may open the reply editor before
 * these containers settle; even if the editor's size does not change, the button must be
 * repositioned when a container grows.
 */
function clippingAncestors(element: HTMLElement): HTMLElement[] {
  const result: HTMLElement[] = [];
  for (
    let parent = element.parentElement;
    parent !== null && parent !== document.body && result.length < OBSERVED_CLIP_ANCESTORS;
    parent = parent.parentElement
  ) {
    const style = getComputedStyle(parent);
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
      result.push(parent);
    }
  }
  return result;
}

/** Gap between the button and the region's edge (px). */
const OFFSET = 8;
/** The button is hidden unless this much of the region is visible; a one-line draft still counts. */
const MIN_VISIBLE_WIDTH = 44;
const MIN_VISIBLE_HEIGHT = 12;
/** Toolbar height plus margin: if the region is shorter, the button is placed outside it. */
const TOOLBAR_ROOM = 48;
/**
 * Above the page content, below Outlook's popup layers (dialogs, menus,
 * tooltips: 1000000). If Outlook's confirmation dialog (e.g. "Discard message")
 * ended up below the open card, the user could not confirm it.
 */
const Z_INDEX = '999990';

interface VisibleRect {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * The part of the element actually visible on screen, clipped by scrolling ancestors
 * and the viewport. Outlook's reply editor can be taller than the screen inside a
 * scrolling container; the button sits at the bottom edge of the visible part rather
 * than the editor's real bottom edge, and stays on screen while scrolling.
 */
function visibleRect(element: HTMLElement): VisibleRect | null {
  const rect = element.getBoundingClientRect();
  let { top, right, bottom, left } = rect;
  for (
    let parent = element.parentElement;
    parent !== null && parent !== document.body;
    parent = parent.parentElement
  ) {
    const style = getComputedStyle(parent);
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
      const box = parent.getBoundingClientRect();
      top = Math.max(top, box.top);
      right = Math.min(right, box.right);
      bottom = Math.min(bottom, box.bottom);
      left = Math.max(left, box.left);
    }
  }
  top = Math.max(top, 0);
  left = Math.max(left, 0);
  bottom = Math.min(bottom, window.innerHeight);
  right = Math.min(right, window.innerWidth);
  return bottom - top >= MIN_VISIBLE_HEIGHT && right - left >= MIN_VISIBLE_WIDTH
    ? { top, right, bottom, left }
    : null;
}

/**
 * The position is set on the container inside the shadow root: WXT applies
 * `all: initial !important` to the shadow host, and since the inner context wins
 * for important rules in shadow DOM, a position set on the host has no effect.
 */
function position(entry: MountedLauncher): void {
  const host = entry.ui?.uiContainer;
  if (host === undefined || entry.pressed) {
    return;
  }
  const visible = entry.anchor.element.isConnected ? visibleRect(entry.anchor.element) : null;
  host.style.display = visible === null ? 'none' : 'block';
  if (visible === null) {
    return;
  }
  const isTop = entry.anchor.placement === 'top-end';
  // In a short region (e.g. a one-line reply) the toolbar goes right below the region so it
  // does not cover the text, or right above it if there is no room below.
  const roomInside = visible.bottom - visible.top >= TOOLBAR_ROOM;
  const roomBelow = window.innerHeight - visible.bottom >= TOOLBAR_ROOM;
  let top: number;
  let transform: string;
  if (isTop) {
    top = visible.top + OFFSET;
    transform = 'translateX(-100%)';
  } else if (roomInside) {
    top = visible.bottom - OFFSET;
    transform = 'translate(-100%, -100%)';
  } else if (roomBelow) {
    top = visible.bottom + OFFSET / 2;
    transform = 'translateX(-100%)';
  } else {
    top = visible.top - OFFSET / 2;
    transform = 'translate(-100%, -100%)';
  }
  host.style.top = `${top}px`;
  // Right-aligned, but never overflowing the left of the screen in a narrow pane or with long labels.
  host.style.left = `${Math.max(visible.right - OFFSET, host.offsetWidth + OFFSET)}px`;
  host.style.transform = transform;
  // The result card opens above the toolbar; cap its height so it does not overflow the top of the screen.
  host.style.setProperty('--ew-space-above', `${Math.max(160, top - 2 * OFFSET - 40)}px`);
}

function sameTarget(a: LauncherTarget, b: LauncherTarget): boolean {
  return a.kind === 'thread'
    ? b.kind === 'thread'
    : b.kind === 'composer' && a.composerKey === b.composerKey && a.isReply === b.isReply;
}

function targetOf(anchor: LauncherAnchor): LauncherTarget {
  return anchor.target.kind === 'thread'
    ? { kind: 'thread' }
    : {
        kind: 'composer',
        composerKey: anchor.target.composer.composerKey,
        isReply: anchor.target.composer.threadKey !== null,
      };
}

/**
 * Shows the reading pane button and draft toolbars in shadow roots that float at the
 * corner of their region in the page body, without inserting them into Outlook's DOM
 * tree. That way Outlook's redraws do not break the buttons, and the buttons do not
 * break Outlook. The result card opens on the toolbar of the draft where the operation started.
 */
export function createLauncherMounter(ctx: ContentScriptContext, options: LauncherOptions): LauncherMounter {
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
  // Several buttons may observe the same ancestor; observation stops when the last user goes away.
  const observers = new Map<Element, number>();
  const observe = (element: Element) => {
    const count = observers.get(element) ?? 0;
    if (count === 0) resizeObserver.observe(element);
    observers.set(element, count + 1);
  };
  const unobserve = (element: Element) => {
    const count = observers.get(element) ?? 0;
    if (count <= 1) {
      observers.delete(element);
      resizeObserver.unobserve(element);
    } else {
      observers.set(element, count - 1);
    }
  };
  ctx.addEventListener(window, 'scroll', scheduleReposition, { capture: true, passive: true });
  ctx.addEventListener(window, 'resize', scheduleReposition, { passive: true });
  // On release, apply the pending position in the next animation frame, i.e. after the click is handled.
  const release = () => {
    let wasPressed = false;
    for (const entry of mounted.values()) {
      wasPressed ||= entry.pressed;
      entry.pressed = false;
    }
    if (wasPressed) scheduleReposition();
  };
  ctx.addEventListener(window, 'pointerup', release, { capture: true, passive: true });
  ctx.addEventListener(window, 'pointercancel', release, { capture: true, passive: true });
  // If the button is released outside the window, the release event may never arrive.
  ctx.addEventListener(window, 'blur', release);
  ctx.onInvalidated(() => resizeObserver.disconnect());

  const remove = (key: string) => {
    const entry = mounted.get(key);
    if (entry !== undefined) {
      entry.removed = true;
      entry.observed.forEach(unobserve);
      entry.ui?.remove();
      mounted.delete(key);
    }
  };

  const mount = (anchor: LauncherAnchor) => {
    const entry: MountedLauncher = {
      anchor,
      target: shallowRef(targetOf(anchor)),
      ui: null,
      removed: false,
      observed: [],
      pressed: false,
    };
    mounted.set(anchor.key, entry);
    let shadowRoot: ShadowRoot | null = null;
    // When the panel closes, focus returns to the button that opened it.
    const opener = () => shadowRoot?.activeElement as HTMLElement | null;

    void createShadowRootUi(ctx, {
      name: 'writehand-launcher',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      isolateEvents: ISOLATED_EVENTS,
      onMount(container, shadow, host) {
        shadowRoot = shadow;
        host.setAttribute(OWN_UI_ATTRIBUTE, 'launcher');
        // Keep the right-aligned container from shrinking into the remaining space and wrapping the buttons.
        Object.assign(container.style, {
          position: 'fixed',
          zIndex: Z_INDEX,
          display: 'none',
          width: 'max-content',
        });
        container.addEventListener(
          'pointerdown',
          () => {
            entry.pressed = true;
          },
          { passive: true },
        );
        const app = createApp(LauncherHost, {
          text: options.text,
          appearance: options.appearance,
          target: entry.target,
          session: options.session,
          surface: options.surface,
          defaultLanguage: options.defaultLanguage,
          favoriteLanguages: options.favoriteLanguages,
          onOpenThread: () => options.onOpenThread(entry.anchor, opener()),
          onQuickAction: (request: QuickActionRequest) => options.onQuickAction(entry.anchor, request),
          onOpenPanel: () => options.onOpenPanel(entry.anchor, opener()),
        });
        app.mount(container);
        return app;
      },
      onRemove(app) {
        app?.unmount();
      },
    }).then((ui) => {
      // If the region disappeared while mounting was pending, the button is not added.
      if (entry.removed || !anchor.element.isConnected) {
        return;
      }
      entry.ui = ui;
      ui.mount();
      entry.observed = [anchor.element, ...clippingAncestors(anchor.element)];
      entry.observed.forEach(observe);
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
        const entry = mounted.get(anchor.key);
        if (entry === undefined) {
          mount(anchor);
          continue;
        }
        // Never add a second button at the same spot; the new identity and label are applied in place.
        entry.anchor = anchor;
        const target = targetOf(anchor);
        if (!sameTarget(entry.target.value, target)) entry.target.value = target;
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
