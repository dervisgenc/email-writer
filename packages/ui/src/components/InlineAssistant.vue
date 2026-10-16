<script setup lang="ts">
import {
  isInstructionOperation,
  type ErrorCode,
  type RefinementKind,
  type TargetLanguage,
} from '@email-writer/contracts';
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue';

import { useUiText } from '../i18n';
import { languageLabel } from '../languages';
import type { PanelView } from '../view-model';
import AppIcon from './AppIcon.vue';
import type { IconName } from './icons';
import LanguagePicker from './LanguagePicker.vue';
import RefineBar from './RefineBar.vue';
import RichPreview from './RichPreview.vue';

const props = defineProps<{
  view: PanelView;
}>();

const emit = defineEmits<{
  close: [];
  expand: [];
  'submit-instruction': [text: string];
  'translate-to': [language: TargetLanguage];
  refine: [kind: RefinementKind];
  'refine-custom': [instruction: string];
  'preview-change': [text: string];
  apply: [];
  copy: [];
  undo: [];
  retry: [];
  dismiss: [];
}>();

const text = useUiText();
const titleId = useId();
const instructionId = useId();
const instructionField = useTemplateRef<HTMLTextAreaElement>('instructionField');
const instruction = ref(props.view.source.instruction);
const languageId = useId();
const languageRow = useTemplateRef<HTMLElement>('languageRow');
const language = ref<TargetLanguage>(props.view.options.targetLanguage);

const OPERATION_ICONS: Record<PanelView['operation'], IconName> = {
  reply: 'sparkle',
  compose: 'sparkle',
  revise: 'proofread',
  translate: 'translate',
};

const operation = computed(() => props.view.operation);
const status = computed(() => props.view.status);
const isPreparing = computed(() => status.value.kind === 'busy' && status.value.activity !== 'applying');
const showInstruction = computed(
  () => isInstructionOperation(operation.value) && props.view.preview === null && !isPreparing.value,
);
const includedContext = computed(() => props.view.context.messages.filter((m) => m.included).length);
/** Çeviride dil satırı her zaman görünür; sonuç geldikten sonra başka dile çevirmeye de yarar. */
const showLanguage = computed(() => operation.value === 'translate' && !isPreparing.value);
const awaitsLanguage = computed(() => showLanguage.value && props.view.preview === null);
const translatedLabel = computed(() => languageLabel(props.view.options.targetLanguage, text.value.locale));

/** Kartta gösterilecek tek bir sorun: işlem hatası, alan hatası veya hazırlığı engelleyen durum. */
const problem = computed<ErrorCode | null>(() => {
  if (status.value.kind === 'error' || status.value.kind === 'info') {
    return status.value.code;
  }
  const { fieldErrors, prepare, preview } = props.view;
  const field = fieldErrors.source ?? fieldErrors.instruction ?? fieldErrors.context ?? fieldErrors.preview;
  if (field !== undefined) {
    return field;
  }
  return preview === null && !isPreparing.value ? prepare.blocker : null;
});

watch(
  () => props.view.source.instruction,
  (value) => {
    instruction.value = value;
  },
);

watch(
  () => props.view.options.targetLanguage,
  (value) => {
    language.value = value;
  },
);

// "Başka bir dil…" ile açılınca dil alanı yazmaya hazır gelir.
watch(
  awaitsLanguage,
  async (waiting) => {
    if (waiting) {
      await nextTick();
      languageRow.value?.querySelector('input')?.focus({ preventScroll: true });
    }
  },
  { immediate: true },
);

function translate(): void {
  if (props.view.prepare.canPrepare) emit('translate-to', language.value);
}

// Bağlam okunurken talimat alanı gizlidir; alan göründüğü anda yazmaya hazır olur.
watch(
  showInstruction,
  async (visible) => {
    if (visible) {
      await nextTick();
      instructionField.value?.focus({ preventScroll: true });
    }
  },
  { immediate: true },
);

function submit(): void {
  if (instruction.value.trim() !== '' && props.view.prepare.canPrepare) {
    emit('submit-instruction', instruction.value);
  }
}

/** Enter gönderir, Shift+Enter yeni satır ekler. */
function onInstructionKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    submit();
  }
}

function onEscape(event: KeyboardEvent): void {
  event.stopPropagation();
  emit('close');
}
</script>

<template>
  <section class="ew-card" role="dialog" :aria-labelledby="titleId" @keydown.escape="onEscape">
    <header class="ew-card__header">
      <AppIcon class="ew-card__icon" :name="OPERATION_ICONS[operation]" />
      <h2 :id="titleId" class="ew-card__title">{{ text.inline.titles[operation] }}</h2>
      <span v-if="operation === 'translate' && view.preview !== null" class="ew-badge">
        {{ translatedLabel }}
      </span>
      <!-- Örnek sonuçlar gerçek sonuç gibi gösterilmez; tam açıklama ipucunda ve ekran okuyucuda. -->
      <span
        v-if="view.preview?.sample"
        class="ew-badge ew-badge--sample"
        :title="text.preview.sampleLabel"
        :aria-label="text.preview.sampleLabel"
        >{{ text.preview.sampleShort }}</span
      >
      <span class="ew-card__spacer" />
      <button
        type="button"
        class="ew-btn ew-btn--subtle ew-btn--icon ew-btn--small"
        :aria-label="text.inline.openPanel"
        :title="text.inline.openPanel"
        @click="emit('expand')"
      >
        <AppIcon name="openPanel" />
      </button>
      <button
        type="button"
        class="ew-btn ew-btn--subtle ew-btn--icon ew-btn--small"
        :aria-label="text.close"
        :title="text.close"
        @click="emit('close')"
      >
        <AppIcon name="close" />
      </button>
    </header>
    <slot name="connection" />

    <!-- Yanıtlanan mesaj ekrandan güvenle anlaşılamadıysa tahmin edilmez; kullanıcı panelde seçer. -->
    <div
      v-if="showInstruction && operation === 'reply' && view.context.needsReplyTarget"
      class="ew-alert ew-alert--warning"
    >
      <AppIcon name="warning" />
      <div class="ew-alert__body">
        <span>{{ text.context.chooseReplyTarget }}</span>
        <button type="button" class="ew-link" @click="emit('expand')">{{ text.inline.openPanel }}</button>
      </div>
    </div>

    <form v-if="showLanguage" ref="languageRow" class="ew-card__language" @submit.prevent="translate">
      <label class="ew-card__language-label" :for="languageId">{{ text.inline.translateLanguage }}</label>
      <LanguagePicker
        :id="languageId"
        v-model="language"
        :invalid="view.fieldErrors.targetLanguage !== undefined"
        @submit="translate"
      />
      <button
        type="submit"
        class="ew-btn ew-btn--small"
        :class="{ 'ew-btn--primary': view.preview === null || language !== view.options.targetLanguage }"
        :disabled="view.preview !== null && language === view.options.targetLanguage"
      >
        <AppIcon name="translate" :size="14" />
        {{ view.preview === null ? text.inline.translate : text.inline.translateAgain }}
      </button>
    </form>

    <form v-if="showInstruction" class="ew-card__instruction" @submit.prevent="submit">
      <label class="ew-visually-hidden" :for="instructionId">{{ text.inline.instructionLabel }}</label>
      <textarea
        :id="instructionId"
        ref="instructionField"
        v-model="instruction"
        class="ew-textarea ew-card__input"
        dir="auto"
        rows="2"
        :placeholder="text.inline.instructionPlaceholder"
        :aria-invalid="view.fieldErrors.instruction !== undefined"
        @keydown="onInstructionKeydown"
      />
      <div class="ew-card__row">
        <button
          v-if="operation === 'reply'"
          type="button"
          class="ew-chip"
          :title="text.context.title"
          @click="emit('expand')"
        >
          <AppIcon name="mail" :size="14" />
          {{
            view.context.status === 'reading'
              ? text.inline.contextReading
              : text.inline.contextChip(includedContext)
          }}
        </button>
        <span class="ew-card__spacer" />
        <button
          type="submit"
          class="ew-btn ew-btn--primary ew-btn--small"
          :disabled="
            instruction.trim() === '' || view.context.status === 'reading' || !view.prepare.canPrepare
          "
        >
          <AppIcon name="send" :size="14" />
          {{ text.inline.write }}
        </button>
      </div>
    </form>

    <div v-if="isPreparing" class="ew-card__busy" role="status">
      <span class="ew-spinner" aria-hidden="true" />
      <span>{{ status.kind === 'busy' ? text.status[status.activity] : '' }}</span>
    </div>

    <div v-if="problem !== null" class="ew-alert ew-alert--error" role="alert">
      <AppIcon name="warning" />
      <div class="ew-alert__body">
        <span>{{ text.errors[problem] }}</span>
        <button
          v-if="status.kind === 'error' && status.canRetry"
          type="button"
          class="ew-link"
          @click="emit('retry')"
        >
          {{ text.status.retry }}
        </button>
        <button
          v-else-if="problem === 'CONTEXT_REQUIRED'"
          type="button"
          class="ew-link"
          @click="emit('expand')"
        >
          {{ text.inline.openPanel }}
        </button>
      </div>
    </div>

    <template v-if="view.preview !== null">
      <p v-if="view.preview.stale" class="ew-alert ew-alert--warning">{{ text.preview.stale }}</p>
      <RichPreview
        size="card"
        :text="view.preview.text"
        :label="text.preview.title"
        :disabled="view.apply.isApplying"
        @change="emit('preview-change', $event)"
      />
      <RefineBar
        v-if="view.refine.available || isPreparing"
        :rich="view.refine.rich"
        :disabled="!view.refine.available"
        @refine="emit('refine', $event)"
        @refine-custom="emit('refine-custom', $event)"
      />
      <p v-if="view.apply.blocker !== null && view.apply.canCopy" class="ew-muted">
        {{ text.errors[view.apply.blocker] }}
      </p>
      <footer class="ew-card__footer">
        <p v-if="status.kind === 'success'" class="ew-card__success" role="status">
          <AppIcon name="check" />
          {{ text.status[status.message] }}
        </p>
        <span class="ew-card__spacer" />
        <button
          v-if="view.apply.canUndo"
          type="button"
          class="ew-btn ew-btn--subtle ew-btn--small"
          :disabled="view.apply.isApplying"
          @click="emit('undo')"
        >
          <AppIcon name="undo" :size="14" />
          {{ text.apply.undo }}
        </button>
        <button
          type="button"
          class="ew-btn ew-btn--subtle ew-btn--small"
          :disabled="!view.apply.canCopy"
          @click="emit('copy')"
        >
          <AppIcon name="copy" :size="14" />
          {{ text.apply.copy }}
        </button>
        <button
          type="button"
          class="ew-btn ew-btn--primary ew-btn--small"
          :disabled="!view.apply.canApply || view.apply.isApplying"
          @click="emit('apply')"
        >
          <AppIcon name="check" :size="14" />
          {{ text.apply.apply }}
        </button>
      </footer>
    </template>
  </section>
</template>
