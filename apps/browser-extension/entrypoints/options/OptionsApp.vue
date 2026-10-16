<script setup lang="ts">
import {
  DEFAULT_SETTINGS,
  MAX_FAVORITE_LANGUAGES,
  MAX_WRITING_INSTRUCTIONS,
  THEMES,
  TONES,
  UI_LANGUAGE_NAMES,
  UI_LANGUAGE_PREFERENCES,
  type ErrorCode,
  type Settings,
  type SettingsChanges,
  type TargetLanguage,
} from '@email-writer/contracts';
import { AppIcon, LanguagePicker, languageLabel, provideUiText } from '@email-writer/ui';
import { computed, onMounted, onUnmounted, ref, shallowRef, useId, watchEffect } from 'vue';

import { textFor, uiLanguageFor } from '../../src/locales';
import { onSettingsStorageChanged } from '../../src/platform/extension-browser';
import { fetchSettings, patchSettings } from '../../src/platform/extension-client';
import { parseStoredSettings, SETTINGS_STORAGE_KEY } from '../../src/platform/settings-store';
import AiSettings from './AiSettings.vue';

const settings = shallowRef<Settings>(DEFAULT_SETTINGS);
const draft = ref<SettingsChanges>({});
const saving = ref(false);
const message = ref<{ kind: 'success' | 'info' | 'error'; text: string } | null>(null);
const ids = {
  ui: useId(),
  language: useId(),
  favorites: useId(),
  addLanguage: useId(),
  instructions: useId(),
  instructionsHint: useId(),
  tone: useId(),
  theme: useId(),
  languages: useId(),
  writing: useId(),
  preferences: useId(),
  privacy: useId(),
};

const current = computed<Settings>(() => ({ ...settings.value, ...draft.value }));
const text = computed(() => textFor(current.value.uiLanguage));
const locale = computed(() => text.value.ui.locale);
provideUiText(computed(() => text.value.ui));
const errorText = (code: ErrorCode) => text.value.ui.errors[code];
const dirty = computed(() => Object.keys(draft.value).length > 0);
const addPicker = ref<InstanceType<typeof LanguagePicker> | null>(null);

// Ekran okuyucular ve doğru büyük harf dönüşümü için sayfanın dili arayüz diliyle aynı tutulur.
watchEffect(() => {
  document.documentElement.lang = uiLanguageFor(current.value.uiLanguage);
});

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

const label = (language: TargetLanguage) => languageLabel(language, locale.value);
const favoritesFull = computed(() => current.value.favoriteLanguages.length >= MAX_FAVORITE_LANGUAGES);

function addFavorite(language: TargetLanguage): void {
  const favorites = current.value.favoriteLanguages;
  if (favorites.includes(language) || favorites.length >= MAX_FAVORITE_LANGUAGES) return;
  change('favoriteLanguages', [...favorites, language]);
}

function removeFavorite(language: TargetLanguage): void {
  change(
    'favoriteLanguages',
    current.value.favoriteLanguages.filter((item) => item !== language),
  );
}

function setInstructions(value: string): void {
  change('writingInstructions', value.slice(0, MAX_WRITING_INSTRUCTIONS));
}

/** Örnek cümle talimata yeni bir satır olarak eklenir; zaten varsa eklenmez. */
function addExample(example: string): void {
  const value = current.value.writingInstructions;
  if (value.includes(example)) return;
  setInstructions(value.trim() === '' ? example : `${value.trimEnd()}\n${example}`);
}

function discard(): void {
  draft.value = {};
  message.value = null;
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
  <div class="ew-root options-shell" :data-theme="current.theme">
    <main class="options">
      <header class="options__header">
        <span class="options__mark"><AppIcon name="sparkle" :size="24" /></span>
        <div>
          <h1 class="options__title">{{ text.options.title }}</h1>
          <p class="options__subtitle">{{ text.options.subtitle }}</p>
        </div>
      </header>

      <AiSettings :text="text.ui" />

      <form class="options__form" @submit.prevent="save">
        <section class="ew-settings-card" :aria-labelledby="ids.languages">
          <header class="ew-settings-card__header">
            <span class="ew-settings-card__icon"><AppIcon name="translate" :size="18" /></span>
            <div class="ew-settings-card__heading">
              <h2 :id="ids.languages" class="ew-settings-card__title">{{ text.options.languagesTitle }}</h2>
              <p class="ew-settings-card__description">{{ text.options.languagesDescription }}</p>
            </div>
          </header>
          <div class="options__grid">
            <div class="options__field">
              <label class="ew-label" :for="ids.ui">{{ text.options.uiLanguage }}</label>
              <select
                :id="ids.ui"
                class="ew-select"
                :value="current.uiLanguage"
                @change="change('uiLanguage', selectValue($event, UI_LANGUAGE_PREFERENCES))"
              >
                <option v-for="code in UI_LANGUAGE_PREFERENCES" :key="code" :value="code">
                  {{ code === 'auto' ? text.options.uiLanguageAuto : UI_LANGUAGE_NAMES[code] }}
                </option>
              </select>
            </div>
            <div class="options__field">
              <label class="ew-label" :for="ids.language">{{ text.options.targetLanguage }}</label>
              <LanguagePicker
                :id="ids.language"
                :model-value="current.targetLanguage"
                :preferred="current.favoriteLanguages"
                @update:model-value="change('targetLanguage', $event)"
              />
            </div>
          </div>
          <p class="ew-muted">{{ text.options.targetLanguageHint }}</p>
          <div class="options__field">
            <span :id="ids.favorites" class="ew-label">{{ text.options.favoriteLanguages }}</span>
            <ul class="options__chips" :aria-labelledby="ids.favorites">
              <li v-for="language in current.favoriteLanguages" :key="language" class="options__chip">
                <span>{{ label(language) }}</span>
                <button
                  type="button"
                  class="options__chip-remove"
                  :aria-label="text.options.removeLanguage(label(language))"
                  :title="text.options.removeLanguage(label(language))"
                  @click="removeFavorite(language)"
                >
                  <AppIcon name="close" :size="12" />
                </button>
              </li>
            </ul>
            <div class="options__add">
              <label class="ew-visually-hidden" :for="ids.addLanguage">{{ text.options.addLanguage }}</label>
              <LanguagePicker
                :id="ids.addLanguage"
                ref="addPicker"
                :model-value="null"
                :exclude="current.favoriteLanguages"
                :disabled="favoritesFull"
                clear-on-commit
                @update:model-value="addFavorite"
              />
              <button type="button" class="ew-btn" :disabled="favoritesFull" @click="addPicker?.commit()">
                <AppIcon name="plus" :size="14" />
                {{ text.options.addLanguage }}
              </button>
            </div>
            <p class="ew-muted">
              {{ favoritesFull ? text.options.favoritesFull : text.options.favoriteLanguagesHint }}
            </p>
          </div>
        </section>

        <section class="ew-settings-card" :aria-labelledby="ids.writing">
          <header class="ew-settings-card__header">
            <span class="ew-settings-card__icon"><AppIcon name="edit" :size="18" /></span>
            <div class="ew-settings-card__heading">
              <h2 :id="ids.writing" class="ew-settings-card__title">{{ text.options.instructionsTitle }}</h2>
              <p class="ew-settings-card__description">{{ text.options.instructionsDescription }}</p>
            </div>
          </header>
          <div class="options__field">
            <div class="options__label-row">
              <label class="ew-label" :for="ids.instructions">{{ text.options.instructionsLabel }}</label>
              <span class="ew-muted">
                {{
                  text.options.instructionsCount(current.writingInstructions.length, MAX_WRITING_INSTRUCTIONS)
                }}
              </span>
            </div>
            <textarea
              :id="ids.instructions"
              class="ew-textarea options__instructions"
              rows="4"
              dir="auto"
              :maxlength="MAX_WRITING_INSTRUCTIONS"
              :placeholder="text.options.instructionsPlaceholder"
              :aria-describedby="ids.instructionsHint"
              :value="current.writingInstructions"
              @input="setInstructions(($event.target as HTMLTextAreaElement).value)"
            />
            <div :id="ids.instructionsHint" class="options__examples">
              <span class="ew-muted">{{ text.options.instructionsExamplesLabel }}</span>
              <button
                v-for="example in text.options.instructionsExamples"
                :key="example"
                type="button"
                class="ew-chip"
                :disabled="current.writingInstructions.includes(example)"
                @click="addExample(example)"
              >
                <AppIcon name="plus" :size="12" />
                {{ example }}
              </button>
            </div>
          </div>
        </section>

        <section class="ew-settings-card" :aria-labelledby="ids.preferences">
          <header class="ew-settings-card__header">
            <span class="ew-settings-card__icon"><AppIcon name="sliders" :size="18" /></span>
            <div class="ew-settings-card__heading">
              <h2 :id="ids.preferences" class="ew-settings-card__title">
                {{ text.options.preferencesTitle }}
              </h2>
              <p class="ew-settings-card__description">{{ text.options.preferencesDescription }}</p>
            </div>
          </header>
          <div class="options__grid">
            <div class="options__field">
              <label class="ew-label" :for="ids.tone">{{ text.options.tone }}</label>
              <select
                :id="ids.tone"
                class="ew-select"
                :value="current.tone"
                @change="change('tone', selectValue($event, TONES))"
              >
                <option v-for="tone in TONES" :key="tone" :value="tone">
                  {{ text.ui.options.tones[tone] }}
                </option>
              </select>
            </div>
            <div class="options__field">
              <span :id="ids.theme" class="ew-label">{{ text.options.theme }}</span>
              <div class="options__segmented" role="radiogroup" :aria-labelledby="ids.theme">
                <label
                  v-for="theme in THEMES"
                  :key="theme"
                  class="options__segment"
                  :data-checked="current.theme === theme"
                >
                  <input
                    type="radio"
                    class="ew-visually-hidden"
                    :name="ids.theme"
                    :value="theme"
                    :checked="current.theme === theme"
                    @change="change('theme', theme)"
                  />
                  {{ text.options.themeOptions[theme] }}
                </label>
              </div>
            </div>
          </div>
          <p class="ew-muted">{{ text.options.defaultsNote }} {{ text.options.themeHint }}</p>
          <label class="options__switch-row">
            <span class="options__switch-text">
              <span class="options__switch-label">{{ text.options.siteEnabled }}</span>
              <span class="ew-muted">{{ text.options.siteEnabledHint }}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              class="options__switch"
              :checked="current.siteEnabled['outlook-web']"
              @change="change('siteEnabled', { 'outlook-web': checkedValue($event) })"
            />
          </label>
        </section>

        <div v-if="dirty || message" class="options__savebar" :data-kind="message?.kind ?? 'info'">
          <p class="options__message" :data-kind="message?.kind ?? 'info'" role="status">
            {{ message ? message.text : text.options.unsaved }}
          </p>
          <button
            v-if="dirty"
            type="button"
            class="ew-btn ew-btn--subtle"
            :disabled="saving"
            @click="discard"
          >
            {{ text.ui.source.cancel }}
          </button>
          <button v-if="dirty" type="submit" class="ew-btn ew-btn--primary" :disabled="saving">
            {{ saving ? text.options.saving : text.options.save }}
          </button>
        </div>
      </form>

      <section class="ew-settings-card" :aria-labelledby="ids.privacy">
        <header class="ew-settings-card__header">
          <span class="ew-settings-card__icon"><AppIcon name="shield" :size="18" /></span>
          <div class="ew-settings-card__heading">
            <h2 :id="ids.privacy" class="ew-settings-card__title">{{ text.options.privacyTitle }}</h2>
            <p class="ew-settings-card__description">{{ text.options.privacyDescription }}</p>
          </div>
        </header>
        <ul class="options__privacy">
          <li v-for="(point, index) in text.options.privacyPoints" :key="index">
            <AppIcon name="check" :size="16" />
            <span>{{ point }}</span>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<style>
body {
  margin: 0;
}

.options-shell {
  min-height: 100vh;
  background: var(--ew-color-surface);
}

.options {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 760px;
  margin: 0 auto;
  padding: 32px 20px 48px;
}

.options__header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 4px 4px 8px;
}

.options__mark {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--ew-color-accent), var(--ew-color-accent-hover));
  color: var(--ew-color-on-accent);
  box-shadow: var(--ew-shadow-4);
}

.options__title {
  margin: 0;
  font-size: 22px;
  line-height: 28px;
  font-weight: 600;
}

.options__subtitle {
  margin: 2px 0 0;
  color: var(--ew-color-muted);
  font-size: 13px;
}

.options__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 16px;
}

.options__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.options__segmented {
  display: inline-flex;
  align-self: flex-start;
  padding: 3px;
  border: 1px solid var(--ew-color-border);
  border-radius: 10px;
  background: var(--ew-color-surface);
}

.options__segment {
  padding: 5px 14px;
  border-radius: 7px;
  color: var(--ew-color-muted);
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--ew-duration) var(--ew-ease),
    color var(--ew-duration) var(--ew-ease);
}

.options__segment:hover {
  color: var(--ew-color-text);
}

.options__segment[data-checked='true'] {
  background: var(--ew-color-bg);
  color: var(--ew-color-text);
  box-shadow: var(--ew-shadow-2);
}

.options__segment:has(input:focus-visible) {
  outline: 2px solid var(--ew-color-focus);
  outline-offset: 1px;
}

.options__switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--ew-color-surface);
  cursor: pointer;
}

.options__switch-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.options__switch-label {
  font-weight: 600;
}

.options__switch {
  flex: none;
  position: relative;
  width: 40px;
  height: 20px;
  margin: 0;
  border: 1px solid var(--ew-color-border-strong);
  border-radius: 999px;
  background: var(--ew-color-bg);
  appearance: none;
  cursor: pointer;
  transition:
    background var(--ew-duration) var(--ew-ease),
    border-color var(--ew-duration) var(--ew-ease);
}

.options__switch::before {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--ew-color-muted);
  transition: transform var(--ew-duration) var(--ew-ease);
}

.options__switch:checked {
  border-color: var(--ew-color-accent);
  background: var(--ew-color-accent);
}

.options__switch:checked::before {
  background: var(--ew-color-on-accent);
  transform: translateX(20px);
}

.options__form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.options__label-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.options__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.options__chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 28px;
  padding: 0 4px 0 10px;
  border: 1px solid var(--ew-color-border);
  border-radius: 999px;
  background: var(--ew-color-surface);
  font-size: 13px;
}

.options__chip-remove {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ew-color-muted);
}

.options__chip-remove:hover {
  background: var(--ew-color-surface-hover);
  color: var(--ew-color-text);
}

.options__add {
  display: flex;
  gap: 8px;
  max-width: 420px;
}

.options__instructions {
  min-height: 96px;
  resize: vertical;
}

.options__examples {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.options__examples .ew-chip {
  white-space: normal;
  text-align: left;
}

.options__examples .ew-chip:disabled {
  opacity: 0.5;
  cursor: default;
}

/* Kaydedilmemiş değişiklik olduğunda sayfanın altında kalan kaydetme çubuğu. */
.options__savebar {
  position: sticky;
  bottom: 16px;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 10px 16px;
  border: 1px solid var(--ew-color-border);
  border-radius: 12px;
  background: var(--ew-color-bg);
  box-shadow: var(--ew-shadow-16);
  animation: ew-rise var(--ew-duration) var(--ew-ease);
}

.options__message {
  margin: 0 auto 0 0;
  font-size: 13px;
}

.options__message[data-kind='info'] {
  color: var(--ew-color-muted);
}

.options__message[data-kind='error'] {
  color: var(--ew-color-danger);
}

.options__message[data-kind='success'] {
  color: var(--ew-color-success);
}

.options__privacy {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.options__privacy li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  line-height: 19px;
}

.options__privacy .ew-icon {
  margin-top: 1px;
  color: var(--ew-color-success);
}

@media (max-width: 640px) {
  .options {
    padding: 20px 16px 32px;
  }
}
</style>
