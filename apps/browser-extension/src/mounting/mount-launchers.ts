import type { TargetLanguage } from '@email-writer/contracts';
import type { QuickActionRequest, UiText } from '@email-writer/ui';
import { createApp, shallowRef, type Ref, type ShallowRef } from 'vue';
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
  readonly defaultLanguage: Readonly<Ref<TargetLanguage>>;
  readonly favoriteLanguages: Readonly<Ref<readonly TargetLanguage[]>>;
}

export interface LauncherMounter {
  /** Doğrulanan bölgelere düğme ekler; kaybolan bölgelerin düğmelerini kaldırır. */
  sync(anchors: readonly LauncherAnchor[]): void;
  removeAll(): void;
}

interface MountedLauncher {
  /** Aynı bölge yeni kimlikle bildirilince (ör. taslak yanıta bağlandı) güncellenir. */
  anchor: LauncherAnchor;
  readonly target: ShallowRef<LauncherTarget>;
  ui: ShadowRootContentScriptUi<unknown> | null;
  removed: boolean;
  /** Boyutu izlenen elemanlar: bölgenin kendisi ve onu kırpan en yakın üst elemanlar. */
  observed: readonly Element[];
  /**
   * Kullanıcı düğmeye basılı tutuyor. Bu sırada konum değişmez: Outlook odak
   * kaybında taslağı yeniden çizip bölgeyi büyütebilir; düğme imlecin altından
   * kayarsa bırakınca tıklama gerçekleşmez.
   */
  pressed: boolean;
}

/** Kırpan üst elemanlardan izlenenlerin sayısı; uzaktakiler pencere boyutuyla değişir. */
const OBSERVED_CLIP_ANCESTORS = 3;

/**
 * Bölgeyi kırpan en yakın üst elemanlar. Outlook yanıt editörünü bu kapsayıcılar
 * yerleşmeden açabilir; editörün boyutu değişmese de kapsayıcı büyüyünce düğme
 * yeniden konumlanmalıdır.
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

/** Düğme ile bölgenin kenarı arasındaki boşluk (px). */
const OFFSET = 8;
/** Bölgenin bu kadarı görünmüyorsa düğme gizlenir. Tek satırlık taslak da görünür sayılır. */
const MIN_VISIBLE_WIDTH = 44;
const MIN_VISIBLE_HEIGHT = 12;
/** Araç çubuğunun yüksekliği ve pay: bölge bundan kısaysa düğme bölgenin dışına konur. */
const TOOLBAR_ROOM = 48;
/**
 * Sayfa içeriğinin üstünde, Outlook'un açılır katmanlarının (iletişim kutuları, menüler,
 * ipuçları: 1000000) altında. Kart açıkken Outlook'un onay penceresi (ör. "Discard
 * message") kartın altında kalırsa kullanıcı onu onaylayamaz.
 */
const Z_INDEX = '999990';

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
  return bottom - top >= MIN_VISIBLE_HEIGHT && right - left >= MIN_VISIBLE_WIDTH
    ? { top, right, bottom, left }
    : null;
}

/**
 * Konum gölge kökün içindeki kapsayıcıya verilir: WXT gölge kökün dış
 * elemanına `all: initial !important` uygular ve gölge DOM'da önemli
 * kurallarda iç bağlam kazandığı için dış elemana verilen konum işlemez.
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
  // Kısa bölgede (ör. tek satırlık yanıt) araç çubuğu metnin üstüne binmesin diye
  // bölgenin hemen altına, altta yer yoksa hemen üstüne konur.
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
  // Sağ kenara yaslanır; dar bölmede (veya uzun etiketli dillerde) ekranın soluna taşmaz.
  host.style.left = `${Math.max(visible.right - OFFSET, host.offsetWidth + OFFSET)}px`;
  host.style.transform = transform;
  // Sonuç kartı araç çubuğunun üstünde açılır; ekranın üstünden taşmasın diye yüksekliği sınırlanır.
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
  // Birden çok düğme aynı üst elemanı izleyebilir; izleme son kullanan kalkınca bırakılır.
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
  // Bırakınca bekleyen konum uygulanır; çizim karesinde, yani tıklama işlendikten sonra.
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
  // Düğme pencere dışında bırakılırsa bırakma olayı gelmeyebilir.
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
      // Montaj beklenirken bölge kaybolduysa düğme eklenmez.
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
        // Aynı konuma ikinci kez düğme eklenmez; yeni kimlik ve etiket yerinde uygulanır.
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
