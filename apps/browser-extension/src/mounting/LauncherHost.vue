<script setup lang="ts">
import type { LanguageCode, Operation } from '@email-writer/contracts';
import { isSessionBusy } from '@email-writer/core';
import {
  ComposeToolbar,
  provideUiText,
  ThreadLauncher,
  type QuickActionRequest,
  type UiText,
} from '@email-writer/ui';
import { computed, onScopeDispose, shallowRef, type Ref } from 'vue';

import type { PanelSessionDependencies } from '../composables/use-panel-session';
import type { PanelSurface } from '../controllers/panel-controller';
import type { Appearance } from './appearance';
import InlineAssistantHost from './InlineAssistantHost.vue';
import type { LauncherTarget } from './mount-launchers';

const props = defineProps<{
  text: Readonly<Ref<UiText>>;
  appearance: Readonly<Ref<Appearance>>;
  target: LauncherTarget;
  session: PanelSessionDependencies;
  surface: Readonly<Ref<PanelSurface>>;
  defaultLanguage: Readonly<Ref<LanguageCode>>;
}>();

const emit = defineEmits<{
  'open-thread': [];
  'quick-action': [request: QuickActionRequest];
  'open-panel': [];
}>();

provideUiText(props.text);

const state = shallowRef(props.session.store.getState());
const unsubscribe = props.session.store.subscribe((next) => {
  state.value = next;
});
onScopeDispose(unsubscribe);

/** Kart yalnızca işlemin başlatıldığı taslağın araç çubuğunda açılır. */
const cardOpen = computed(() => {
  const surface = props.surface.value;
  return (
    props.target.kind === 'composer' &&
    surface.kind === 'inline' &&
    surface.composerKey === props.target.composerKey
  );
});

const busyOperation = computed<Operation | null>(() =>
  cardOpen.value && isSessionBusy(state.value) ? state.value.form.operation : null,
);
</script>

<template>
  <div class="ew-root" :data-theme="appearance.value.theme" :style="appearance.value.style">
    <ThreadLauncher v-if="target.kind === 'thread'" @open="emit('open-thread')" />
    <div v-else class="ew-compose-anchor">
      <InlineAssistantHost v-if="cardOpen" :session="session" />
      <ComposeToolbar
        :is-reply="target.isReply"
        :busy-operation="busyOperation"
        :default-language="defaultLanguage.value"
        @quick-action="emit('quick-action', $event)"
        @open-panel="emit('open-panel')"
      />
    </div>
  </div>
</template>
