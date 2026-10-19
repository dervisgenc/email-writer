<script setup lang="ts">
import {
  HOST_BROWSER_NAMES,
  HOST_OPERATING_SYSTEM_NAMES,
  type HostUpdateCheck,
} from '@email-writer/contracts';
import { computed, useId } from 'vue';

import type { HelperText, HelperView } from '../helper';
import AppIcon from './AppIcon.vue';
import CommandBox from './CommandBox.vue';

/**
 * Ayarlardaki yardımcı uygulama kartı: bağlantı durumu, sürüm, güncelleme ve kaldırma.
 * Durum ve sonuçlar sayfadan gelir; kart yalnızca olay yayar.
 */
const props = defineProps<{
  view: HelperView;
  text: HelperText;
  /** Son güncelleme denetimi; denetim kapalıysa veya henüz yapılmadıysa null. */
  update: HostUpdateCheck | null;
  updating: boolean;
  updatedTo: string | null;
  error: string | null;
  checkUpdates: boolean;
  uninstallCommand: string;
  uninstallFlag: string;
  copied: boolean;
}>();
const emit = defineEmits<{
  grant: [];
  update: [];
  'open-wizard': [];
  'toggle-updates': [enabled: boolean];
  copy: [command: string];
}>();
const titleId = useId();

const tone = computed(() =>
  props.view.kind === 'connected' ? 'success' : props.view.kind === 'checking' ? 'neutral' : 'warning',
);
const info = computed(() => (props.view.kind === 'connected' ? props.view.info : null));
const system = computed(() =>
  info.value ? `${HOST_OPERATING_SYSTEM_NAMES[info.value.os]} (${info.value.arch})` : '',
);
const browserNames = computed(
  () => info.value?.browsers.map((name) => HOST_BROWSER_NAMES[name]).join(', ') ?? '',
);
/** Sürümünü bildiren eski bir yardımcı uygulama kendini güncelleyebilir. */
const canUpdate = computed(
  () =>
    (props.view.kind === 'outdated' && props.view.version !== null) ||
    (info.value !== null && !info.value.development && props.update?.available === true),
);
</script>

<template>
  <section class="ew-settings-card ew-helper" :aria-labelledby="titleId">
    <header class="ew-settings-card__header">
      <span class="ew-settings-card__icon"><AppIcon name="laptop" :size="18" /></span>
      <div class="ew-settings-card__heading">
        <h2 :id="titleId" class="ew-settings-card__title">{{ text.title }}</h2>
        <p class="ew-settings-card__description">{{ text.description }}</p>
      </div>
      <div class="ew-settings-card__aside">
        <span class="ew-status-pill" :data-tone="tone" role="status">{{ text.states[view.kind] }}</span>
      </div>
    </header>
    <p v-if="error" class="ew-alert ew-alert--error" role="alert">
      <AppIcon name="warning" :size="16" />
      <span>{{ error }}</span>
    </p>

    <template v-if="view.kind === 'permission'">
      <p class="ew-muted">{{ text.permissionBody }}</p>
      <div class="ew-actions">
        <button type="button" class="ew-btn ew-btn--primary" @click="emit('grant')">{{ text.grant }}</button>
      </div>
    </template>
    <template v-else-if="view.kind === 'missing' || view.kind === 'outdated'">
      <p class="ew-muted">{{ view.kind === 'missing' ? text.missingBody : text.outdatedBody }}</p>
    </template>
    <template v-else-if="info">
      <p class="ew-helper__meta">
        <span>{{ text.version(info.version, system) }}</span>
        <span v-if="browserNames">{{ text.browsers(browserNames) }}</span>
        <span v-if="info.development">{{ text.development }}</span>
      </p>
    </template>

    <div v-if="updatedTo || canUpdate || (info && !info.development && update)" class="ew-helper__update">
      <p v-if="updatedTo" class="ew-progress" data-tone="success" role="status">
        <AppIcon name="check" :size="16" />
        <span>{{ text.updated(updatedTo) }}</span>
      </p>
      <template v-else-if="canUpdate">
        <p class="ew-progress" data-tone="warning">
          <AppIcon name="info" :size="16" />
          <span>{{ update?.latest ? text.updateAvailable(update.latest) : text.outdatedBody }}</span>
        </p>
        <button type="button" class="ew-btn ew-btn--primary" :disabled="updating" @click="emit('update')">
          <span v-if="updating" class="ew-spinner" aria-hidden="true" />
          {{ updating ? text.updating : text.update }}
        </button>
      </template>
      <p v-else class="ew-progress" data-tone="success">
        <AppIcon name="check" :size="16" />
        <span>{{ text.upToDate }}</span>
      </p>
    </div>

    <label v-if="view.kind === 'connected' && !info?.development" class="ew-switch-row">
      <span class="ew-switch-row__text">
        <span class="ew-switch-row__label">{{ text.checkUpdates }}</span>
        <span class="ew-muted">{{ text.checkUpdatesHint }}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        class="ew-switch"
        :checked="checkUpdates"
        @change="emit('toggle-updates', ($event.target as HTMLInputElement).checked)"
      />
    </label>

    <div class="ew-actions">
      <button
        type="button"
        class="ew-btn"
        :class="{ 'ew-btn--primary': view.kind === 'missing' || (view.kind === 'outdated' && !canUpdate) }"
        @click="emit('open-wizard')"
      >
        <AppIcon name="sparkle" :size="14" />
        {{ text.openWizard }}
      </button>
    </div>

    <details v-if="view.kind !== 'permission'" class="ew-disclosure">
      <summary><AppIcon name="chevronRight" :size="14" />{{ text.uninstallTitle }}</summary>
      <div class="ew-disclosure__body">
        <p class="ew-muted">{{ text.uninstallBody(uninstallFlag) }}</p>
        <CommandBox
          :command="uninstallCommand"
          :label="text.uninstallTitle"
          :copy-label="text.copy"
          :copied-label="text.copied"
          :copied="copied"
          @copy="emit('copy', $event)"
        />
      </div>
    </details>
  </section>
</template>
