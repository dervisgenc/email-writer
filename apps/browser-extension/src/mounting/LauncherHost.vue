<script setup lang="ts">
import type { Theme } from '@email-writer/contracts';
import { LauncherButton, provideUiText, type UiText } from '@email-writer/ui';
import type { Ref } from 'vue';

const props = defineProps<{
  text: Readonly<Ref<UiText>>;
  theme: Readonly<Ref<Theme>>;
  showQuickActions: boolean;
}>();

const emit = defineEmits<{
  open: [];
  'quick-action': [operation: 'revise' | 'translate'];
}>();

provideUiText(props.text);
</script>

<template>
  <div class="ew-root" :data-theme="theme.value">
    <LauncherButton
      :show-quick-actions="showQuickActions"
      @open="emit('open')"
      @quick-action="emit('quick-action', $event)"
    />
  </div>
</template>
