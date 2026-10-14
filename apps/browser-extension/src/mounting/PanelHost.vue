<script setup lang="ts">
import type { Theme } from '@email-writer/contracts';
import { provideUiText, WriterPanel, type UiText } from '@email-writer/ui';
import { toRef, type Ref } from 'vue';

import { usePanelSession, type PanelSessionDependencies } from '../composables/use-panel-session';

const props = defineProps<{
  session: PanelSessionDependencies;
  text: Readonly<Ref<UiText>>;
  theme: Readonly<Ref<Theme>>;
  open: Readonly<Ref<boolean>>;
}>();

provideUiText(props.text);
const { view, handlers, limits } = usePanelSession(props.session);
const isOpen = toRef(() => props.open.value);
</script>

<template>
  <div class="ew-root" :data-theme="theme.value">
    <WriterPanel
      v-if="isOpen"
      :view="view"
      :limits="limits"
      @close="handlers.close"
      @start-new-work="handlers.startNewWork"
      @operation-change="handlers.operationChange"
      @source-change="handlers.sourceChange"
      @instruction-change="handlers.instructionChange"
      @reload-source="handlers.reloadSource"
      @cancel-reload="handlers.cancelReload"
      @language-change="handlers.languageChange"
      @tone-change="handlers.toneChange"
      @use-conversation-change="handlers.useConversationChange"
      @context-selection-change="handlers.contextSelectionChange"
      @block-include="handlers.blockInclude"
      @reply-target-change="handlers.replyTargetChange"
      @refresh-context="handlers.refreshContext"
      @prepare="handlers.prepare"
      @preview-change="handlers.previewChange"
      @apply="handlers.apply"
      @copy="handlers.copy"
      @undo="handlers.undo"
      @bind-target="handlers.bindTarget"
      @retry="handlers.retry"
      @dismiss="handlers.dismiss"
    />
  </div>
</template>
