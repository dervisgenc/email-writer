<script setup lang="ts">
import {
  DEFAULT_SETTINGS,
  HELPER_DELETE_DATA_OPTION,
  helperInstallCommand,
  helperUninstallCommand,
  HOST_OPERATING_SYSTEM_NAMES,
  HOST_OPERATING_SYSTEMS,
  REPOSITORY_URL,
  type HostOperatingSystem,
  type Settings,
} from '@writehand/contracts';
import { AppIcon, CommandBox, ExtensionPage, provideUiText, StepList } from '@writehand/ui';
import { computed, onMounted, onUnmounted, ref, shallowRef, useId, watch, watchEffect } from 'vue';

import { OUTLOOK_WEB_START } from '../../src/bootstrap/supported-sites';
import { useHelper } from '../../src/composables/use-helper';
import { textFor, uiLanguageFor } from '../../src/locales';
import AiSettings from '../../src/pages/AiSettings.vue';
import { copyText } from '../../src/platform/clipboard';
import {
  extensionId,
  onSettingsStorageChanged,
  openOptionsPage,
  operatingSystem,
} from '../../src/platform/extension-browser';
import { fetchSettings, generateText } from '../../src/platform/extension-client';
import { parseStoredSettings, SETTINGS_STORAGE_KEY } from '../../src/platform/settings-store';

/**
 * Welcome wizard: why the helper app is needed, its one-command install, the connection
 * method, and a trial run on a made-up email. Opens on first install; can be reopened from settings.
 */
const settings = shallowRef<Settings>(DEFAULT_SETTINGS);
const text = computed(() => textFor(settings.value.uiLanguage));
const welcome = computed(() => text.value.welcome);
provideUiText(computed(() => text.value.ui));
const ids = { system: useId(), intro: useId(), install: useId(), tryIt: useId() };

const step = ref(0);
const furthest = ref(0);
watch(step, (value) => (furthest.value = Math.max(furthest.value, value)));
const helper = useHelper();
const system = ref<HostOperatingSystem>('linux');
const aiReady = ref(false);
const copied = ref<string | null>(null);
const trial = ref<
  | { readonly state: 'idle' | 'running' }
  | { readonly state: 'done'; readonly result: string }
  | { readonly state: 'failed'; readonly error: string }
>({ state: 'idle' });

const connected = computed(() => helper.view.value.kind === 'connected');
const done = computed(() =>
  [furthest.value > 0, connected.value, aiReady.value, trial.value.state === 'done'].flatMap(
    (complete, index) => (complete ? [index] : []),
  ),
);
const installCommand = computed(() => helperInstallCommand(system.value, extensionId()));
const uninstallCommand = computed(() => helperUninstallCommand(system.value));

watchEffect(() => {
  document.documentElement.lang = uiLanguageFor(settings.value.uiLanguage);
  document.title = welcome.value.title;
});

let stopWatching: (() => void) | null = null;
onMounted(async () => {
  const result = await fetchSettings();
  if (result.ok) settings.value = result.value.settings;
  stopWatching = onSettingsStorageChanged(SETTINGS_STORAGE_KEY, (raw) => {
    settings.value = parseStoredSettings(raw).settings;
  });
  system.value = await operatingSystem();
  await helper.refresh();
});
onUnmounted(() => stopWatching?.());

async function copy(command: string) {
  if ((await copyText({ text: command, html: null })).ok) copied.value = command;
}

async function tryRevision() {
  trial.value = { state: 'running' };
  const result = await generateText({
    operation: 'revise',
    source: welcome.value.tryIt.sample,
    instruction: '',
    targetLanguage: null,
    tone: 'neutral',
    standingInstructions: '',
    format: 'plain',
    refinement: null,
    messages: [],
  });
  trial.value = result.ok
    ? { state: 'done', result: result.value.text }
    : { state: 'failed', error: text.value.ui.errors[result.error.code] };
}
</script>

<template>
  <ExtensionPage :theme="settings.theme" :title="welcome.title" :subtitle="welcome.subtitle">
    <StepList
      :label="welcome.stepsLabel"
      :steps="welcome.steps"
      :current="step"
      :furthest="furthest"
      :done="done"
      @select="step = $event"
    />

    <section v-if="step === 0" class="ew-settings-card" :aria-labelledby="ids.intro">
      <header class="ew-settings-card__header">
        <span class="ew-settings-card__icon"><AppIcon name="sparkle" :size="18" /></span>
        <div class="ew-settings-card__heading">
          <h2 :id="ids.intro" class="ew-settings-card__title">{{ welcome.intro.title }}</h2>
          <p class="ew-settings-card__description">{{ welcome.intro.lead }}</p>
        </div>
      </header>
      <ul class="ew-points">
        <li v-for="reason in welcome.intro.reasons" :key="reason">
          <AppIcon name="check" :size="16" />
          <span>{{ reason }}</span>
        </li>
      </ul>
      <a class="ew-ai-guide__link" :href="REPOSITORY_URL" target="_blank" rel="noopener noreferrer">
        {{ welcome.intro.source }}
        <AppIcon name="external" :size="14" />
      </a>
      <div class="ew-split">
        <div class="ew-split__column">
          <h3 class="ew-ai-guide__label">{{ welcome.intro.doesTitle }}</h3>
          <ul class="ew-points">
            <li v-for="item in welcome.intro.does" :key="item">
              <AppIcon name="check" :size="16" />
              <span>{{ item }}</span>
            </li>
          </ul>
        </div>
        <div class="ew-split__column">
          <h3 class="ew-ai-guide__label">{{ welcome.intro.doesNotTitle }}</h3>
          <ul class="ew-points" data-kind="never">
            <li v-for="item in welcome.intro.doesNot" :key="item">
              <AppIcon name="close" :size="16" />
              <span>{{ item }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section v-else-if="step === 1" class="ew-settings-card" :aria-labelledby="ids.install">
      <header class="ew-settings-card__header">
        <span class="ew-settings-card__icon"><AppIcon name="laptop" :size="18" /></span>
        <div class="ew-settings-card__heading">
          <h2 :id="ids.install" class="ew-settings-card__title">{{ welcome.install.title }}</h2>
          <p class="ew-settings-card__description">{{ welcome.install.lead }}</p>
        </div>
      </header>
      <div v-if="helper.view.value.kind === 'permission'" class="ew-progress" data-tone="warning">
        <AppIcon name="info" :size="16" />
        <span class="ew-alert__body">
          {{ text.ui.helper.permissionBody }}
          <button type="button" class="ew-btn ew-btn--primary ew-btn--small" @click="helper.grant">
            {{ text.ui.helper.grant }}
          </button>
        </span>
      </div>
      <div class="ew-ai-settings__field">
        <span :id="ids.system" class="ew-label">{{ welcome.install.system }}</span>
        <div class="ew-segmented" role="radiogroup" :aria-labelledby="ids.system">
          <label
            v-for="os in HOST_OPERATING_SYSTEMS"
            :key="os"
            class="ew-segmented__option"
            :data-checked="system === os"
          >
            <input
              type="radio"
              class="ew-visually-hidden"
              :name="ids.system"
              :value="os"
              :checked="system === os"
              @change="system = os"
            />
            {{ HOST_OPERATING_SYSTEM_NAMES[os] }}
          </label>
        </div>
      </div>
      <CommandBox
        :command="installCommand"
        :label="welcome.install.command"
        :copy-label="text.ui.helper.copy"
        :copied-label="text.ui.helper.copied"
        :copied="copied === installCommand"
        @copy="copy"
      />
      <p class="ew-muted">{{ welcome.install.terminal[system] }}</p>
      <p
        class="ew-progress"
        :data-tone="connected ? 'success' : helper.view.value.kind === 'outdated' ? 'warning' : undefined"
        role="status"
      >
        <template v-if="helper.view.value.kind === 'connected'">
          <AppIcon name="check" :size="16" />
          <span>{{ welcome.install.connected(helper.view.value.info.version) }}</span>
        </template>
        <template v-else-if="helper.view.value.kind === 'outdated'">
          <AppIcon name="warning" :size="16" />
          <span>{{ text.ui.helper.outdatedBody }}</span>
        </template>
        <template v-else>
          <span class="ew-spinner" aria-hidden="true" />
          <span>{{ welcome.install.waiting }}</span>
        </template>
      </p>
      <details class="ew-disclosure">
        <summary><AppIcon name="chevronRight" :size="14" />{{ welcome.install.whatTitle }}</summary>
        <div class="ew-disclosure__body">
          <ul class="ew-points">
            <li v-for="item in welcome.install.what" :key="item">
              <AppIcon name="check" :size="16" />
              <span>{{ item }}</span>
            </li>
          </ul>
        </div>
      </details>
      <details class="ew-disclosure">
        <summary><AppIcon name="chevronRight" :size="14" />{{ text.ui.helper.uninstallTitle }}</summary>
        <div class="ew-disclosure__body">
          <p class="ew-muted">{{ text.ui.helper.uninstallBody(HELPER_DELETE_DATA_OPTION[system]) }}</p>
          <CommandBox
            :command="uninstallCommand"
            :label="text.ui.helper.uninstallTitle"
            :copy-label="text.ui.helper.copy"
            :copied-label="text.ui.helper.copied"
            :copied="copied === uninstallCommand"
            @copy="copy"
          />
        </div>
      </details>
    </section>

    <AiSettings v-else-if="step === 2" :text="text.ui" :guide="false" @ready="aiReady = $event" />

    <section v-else class="ew-settings-card" :aria-labelledby="ids.tryIt">
      <header class="ew-settings-card__header">
        <span class="ew-settings-card__icon"><AppIcon name="proofread" :size="18" /></span>
        <div class="ew-settings-card__heading">
          <h2 :id="ids.tryIt" class="ew-settings-card__title">{{ welcome.tryIt.title }}</h2>
          <p class="ew-settings-card__description">{{ welcome.tryIt.lead }}</p>
        </div>
      </header>
      <div class="ew-ai-settings__field">
        <span class="ew-label">{{ welcome.tryIt.sampleLabel }}</span>
        <p class="ew-sample">{{ welcome.tryIt.sample }}</p>
      </div>
      <div class="ew-actions">
        <button
          type="button"
          class="ew-btn"
          :class="{ 'ew-btn--primary': trial.state !== 'done' }"
          :disabled="trial.state === 'running'"
          @click="tryRevision"
        >
          <span v-if="trial.state === 'running'" class="ew-spinner" aria-hidden="true" />
          <AppIcon v-else name="proofread" :size="16" />
          {{ trial.state === 'running' ? welcome.tryIt.running : welcome.tryIt.run }}
        </button>
      </div>
      <p v-if="trial.state === 'failed'" class="ew-alert ew-alert--error" role="alert">
        <AppIcon name="warning" :size="16" />
        <span>{{ trial.error }}</span>
      </p>
      <template v-if="trial.state === 'done'">
        <div class="ew-ai-settings__field">
          <span class="ew-label">{{ welcome.tryIt.resultLabel }}</span>
          <p class="ew-sample" data-kind="result">{{ trial.result }}</p>
        </div>
        <p class="ew-progress" data-tone="success" role="status">
          <AppIcon name="check" :size="16" />
          <span>{{ welcome.tryIt.success }}</span>
        </p>
        <div class="ew-actions">
          <a
            class="ew-btn ew-btn--primary"
            :href="OUTLOOK_WEB_START.work"
            target="_blank"
            rel="noopener noreferrer"
          >
            <AppIcon name="mail" :size="16" />
            {{ welcome.tryIt.openOutlook }}
          </a>
          <a class="ew-btn" :href="OUTLOOK_WEB_START.personal" target="_blank" rel="noopener noreferrer">
            {{ welcome.tryIt.personalOutlook }}
          </a>
          <button type="button" class="ew-btn ew-btn--subtle" @click="openOptionsPage">
            {{ welcome.tryIt.openSettings }}
          </button>
        </div>
      </template>
    </section>

    <nav class="ew-wizard-nav">
      <button v-if="step > 0" type="button" class="ew-btn" @click="step--">
        {{ welcome.back }}
      </button>
      <button v-if="step < 3" type="button" class="ew-btn ew-btn--primary" @click="step++">
        {{ welcome.next }}
      </button>
    </nav>
  </ExtensionPage>
</template>
