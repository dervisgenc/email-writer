<script setup lang="ts">
import { useUiText } from '../i18n';
import AppIcon from './AppIcon.vue';

const emit = defineEmits<{
  open: [];
}>();

const text = useUiText();
</script>

<template>
  <button
    type="button"
    class="ew-thread-launcher"
    :title="`${text.threadLauncher.tooltip}\n${text.threadLauncher.dragHint}`"
    :aria-label="text.threadLauncher.tooltip"
    @click="emit('open')"
  >
    <AppIcon name="sparkle" />
    <span>{{ text.threadLauncher.label }}</span>
  </button>
</template>
