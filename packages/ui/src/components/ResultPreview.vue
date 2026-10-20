<script setup lang="ts">
import type { ErrorCode } from '@writehand/contracts';
import { useId } from 'vue';

import { useUiText } from '../i18n';
import type { PreviewView } from '../view-model';
import AppIcon from './AppIcon.vue';
import RichPreview from './RichPreview.vue';

defineProps<{
  preview: PreviewView;
  error: ErrorCode | null;
  disabled: boolean;
  canRegenerate: boolean;
}>();

const emit = defineEmits<{
  'preview-change': [text: string];
  regenerate: [];
}>();

const text = useUiText();
const fieldId = useId();
const errorId = useId();
</script>

<template>
  <section class="ew-section ew-preview">
    <div class="ew-section__header">
      <label class="ew-section__title" :for="fieldId">{{ text.preview.title }}</label>
      <!-- Sample results never pass as a real revision or translation. -->
      <span v-if="preview.sample" class="ew-badge ew-badge--sample">{{ text.preview.sampleLabel }}</span>
      <span class="ew-card__spacer" />
      <button
        type="button"
        class="ew-btn ew-btn--subtle ew-btn--small"
        :disabled="!canRegenerate"
        @click="emit('regenerate')"
      >
        <AppIcon name="refresh" :size="14" />
        {{ text.preview.regenerate }}
      </button>
    </div>
    <p v-if="preview.stale" class="ew-alert ew-alert--warning">{{ text.preview.stale }}</p>
    <p v-else-if="preview.unchanged" class="ew-muted">{{ text.preview.unchanged }}</p>
    <RichPreview
      :id="fieldId"
      size="panel"
      :text="preview.text"
      :label="text.preview.title"
      :disabled="disabled"
      :invalid="error !== null"
      :described-by="error !== null ? errorId : undefined"
      @change="emit('preview-change', $event)"
    />
    <p v-if="error !== null" :id="errorId" class="ew-field-error">{{ text.errors[error] }}</p>
  </section>
</template>
