import { createSession } from '@email-writer/core';
import { ok, type TextProcessor } from '@email-writer/contracts';
import { computed, shallowRef, watch } from 'vue';
import type { ContentScriptContext } from '#imports';

import { createActionController } from '../controllers/action-controller';
import { createApplyController } from '../controllers/apply-controller';
import { createPanelController } from '../controllers/panel-controller';
import { createSessionStore } from '../controllers/session-store';
import { textFor } from '../locales';
import { createLauncherMounter } from '../mounting/mount-launchers';
import { mountPanel } from '../mounting/mount-panel';
import { copyText } from '../platform/clipboard';
import { reportDiagnostic } from '../platform/diagnostics';
import {
  addRuntimeMessageListener,
  isOwnExtensionPage,
  localSettingsArea,
  onSettingsStorageChanged,
} from '../platform/extension-browser';
import { createRuntimeHandler, toMessageListener } from '../platform/runtime-messaging';
import { createSettingsStore, parseStoredSettings, SETTINGS_STORAGE_KEY } from '../platform/settings-store';
import { createRandomIds, systemClock } from '../platform/system-dependencies';
import type { MailPageProvider } from './mail-provider';

export interface ExtensionSessionOptions {
  readonly ctx: ContentScriptContext;
  readonly provider: MailPageProvider;
  /** Bu aşamanın normal derlemesinde `null`; geliştirmede örnek sonuç kaynağı. */
  readonly processor: TextProcessor | null;
}

/**
 * Sayfa oturumunun bütün parçalarını bir araya getirir. Bağımlılıklar fonksiyon
 * parametreleriyle verilir; bağımlılık enjeksiyonu kütüphanesi veya uygulama
 * çapında olay otobüsü kullanılmaz.
 */
export async function createExtensionSession(options: ExtensionSessionOptions): Promise<() => void> {
  const { ctx, provider, processor } = options;
  const { connector } = provider;
  const ids = createRandomIds();
  const settingsStore = createSettingsStore(localSettingsArea);
  const settings = shallowRef((await settingsStore.read()).settings);

  const store = createSessionStore(
    createSession({
      sessionId: ids.next(),
      thread: connector.getPageState().activeThread,
      defaults: { targetLanguage: settings.value.targetLanguage, tone: settings.value.tone },
    }),
  );
  const actions = createActionController({ store, connector, processor, clock: systemClock, ids });
  const applier = createApplyController({ store, connector, ids, copyText });
  const panel = createPanelController({ store, connector, actions, ids, settings: () => settings.value });

  const text = computed(() => textFor(settings.value.uiLanguage).ui);
  const theme = computed(() => settings.value.theme);
  const siteEnabled = computed(() => settings.value.siteEnabled[provider.siteId]);

  const mountedPanel = await mountPanel(ctx, {
    session: { store, connector, panel, actions, applier, processingAvailable: processor !== null },
    text,
    theme,
  });
  const stopPanelVisibility = panel.onVisibilityChange((open) => mountedPanel.setOpen(open));

  const launchers = createLauncherMounter(ctx, {
    text,
    theme,
    onOpen(anchor, opener) {
      mountedPanel.rememberOpener(opener);
      panel.open(
        anchor.target.kind === 'thread'
          ? { origin: 'thread-launcher', thread: anchor.target.thread }
          : { origin: 'composer-launcher', composer: anchor.target.composer, quickAction: null },
      );
    },
    onQuickAction(anchor, operation, opener) {
      if (anchor.target.kind === 'composer') {
        mountedPanel.rememberOpener(opener);
        panel.open({ origin: 'composer-launcher', composer: anchor.target.composer, quickAction: operation });
      }
    },
  });

  const syncLaunchers = () => {
    const isReady = connector.getPageState().support === 'ready';
    if (siteEnabled.value && isReady) {
      launchers.sync(provider.locateLauncherAnchors());
    } else {
      launchers.removeAll();
    }
  };
  const stopConnector = connector.subscribe((event) => {
    if (
      event.type === 'page-state-changed' ||
      event.type === 'composer-added' ||
      event.type === 'composer-removed'
    ) {
      syncLaunchers();
    }
  });
  const stopSiteWatch = watch(siteEnabled, syncLaunchers);
  syncLaunchers();

  const stopSettings = onSettingsStorageChanged(SETTINGS_STORAGE_KEY, (raw) => {
    // Varsayılan dil/ton değişikliği açık çalışmayı değiştirmez; sonraki oturumda kullanılır.
    settings.value = parseStoredSettings(raw).settings;
  });

  const handleMessage = createRuntimeHandler(
    {
      GET_PAGE_STATUS: async () => {
        const { support } = connector.getPageState();
        return ok({
          providerId: connector.providerId,
          support: siteEnabled.value ? support : 'disabled',
          canOpenPanel: siteEnabled.value && support === 'ready',
          panelOpen: panel.isOpen(),
        });
      },
      GET_SELECTOR_REPORT: async () => ok({ entries: [...provider.selectorReport()] }),
      OPEN_PANEL: async () => {
        // Yalnızca paneli açar; e-posta veya sonuç metni taşımaz, yazma yapamaz.
        const canOpen = siteEnabled.value && connector.getPageState().support === 'ready';
        if (canOpen) {
          mountedPanel.rememberOpener(null);
          panel.open({ origin: 'toolbar' });
        }
        return ok({ opened: canOpen });
      },
    },
    { context: 'content-script', isAllowedSender: isOwnExtensionPage },
  );
  const stopMessages = addRuntimeMessageListener(toMessageListener(handleMessage));

  const dispose = () => {
    stopMessages();
    stopSettings();
    stopConnector();
    stopPanelVisibility();
    stopSiteWatch();
    actions.dispose();
    panel.dispose();
    launchers.removeAll();
    mountedPanel.remove();
    connector.dispose();
  };
  ctx.onInvalidated(() => {
    reportDiagnostic({ code: 'EXTENSION_RELOADED', area: 'content-script' });
    dispose();
  });
  return dispose;
}
