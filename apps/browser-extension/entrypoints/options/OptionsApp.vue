<script setup lang="ts">
import {
  DEFAULT_SETTINGS,
  LANGUAGE_CODES,
  THEMES,
  TONES,
  UI_LANGUAGES,
  type ErrorCode,
  type Settings,
  type SettingsChanges,
} from '@email-writer/contracts';
import { computed, onMounted, onUnmounted, ref, shallowRef, useId } from 'vue';

import { textFor } from '../../src/locales';
import { onSettingsStorageChanged } from '../../src/platform/extension-browser';
import { fetchSettings, patchSettings } from '../../src/platform/extension-client';
import { parseStoredSettings, SETTINGS_STORAGE_KEY } from '../../src/platform/settings-store';

const settings = shallowRef<Settings>(DEFAULT_SETTINGS);
const draft = ref<SettingsChanges>({});
const saving = ref(false);
const message = ref<{ kind: 'success' | 'info' | 'error'; text: string } | null>(null);
const ids = { ui: useId(), language: useId(), tone: useId(), theme: useId() };

const current = computed<Settings>(() => ({ ...settings.value, ...draft.value }));
const text = computed(() => textFor(current.value.uiLanguage));
const errorText = (code: ErrorCode) => text.value.ui.errors[code];

let stopWatching: (() => void) | null = null;

onMounted(async () => {
  const result = await fetchSettings();
  if (result.ok) {
    settings.value = result.value.settings;
  } else {
    message.value = { kind: 'error', text: errorText(result.error.code) };
  }
  // Başka bir ekranda yapılan değişiklikler buraya yansır.
  stopWatching = onSettingsStorageChanged(SETTINGS_STORAGE_KEY, (raw) => {
    settings.value = parseStoredSettings(raw).settings;
  });
});
onUnmounted(() => stopWatching?.());

function change<K extends keyof SettingsChanges>(key: K, value: SettingsChanges[K]): void {
  draft.value = { ...draft.value, [key]: value };
  message.value = null;
}

function selectValue<T extends string>(event: Event, allowed: readonly T[]): T | undefined {
  const target = event.target;
  const value = target !== null && 'value' in target ? target.value : undefined;
  return allowed.find((item) => item === value);
}

function checkedValue(event: Event): boolean {
  const target = event.target;
  return target !== null && 'checked' in target && target.checked === true;
}

async function save(): Promise<void> {
  saving.value = true;
  // Yalnızca değiştirilen alanlar ve bilinen sürüm gönderilir.
  const result = await patchSettings(settings.value.revision, draft.value);
  saving.value = false;
  if (!result.ok) {
    message.value = { kind: 'error', text: errorText(result.error.code) };
    return;
  }
  settings.value = result.value.settings;
  draft.value = {};
  message.value =
    result.value.status === 'saved'
      ? { kind: 'success', text: text.value.options.saved }
      : {
          kind: 'info',
          text: errorText(result.value.status === 'conflict' ? 'SETTINGS_CONFLICT' : 'SETTINGS_INVALID'),
        };
}
</script>

<template>
  <main class="ew-root options" :data-theme="current.theme">
    <h1>{{ text.options.title }}</h1>
    <form class="options__form" @submit.prevent="save">
      <div class="options__field">
        <label class="ew-label" :for="ids.ui">{{ text.options.uiLanguage }}</label>
        <select
          :id="ids.ui"
          class="ew-select"
          :value="current.uiLanguage"
          @change="change('uiLanguage', selectValue($event, UI_LANGUAGES))"
        >
          <option v-for="code in UI_LANGUAGES" :key="code" :value="code">
            {{ text.options.uiLanguages[code] }}
          </option>
        </select>
      </div>
      <div class="options__field">
        <label class="ew-label" :for="ids.language">{{ text.options.targetLanguage }}</label>
        <select
          :id="ids.language"
          class="ew-select"
          :value="current.targetLanguage"
          @change="change('targetLanguage', selectValue($event, LANGUAGE_CODES))"
        >
          <option v-for="code in LANGUAGE_CODES" :key="code" :value="code">
            {{ text.ui.options.languages[code] }}
          </option>
        </select>
      </div>
      <div class="options__field">
        <label class="ew-label" :for="ids.tone">{{ text.options.tone }}</label>
        <select
          :id="ids.tone"
          class="ew-select"
          :value="current.tone"
          @change="change('tone', selectValue($event, TONES))"
        >
          <option v-for="tone in TONES" :key="tone" :value="tone">{{ text.ui.options.tones[tone] }}</option>
        </select>
      </div>
      <p class="ew-muted">{{ text.options.defaultsNote }}</p>
      <div class="options__field">
        <label class="ew-label" :for="ids.theme">{{ text.options.theme }}</label>
        <select
          :id="ids.theme"
          class="ew-select"
          :value="current.theme"
          @change="change('theme', selectValue($event, THEMES))"
        >
          <option v-for="theme in THEMES" :key="theme" :value="theme">
            {{ text.options.themes[theme] }}
          </option>
        </select>
      </div>
      <label class="options__toggle">
        <input
          type="checkbox"
          :checked="current.siteEnabled['outlook-web']"
          @change="change('siteEnabled', { 'outlook-web': checkedValue($event) })"
        />
        {{ text.options.siteEnabled }}
      </label>
      <p class="ew-muted">{{ text.options.storageNote }}</p>
      <div class="options__actions">
        <button
          type="submit"
          class="ew-button ew-button--primary"
          :disabled="saving || Object.keys(draft).length === 0"
        >
          {{ saving ? text.options.saving : text.options.save }}
        </button>
        <p v-if="message" class="options__message" :data-kind="message.kind" role="status">
          {{ message.text }}
        </p>
      </div>
    </form>
  </main>
</template>

<style>
body {
  margin: 0;
}

.options {
  min-height: 100vh;
  max-width: 560px;
  margin: 0 auto;
  padding: 24px 16px;
  background: var(--ew-color-bg);
}

.options__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.options__toggle {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.options__actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.options__message {
  margin: 0;
}

.options__message[data-kind='error'] {
  color: var(--ew-color-error);
}

.options__message[data-kind='success'] {
  color: var(--ew-color-success);
}
</style>
