import type { LanguageCode } from '@email-writer/contracts';
import type { QuickActionRequest, UiText } from '@email-writer/ui';
import { createApp, type Ref } from 'vue';
import { createShadowRootUi, type ContentScriptContext, type ShadowRootContentScriptUi } from '#imports';

import { OWN_UI_ATTRIBUTE, type LauncherAnchor } from '../bootstrap/mail-provider';
import type { PanelSessionDependencies } from '../composables/use-panel-session';
import type { PanelSurface } from '../controllers/panel-controller';
import type { Appearance } from './appearance';
import LauncherHost from './LauncherHost.vue';
import { ISOLATED_EVENTS } from './mount-panel';

/** Başlatıcının gösterdiği arayüz: okuma bölmesi düğmesi veya taslak araç çubuğu. */
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
  readonly defaultLanguage: Readonly<Ref<LanguageCode>>;
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
/** Bölgenin bu kadarı görünmüyorsa düğme gizlenir (araç çubuğu yüksekliği + pay). */
const MIN_VISIBLE = 44;
const Z_INDEX = '2147483000';

interface VisibleRect {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * Elemanın ekranda gerçekten görünen bölümü: kaydırılan üst elemanlar ve
 * görünüm alanıyla kırpılır. Outlook'un yanıt editörü kaydırılan bir
 * kapsayıcının içinde ekrandan uzun olabilir; düğme editörün gerçek alt kenarına
 * değil, görünen bölümün alt kenarına yerleşir ve kaydırırken ekranda kalır.
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
  return bottom - top >= MIN_VISIBLE && right - left >= MIN_VISIBLE ? { top, right, bottom, left } : null;
}

/**
 * Konum gölge kökün içindeki kapsayıcıya verilir: WXT gölge kökün dış
 * elemanına `all: initial !important` uygular ve gölge DOM'da önemli
 * kurallarda iç bağlam kazandığı için dış elemana verilen konum işlemez.
 */
function position(entry: MountedLauncher): void {
  const host = entry.ui?.uiContainer;
  if (host === undefined) {
    return;
  }
  const visible = entry.anchor.element.isConnected ? visibleRect(entry.anchor.element) : null;
  host.style.display = visible === null ? 'none' : 'block';
  if (visible === null) {
    return;
  }
  const isTop = entry.anchor.placement === 'top-end';
  const top = isTop ? visible.top + OFFSET : visible.bottom - OFFSET;
  host.style.top = `${top}px`;
  host.style.left = `${visible.right - OFFSET}px`;
  host.style.transform = isTop ? 'translateX(-100%)' : 'translate(-100%, -100%)';
  // Sonuç kartı araç çubuğunun üstünde açılır; ekranın üstünden taşmasın diye yüksekliği sınırlanır.
  host.style.setProperty('--ew-space-above', `${Math.max(160, top - 2 * OFFSET - 40)}px`);
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
 * Okuma bölmesi düğmesini ve taslak araç çubuklarını Outlook'un DOM ağacına
 * eklemeden, sayfa gövdesinde ilgili bölgenin köşesine yüzen gölge köklerde
 * gösterir. Böylece Outlook'un yeniden çizimi düğmeleri veya düğmeler
 * Outlook'u bozmaz. Sonuç kartı, işlemin başladığı taslağın araç çubuğunda açılır.
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
    let shadowRoot: ShadowRoot | null = null;
    // Panel kapanınca odak, onu açan düğmeye döner.
    const opener = () => shadowRoot?.activeElement as HTMLElement | null;

    void createShadowRootUi(ctx, {
      name: 'email-writer-launcher',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      isolateEvents: ISOLATED_EVENTS,
      onMount(container, shadow, host) {
        shadowRoot = shadow;
        host.setAttribute(OWN_UI_ATTRIBUTE, 'launcher');
        // Sağ kenara yaslanan kapsayıcı kalan dar alana göre daralıp düğmeleri kırmasın.
        Object.assign(container.style, {
          position: 'fixed',
          zIndex: Z_INDEX,
          display: 'none',
          width: 'max-content',
        });
        const app = createApp(LauncherHost, {
          text: options.text,
          appearance: options.appearance,
          target: targetOf(anchor),
          session: options.session,
          surface: options.surface,
          defaultLanguage: options.defaultLanguage,
          onOpenThread: () => options.onOpenThread(anchor, opener()),
          onQuickAction: (request: QuickActionRequest) => options.onQuickAction(anchor, request),
          onOpenPanel: () => options.onOpenPanel(anchor, opener()),
        });
        app.mount(container);
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
