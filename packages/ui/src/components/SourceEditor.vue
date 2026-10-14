<script setup lang="ts">
import type { ErrorCode, Operation } from '@email-writer/contracts';
import { computed, useId } from 'vue';

import { useUiText } from '../i18n';
import { inputValue } from '../input-value';
import type { SourceReloadKind, SourceView } from '../view-model';

const props = defineProps<{
  operation: Operation;
  source: SourceView;
  sourceError: ErrorCode | null;
  instructionError: ErrorCode | null;
  limits: { source: number; instruction: number };
  disabled: boolean;
}>();

const emit = defineEmits<{
  'source-change': [text: string];
  'instruction-change': [text: string];
  'reload-source': [kind: SourceReloadKind, confirmReplace: boolean];
  'cancel-reload': [];
}>();

const text = useUiText();
const sourceId = useId();
const instructionId = useId();
const sourceErrorId = useId();
const instructionErrorId = useId();

const isReply = computed(() => props.operation === 'reply');
</script>

<template>
  <section class="ew-source">
    <div class="ew-source__meta">
      <span class="ew-source__origin">
        {{ text.source.originLabel }}: {{ text.source.origins[source.origin] }}
        <span v-if="source.edited" class="ew-badge">{{ text.source.edited }}</span>
      </span>
      <span class="ew-source__actions">
        <button
          v-if="source.canLoadSelection"
          type="button"
          class="ew-link"
          :disabled="disabled || source.isReading"
          @click="emit('reload-source', 'selection', false)"
        >
          {{ text.source.loadSelection }}
        </button>
        <button
          v-if="source.canLoadDraft"
          type="button"
          class="ew-link"
          :disabled="disabled || source.isReading"
          @click="emit('reload-source', 'draft', false)"
        >
          {{ text.source.loadDraft }}
        </button>
        <button
          v-if="source.canLoadReceivedSelection"
          type="button"
          class="ew-link"
          :disabled="disabled || source.isReading"
          @click="emit('reload-source', 'received-message', false)"
        >
          {{ text.source.loadReceivedSelection }}
        </button>
      </span>
    </div>

    <div v-if="source.pendingReplace !== null" class="ew-confirm" role="alert">
      <span>{{ text.source.confirmReplace }}</span>
      <button
        type="button"
        class="ew-button ew-button--small"
        @click="emit('reload-source', source.pendingReplace, true)"
      >
        {{ text.source.confirm }}
      </button>
      <button type="button" class="ew-link" @click="emit('cancel-reload')">
        {{ text.source.cancel }}
      </button>
    </div>

    <template v-if="isReply">
      <label class="ew-label" :for="instructionId">{{ text.source.instructionLabel }}</label>
      <textarea
        :id="instructionId"
        class="ew-textarea"
        dir="auto"
        rows="4"
        :value="source.instruction"
        :placeholder="text.source.placeholders.reply"
        :disabled="disabled"
        :aria-invalid="instructionError !== null"
        :aria-describedby="instructionError !== null ? instructionErrorId : undefined"
        @input="emit('instruction-change', inputValue($event))"
      />
      <p class="ew-field-meta">{{ text.source.characters(source.instruction.length, limits.instruction) }}</p>
      <p v-if="instructionError !== null" :id="instructionErrorId" class="ew-field-error">
        {{ text.errors[instructionError] }}
      </p>
    </template>

    <template v-else>
      <label class="ew-label" :for="sourceId">{{ text.source.textLabel }}</label>
      <textarea
        :id="sourceId"
        class="ew-textarea"
        dir="auto"
        rows="6"
        :value="source.text"
        :placeholder="text.source.placeholders[operation]"
        :disabled="disabled"
        :aria-invalid="sourceError !== null"
        :aria-describedby="sourceError !== null ? sourceErrorId : undefined"
        @input="emit('source-change', inputValue($event))"
      />
      <p class="ew-field-meta">{{ text.source.characters(source.text.length, limits.source) }}</p>
      <p v-if="sourceError !== null" :id="sourceErrorId" class="ew-field-error">
        {{ text.errors[sourceError] }}
      </p>
    </template>
  </section>
</template>
