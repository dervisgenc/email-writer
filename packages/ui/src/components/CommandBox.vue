<script setup lang="ts">
import AppIcon from './AppIcon.vue';

/** A command to paste into a terminal, with a "Copy" button. Writing to the clipboard is up to the page. */
defineProps<{ command: string; label: string; copyLabel: string; copiedLabel: string; copied: boolean }>();
const emit = defineEmits<{ copy: [command: string] }>();
</script>

<template>
  <div class="ew-command">
    <pre class="ew-command__text" :aria-label="label" tabindex="0">{{ command }}</pre>
    <button type="button" class="ew-btn ew-command__copy" @click="emit('copy', command)">
      <AppIcon :name="copied ? 'check' : 'copy'" :size="16" />
      <span role="status">{{ copied ? copiedLabel : copyLabel }}</span>
    </button>
  </div>
</template>
