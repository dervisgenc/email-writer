<script setup lang="ts">
import type { TargetLanguage } from '@email-writer/contracts';
import { computed, ref, useId, watch } from 'vue';

import { useUiText } from '../i18n';
import { languageLabel, languageOptions, matchLanguage } from '../languages';

/**
 * Listeden seçilebilen veya elle yazılabilen dil alanı. Değer yalnızca geçerli
 * bir dile karşılık geldiğinde yayılır; geçersiz girdi son geçerli değere döner.
 */
const props = defineProps<{
  modelValue: TargetLanguage | null;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  /** Listenin başında gösterilen diller (ör. favoriler). */
  preferred?: readonly TargetLanguage[];
  /** Listeden çıkarılan diller (ör. zaten eklenmiş olanlar). */
  exclude?: readonly TargetLanguage[];
  /** Ekleme alanı: geçerli dil seçilince yayılır ve alan temizlenir. */
  clearOnCommit?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [language: TargetLanguage]; submit: [] }>();

const text = useUiText();
const listId = useId();
const draft = ref('');
const rejected = ref(false);
// Son yayılan değer: üst bileşen değeri hemen güncellemese de aynı dil iki kez yayılmaz.
const committed = ref<TargetLanguage | null>(props.modelValue);

const label = (language: TargetLanguage | null) =>
  language === null ? '' : languageLabel(language, text.value.locale);
const options = computed(() => {
  const excluded = new Set(props.exclude ?? []);
  const preferred = (props.preferred ?? [])
    .filter((value) => !excluded.has(value))
    .map((value) => ({ value, label: label(value) }));
  const seen = new Set([...excluded, ...preferred.map((option) => option.value)]);
  return [...preferred, ...languageOptions(text.value.locale).filter((option) => !seen.has(option.value))];
});

watch(
  () => props.modelValue,
  (value) => {
    draft.value = label(value);
    committed.value = value;
    rejected.value = false;
  },
  { immediate: true },
);

function commit(): boolean {
  if (draft.value.trim() === '' && (props.modelValue === null || props.clearOnCommit)) {
    rejected.value = false;
    return false;
  }
  const language = matchLanguage(draft.value, text.value.locale);
  if (language === null) {
    rejected.value = true;
    return false;
  }
  rejected.value = false;
  if (props.clearOnCommit) {
    draft.value = '';
    emit('update:modelValue', language);
    return true;
  }
  draft.value = label(language);
  if (language !== committed.value) {
    committed.value = language;
    emit('update:modelValue', language);
  }
  return true;
}

function onBlur(): void {
  // Ekleme alanında yazılan bırakılır; kullanıcı Enter veya Ekle ile onaylar.
  if (props.clearOnCommit) return;
  if (!commit()) {
    draft.value = label(committed.value);
    rejected.value = false;
  }
}

function onChange(): void {
  // Listeden bir seçenek seçildiğinde tarayıcı `change` gönderir.
  if (!props.clearOnCommit || options.value.some((option) => option.label === draft.value)) commit();
}

function onEnter(event: KeyboardEvent): void {
  if (event.isComposing) return;
  event.preventDefault();
  if (commit()) emit('submit');
}

function onFocus(event: FocusEvent): void {
  (event.target as HTMLInputElement).select();
}

/** Ekleme alanındaki "Ekle" düğmesi için: yazılanı onaylar. */
defineExpose({ commit });
</script>

<template>
  <input
    :id="id"
    v-model="draft"
    class="ew-input ew-language-picker"
    type="text"
    :list="listId"
    autocomplete="off"
    spellcheck="false"
    maxlength="60"
    :placeholder="placeholder ?? text.options.languagePlaceholder"
    :disabled="disabled"
    :aria-invalid="invalid || rejected"
    @change="onChange"
    @blur="onBlur"
    @focus="onFocus"
    @keydown.enter="onEnter"
  />
  <datalist :id="listId">
    <option v-for="option in options" :key="option.value" :value="option.label" />
  </datalist>
</template>
