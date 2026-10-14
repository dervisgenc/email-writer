<script setup lang="ts">
import type { LanguageCode, Operation, Tone } from '@email-writer/contracts';
import { LANGUAGE_CODES, TONES } from '@email-writer/contracts';
import { computed, onMounted, useId, useTemplateRef } from 'vue';

import { useUiText } from '../i18n';
import { inputChecked, inputValue } from '../input-value';
import type { PanelView, SourceReloadKind } from '../view-model';
import ApplyControls from './ApplyControls.vue';
import ContextInspector from './ContextInspector.vue';
import OperationSelector from './OperationSelector.vue';
import ResultPreview from './ResultPreview.vue';
import SourceEditor from './SourceEditor.vue';
import StatusNotice from './StatusNotice.vue';

const props = defineProps<{
  view: PanelView;
  limits: { source: number; instruction: number };
}>();

const emit = defineEmits<{
  close: [];
  'operation-change': [operation: Operation];
  'source-change': [text: string];
  'instruction-change': [text: string];
  'reload-source': [kind: SourceReloadKind, confirmReplace: boolean];
  'cancel-reload': [];
  'language-change': [language: LanguageCode];
  'tone-change': [tone: Tone];
  'use-conversation-change': [enabled: boolean];
  'context-selection-change': [messageKey: string, included: boolean];
  'block-include': [messageKey: string, blockIndex: number];
  'reply-target-change': [messageKey: string];
  'refresh-context': [];
  prepare: [];
  'preview-change': [text: string];
  apply: [];
  copy: [];
  undo: [];
  'bind-target': [mode: 'replace-existing-reply' | 'use-open-composer'];
  retry: [];
  dismiss: [];
  'start-new-work': [];
}>();

const text = useUiText();
const root = useTemplateRef<HTMLElement>('root');
const titleId = useId();

// Açılışta odak panele taşınır; işlem sırasında bir düğme devre dışı kalsa da
// odak panelin içinde kalır ve Escape çalışır.
onMounted(() => root.value?.focus({ preventScroll: true }));
const languageId = useId();
const toneId = useId();

const isBusy = computed(() => props.view.status.kind === 'busy' && props.view.status.activity !== 'reading');

const targetLabel = computed(() => {
  const { target } = props.view;
  const labels = text.value.target;
  if (target.kind === 'composer') {
    return target.isReply ? labels.replyComposer : labels.composer;
  }
  return target.kind === 'received-message' ? labels.receivedMessage : labels.none;
});

function onLanguageChange(event: Event): void {
  const value = inputValue(event);
  const language = LANGUAGE_CODES.find((code) => code === value);
  if (language !== undefined) {
    emit('language-change', language);
  }
}

function onToneChange(event: Event): void {
  const value = inputValue(event);
  const tone = TONES.find((item) => item === value);
  if (tone !== undefined) {
    emit('tone-change', tone);
  }
}
</script>

<template>
  <!-- Panel sayfanın kullanımını engellemez; bu yüzden aria-modal verilmez ve odak hapsedilmez. -->
  <div
    ref="root"
    class="ew-panel"
    role="dialog"
    tabindex="-1"
    :aria-labelledby="titleId"
    @keydown.escape="emit('close')"
  >
    <header class="ew-panel__header">
      <h2 :id="titleId" class="ew-panel__title">{{ text.panelTitle }}</h2>
      <button
        type="button"
        class="ew-icon-button"
        :aria-label="text.close"
        :title="text.close"
        @click="emit('close')"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16">
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
    </header>

    <div class="ew-panel__body">
      <p class="ew-target">
        <strong>{{ text.target.label }}:</strong> {{ targetLabel }}
      </p>
      <p v-if="view.staleNotice !== null" class="ew-warning" role="alert">
        {{ text.errors[view.staleNotice] }}
      </p>
      <div v-if="view.canStartNewWork" class="ew-confirm">
        <span>{{ text.newWork.offer }}</span>
        <button type="button" class="ew-button ew-button--small" @click="emit('start-new-work')">
          {{ text.newWork.start }}
        </button>
      </div>

      <OperationSelector
        :operation="view.operation"
        :disabled="isBusy"
        @operation-change="emit('operation-change', $event)"
      />

      <SourceEditor
        :operation="view.operation"
        :source="view.source"
        :source-error="view.fieldErrors.source ?? null"
        :instruction-error="view.fieldErrors.instruction ?? null"
        :limits="limits"
        :disabled="isBusy"
        @source-change="emit('source-change', $event)"
        @instruction-change="emit('instruction-change', $event)"
        @reload-source="(kind, confirm) => emit('reload-source', kind, confirm)"
        @cancel-reload="emit('cancel-reload')"
      />

      <div class="ew-options">
        <div v-if="view.options.showTargetLanguage" class="ew-options__field">
          <label class="ew-label" :for="languageId">{{ text.options.targetLanguage }}</label>
          <select
            :id="languageId"
            class="ew-select"
            :value="view.options.targetLanguage"
            :disabled="isBusy"
            :aria-invalid="view.fieldErrors.targetLanguage !== undefined"
            @change="onLanguageChange"
          >
            <option v-for="code in LANGUAGE_CODES" :key="code" :value="code">
              {{ text.options.languages[code] }}
            </option>
          </select>
        </div>
        <div v-if="view.options.showTone" class="ew-options__field">
          <label class="ew-label" :for="toneId">{{ text.options.tone }}</label>
          <select
            :id="toneId"
            class="ew-select"
            :value="view.options.tone"
            :disabled="isBusy"
            @change="onToneChange"
          >
            <option v-for="tone in TONES" :key="tone" :value="tone">{{ text.options.tones[tone] }}</option>
          </select>
        </div>
        <label v-if="view.options.showUseConversation" class="ew-options__toggle">
          <input
            type="checkbox"
            :checked="view.options.useConversation"
            :disabled="isBusy"
            @change="emit('use-conversation-change', inputChecked($event))"
          />
          {{ text.options.useConversation }}
        </label>
      </div>

      <ContextInspector
        v-if="view.context.required"
        :context="view.context"
        :disabled="isBusy"
        @context-selection-change="(key, included) => emit('context-selection-change', key, included)"
        @block-include="(key, index) => emit('block-include', key, index)"
        @reply-target-change="emit('reply-target-change', $event)"
        @refresh-context="emit('refresh-context')"
      />

      <div class="ew-prepare">
        <button
          type="button"
          class="ew-button ew-button--primary"
          :disabled="!view.prepare.canPrepare || view.prepare.isPreparing"
          @click="emit('prepare')"
        >
          {{ text.prepareButton[view.operation] }}
        </button>
        <!-- Metin işleme bağlı değilse düğmenin neden kullanılamadığı açıklanır. -->
        <p v-if="view.prepare.blocker !== null" class="ew-muted">{{ text.errors[view.prepare.blocker] }}</p>
      </div>

      <template v-if="view.preview !== null">
        <ResultPreview
          :preview="view.preview"
          :error="view.fieldErrors.preview ?? null"
          :disabled="view.apply.isApplying"
          @preview-change="emit('preview-change', $event)"
        />
        <ApplyControls
          :apply="view.apply"
          @apply="emit('apply')"
          @copy="emit('copy')"
          @undo="emit('undo')"
          @bind-target="emit('bind-target', $event)"
        />
      </template>
    </div>

    <StatusNotice :status="view.status" @retry="emit('retry')" @dismiss="emit('dismiss')" />
  </div>
</template>
