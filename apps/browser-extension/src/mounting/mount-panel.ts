import type { Theme } from '@email-writer/contracts';
import type { UiText } from '@email-writer/ui';
import { createApp, ref, type Ref } from 'vue';
import { createShadowRootUi, type ContentScriptContext } from '#imports';

import { OWN_UI_ATTRIBUTE } from '../bootstrap/mail-provider';
import type { PanelSessionDependencies } from '../composables/use-panel-session';
import PanelHost from './PanelHost.vue';

/**
 * Outlook'un klavye kısayolları panelde yazarken tetiklenmesin diye bu olaylar
 * gölge kökün dışına taşınmaz.
 */
export const ISOLATED_EVENTS = [
  'keydown',
  'keyup',
  'keypress',
  'beforeinput',
  'input',
  'paste',
  'copy',
  'cut',
];

export interface MountedPanel {
  setOpen(open: boolean): void;
  /** Kapatıldığında odak mümkünse paneli açan düğmeye döner. */
  rememberOpener(element: HTMLElement | null): void;
  remove(): void;
}

export async function mountPanel(
  ctx: ContentScriptContext,
  options: { session: PanelSessionDependencies; text: Readonly<Ref<UiText>>; theme: Readonly<Ref<Theme>> },
): Promise<MountedPanel> {
  const open = ref(false);
  let opener: HTMLElement | null = null;

  const ui = await createShadowRootUi(ctx, {
    name: 'email-writer-panel',
    position: 'inline',
    anchor: 'body',
    append: 'last',
    isolateEvents: ISOLATED_EVENTS,
    onMount(container, _shadow, host) {
      host.setAttribute(OWN_UI_ATTRIBUTE, 'panel');
      const app = createApp(PanelHost, {
        session: options.session,
        text: options.text,
        theme: options.theme,
        open,
      });
      app.mount(container);
      return app;
    },
    onRemove(app) {
      app?.unmount();
    },
  });
  ui.mount();

  return {
    setOpen(value) {
      open.value = value;
      if (!value && opener?.isConnected) {
        opener.focus({ preventScroll: true });
      }
    },
    rememberOpener(element) {
      opener = element;
    },
    remove() {
      ui.remove();
    },
  };
}
