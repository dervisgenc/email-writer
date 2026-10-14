<script setup lang="ts">
import type { ErrorCode } from '@email-writer/contracts';
import { useId } from 'vue';

import { useUiText } from '../i18n';
import { inputValue } from '../input-value';
import type { PreviewView } from '../view-model';

defineProps<{
  preview: PreviewView;
  error: ErrorCode | null;
  disabled: boolean;
}>();

const emit = defineEmits<{
  'preview-change': [text: string];
}>();

const text = useUiText();
const fieldId = useId();
const errorId = useId();
</script>

<template>
  <section class="ew-preview">
    <div class="ew-preview__header">
      <label class="ew-section-title" :for="fieldId">{{ text.preview.title }}</label>
      <!-- Örnek sonuçlar gerçek düzeltme veya çeviri gibi gösterilmez. -->
      <span v-if="preview.sample" class="ew-badge ew-badge--sample">{{ text.preview.sampleLabel }}</span>
    </div>
    <p v-if="preview.stale" class="ew-warning">{{ text.preview.stale }}</p>
    <p v-else-if="preview.unchanged" class="ew-muted">{{ text.preview.unchanged }}</p>
    <textarea
      :id="fieldId"
      class="ew-textarea"
      dir="auto"
      rows="8"
      :value="preview.text"
      :disabled="disabled"
      :aria-invalid="error !== null"
      :aria-describedby="error !== null ? errorId : undefined"
      @input="emit('preview-change', inputValue($event))"
    />
    <p v-if="error !== null" :id="errorId" class="ew-field-error">{{ text.errors[error] }}</p>
  </section>
</template>
