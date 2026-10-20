<script setup lang="ts">
import { isRichDocument, parseEmailMarkdown, renderEmailHtml } from '@writehand/email-format';
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';

import { useUiText } from '../i18n';
import { inputValue } from '../input-value';
import AppIcon from './AppIcon.vue';

/**
 * Result preview. A formatted result (list, table, chart) is shown as it will look in
 * the email, and "Edit source" opens its source; a plain result is edited directly.
 * HTML is generated only from the parsed structure and all text is escaped.
 */
const props = defineProps<{
  text: string;
  id?: string;
  label: string;
  disabled: boolean;
  invalid?: boolean;
  describedBy?: string;
  /** Shorter in the card, taller in the panel. */
  size: 'card' | 'panel';
}>();
const emit = defineEmits<{ change: [text: string] }>();

const ui = useUiText();
const editing = ref(false);
const editor = useTemplateRef<HTMLTextAreaElement>('editor');
const document = computed(() => parseEmailMarkdown(props.text));
const rich = computed(() => isRichDocument(document.value));
const html = computed(() => renderEmailHtml(document.value, { locale: ui.value.locale }));

// A new result switches back to the formatted view.
watch(rich, (value) => {
  if (!value) editing.value = false;
});

async function edit(): Promise<void> {
  editing.value = true;
  await nextTick();
  editor.value?.focus({ preventScroll: true });
}

/** Links in the preview never navigate the page (Outlook) away. */
function blockNavigation(event: MouseEvent): void {
  if ((event.target as Element | null)?.closest('a') !== null) event.preventDefault();
}
</script>

<template>
  <div class="ew-rich-preview" :data-size="size">
    <template v-if="rich && !editing">
      <!-- HTML is generated from the parsed structure; all text is escaped. -->
      <!-- eslint-disable vue/no-v-html -->
      <div
        :id="id"
        class="ew-rich-preview__paper"
        role="document"
        :aria-label="label"
        tabindex="0"
        @click="blockNavigation"
        v-html="html"
      />
      <!-- eslint-enable vue/no-v-html -->
      <button
        type="button"
        class="ew-btn ew-btn--subtle ew-btn--small ew-rich-preview__toggle"
        :disabled="disabled"
        @click="edit"
      >
        <AppIcon name="edit" :size="14" />
        {{ ui.preview.editSource }}
      </button>
    </template>
    <template v-else>
      <textarea
        :id="id"
        ref="editor"
        class="ew-textarea ew-rich-preview__source"
        dir="auto"
        :aria-label="label"
        :value="text"
        :disabled="disabled"
        :aria-invalid="invalid"
        :aria-describedby="describedBy"
        @input="emit('change', inputValue($event))"
      />
      <button
        v-if="rich"
        type="button"
        class="ew-btn ew-btn--subtle ew-btn--small ew-rich-preview__toggle"
        @click="editing = false"
      >
        <AppIcon name="check" :size="14" />
        {{ ui.preview.showFormatted }}
      </button>
    </template>
  </div>
</template>
