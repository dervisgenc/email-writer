<script setup lang="ts">
import { type Operation } from '@email-writer/contracts';
import { computed } from 'vue';

import { useUiText } from '../i18n';
import AppIcon from './AppIcon.vue';
import type { IconName } from './icons';

const props = defineProps<{
  operation: Operation;
  /** İlk sekme: konuşmaya yanıt veya yeni e-posta yazma. */
  writeOperation: 'reply' | 'compose';
  disabled: boolean;
}>();

const emit = defineEmits<{
  'operation-change': [operation: Operation];
}>();

const text = useUiText();

/** Talimatla yazma en sık kullanılan işlem olduğu için başta gösterilir. */
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
