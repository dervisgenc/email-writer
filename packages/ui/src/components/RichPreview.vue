<script setup lang="ts">
import { isRichDocument, parseEmailMarkdown, renderEmailHtml } from '@email-writer/email-format';
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';

import { useUiText } from '../i18n';
import { inputValue } from '../input-value';
import AppIcon from './AppIcon.vue';

/**
 * Sonuç önizlemesi. Biçimli sonuç (liste, tablo, grafik) e-postada görüneceği
 * gibi gösterilir ve "Düzenle" ile kaynağı açılır; düz sonuç doğrudan düzenlenir.
 * HTML yalnızca ayrıştırılmış yapıdan üretilir ve bütün metin kaçışlanır.
 */
const props = defineProps<{
  text: string;
  id?: string;
  label: string;
  disabled: boolean;
  invalid?: boolean;
  describedBy?: string;
  /** Kartta daha alçak, panelde daha yüksek gösterilir. */
  size: 'card' | 'panel';
}>();
const emit = defineEmits<{ change: [text: string] }>();

const ui = useUiText();
const editing = ref(false);
const editor = useTemplateRef<HTMLTextAreaElement>('editor');
const document = computed(() => parseEmailMarkdown(props.text));
const rich = computed(() => isRichDocument(document.value));
const html = computed(() => renderEmailHtml(document.value, { locale: ui.value.locale }));

// Yeni sonuç geldiğinde biçimli görünüme dönülür.
watch(rich, (value) => {
  if (!value) editing.value = false;
});

async function edit(): Promise<void> {
  editing.value = true;
  await nextTick();
  editor.value?.focus({ preventScroll: true });
}

/** Önizlemedeki bağlantılar sayfayı (Outlook'u) başka adrese götürmez. */
function blockNavigation(event: MouseEvent): void {
  if ((event.target as Element | null)?.closest('a') !== null) event.preventDefault();
}
</script>

<template>
  <div class="ew-rich-preview" :data-size="size">
    <template v-if="rich && !editing">
      <!-- HTML ayrıştırılmış yapıdan üretilir; bütün metin kaçışlanır. -->
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
