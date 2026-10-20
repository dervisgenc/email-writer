<script setup lang="ts">
import { type Operation } from '@writehand/contracts';
import { computed } from 'vue';

import { useUiText } from '../i18n';
import AppIcon from './AppIcon.vue';
import type { IconName } from './icons';

const props = defineProps<{
  operation: Operation;
  /** The first tab: reply to the conversation or write a new email. */
  writeOperation: 'reply' | 'compose';
  disabled: boolean;
}>();

const emit = defineEmits<{
  'operation-change': [operation: Operation];
}>();

const text = useUiText();

/** Writing from an instruction is the most common operation, so it comes first. */
const items = computed<readonly { operation: Operation; icon: IconName }[]>(() => [
  { operation: props.writeOperation, icon: 'sparkle' },
  { operation: 'revise', icon: 'proofread' },
  { operation: 'translate', icon: 'translate' },
]);
</script>

<template>
  <div class="ew-segmented" role="radiogroup" :aria-label="text.panelTitle">
    <button
      v-for="item in items"
      :key="item.operation"
      type="button"
      role="radio"
      class="ew-segmented__item"
      :aria-checked="item.operation === operation"
      :disabled="disabled"
      @click="emit('operation-change', item.operation)"
    >
      <AppIcon :name="item.icon" />
      <span>{{ text.operations[item.operation] }}</span>
    </button>
  </div>
</template>
