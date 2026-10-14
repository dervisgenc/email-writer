import '@email-writer/ui/styles/panel.css';

import { DEFAULT_SETTINGS } from '@email-writer/contracts';
import { createApp } from 'vue';

import { textFor } from '../../src/locales';
import { fetchSettings } from '../../src/platform/extension-client';
import PopupApp from './PopupApp.vue';

async function start(): Promise<void> {
  const result = await fetchSettings();
  const settings = result.ok ? result.value.settings : DEFAULT_SETTINGS;
  document.documentElement.lang = settings.uiLanguage;
  createApp(PopupApp, { text: textFor(settings.uiLanguage), theme: settings.theme }).mount('#app');
}

void start();
