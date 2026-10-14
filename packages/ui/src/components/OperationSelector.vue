<script setup lang="ts">
import { OPERATIONS, type Operation } from '@email-writer/contracts';

import { useUiText } from '../i18n';

defineProps<{
  operation: Operation;
  disabled: boolean;
}>();

const emit = defineEmits<{
  'operation-change': [operation: Operation];
}>();

const text = useUiText();
</script>

<template>
  <div class="ew-operations" role="radiogroup" :aria-label="text.panelTitle">
    <button
      v-for="item in OPERATIONS"
      :key="item"
      type="button"
      role="radio"
      class="ew-operations__item"
      :aria-checked="item === operation"
      :disabled="disabled"
      @click="emit('operation-change', item)"
    >
      {{ text.operations[item] }}
    </button>
  </div>
</template>
