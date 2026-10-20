<script setup lang="ts">
import {
  REFINEMENTS,
  RICH_REFINEMENTS,
  MAX_REFINEMENT_LENGTH,
  type RefinementKind,
} from '@writehand/contracts';
import { computed, ref, useId } from 'vue';

import { useUiText } from '../i18n';
import AppIcon from './AppIcon.vue';
import type { IconName } from './icons';

/**
 * Refines a finished result: preset directions (table, list, chart, shorten, tone) and a
 * request the user types. Directions that need formatting are offered only when `rich` is set.
 */
const props = defineProps<{ rich: boolean; disabled: boolean }>();
const emit = defineEmits<{ refine: [kind: RefinementKind]; 'refine-custom': [instruction: string] }>();

const text = useUiText();
const inputId = useId();
const request = ref('');

const ICONS: Record<RefinementKind, IconName> = {
  table: 'table',
  list: 'list',
  chart: 'chart',
  shorter: 'shorten',
  formal: 'edit',
  friendly: 'sparkle',
};
const kinds = computed(() => REFINEMENTS.filter((kind) => props.rich || !RICH_REFINEMENTS.includes(kind)));

function submit(): void {
  const instruction = request.value.trim();
  if (instruction === '' || props.disabled) return;
  request.value = '';
  emit('refine-custom', instruction);
}
</script>

<template>
  <div class="ew-refine" role="group" :aria-label="text.refine.title">
    <div class="ew-refine__chips">
      <button
        v-for="kind in kinds"
        :key="kind"
        type="button"
        class="ew-chip ew-refine__chip"
        :disabled="disabled"
        @click="emit('refine', kind)"
      >
        <AppIcon :name="ICONS[kind]" :size="14" />
        {{ text.refine.kinds[kind] }}
      </button>
    </div>
    <form class="ew-refine__custom" @submit.prevent="submit">
      <label class="ew-visually-hidden" :for="inputId">{{ text.refine.customLabel }}</label>
      <input
        :id="inputId"
        v-model="request"
        class="ew-input"
        type="text"
        dir="auto"
        autocomplete="off"
        :maxlength="MAX_REFINEMENT_LENGTH"
        :placeholder="text.refine.customPlaceholder"
        :disabled="disabled"
      />
      <button
        type="submit"
        class="ew-btn ew-btn--subtle ew-btn--icon ew-btn--small"
        :aria-label="text.refine.customSubmit"
        :title="text.refine.customSubmit"
        :disabled="disabled || request.trim() === ''"
      >
        <AppIcon name="send" :size="14" />
      </button>
    </form>
  </div>
</template>
