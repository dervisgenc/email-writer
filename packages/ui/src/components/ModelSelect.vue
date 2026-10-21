<script setup lang="ts">
import type { AiModel } from '@writehand/contracts';
import { computed, useId } from 'vue';

import type { AiText } from '../ai-text';
import { inputValue } from '../input-value';

/** Model choice. When the provider marks free models, they are listed in their own group. */
const props = defineProps<{
  models: readonly AiModel[];
  selected: string | null;
  text: AiText;
  disabled: boolean;
}>();
const emit = defineEmits<{ select: [model: string] }>();
const id = useId();
const groups = computed(() =>
  props.models.some((model) => model.free !== undefined)
    ? [
        { label: props.text.freeModels, models: props.models.filter((model) => model.free === true) },
        { label: props.text.paidModels, models: props.models.filter((model) => model.free !== true) },
      ].filter((group) => group.models.length > 0)
    : null,
);
</script>

<template>
  <div class="ew-ai-settings__field ew-ai-settings__model">
    <label class="ew-label" :for="id">{{ text.model }}</label>
    <select
      :id="id"
      class="ew-select"
      :value="selected ?? ''"
      :disabled="disabled"
      @change="emit('select', inputValue($event))"
    >
      <option disabled value="">{{ text.model }}</option>
      <template v-if="groups">
        <optgroup v-for="group in groups" :key="group.label" :label="group.label">
          <option v-for="model in group.models" :key="model.id" :value="model.id">{{ model.label }}</option>
        </optgroup>
      </template>
      <template v-else>
        <option v-for="model in models" :key="model.id" :value="model.id">{{ model.label }}</option>
      </template>
    </select>
  </div>
</template>
