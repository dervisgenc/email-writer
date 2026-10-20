<script setup lang="ts">
import type { TargetLanguage } from '@writehand/contracts';
import { computed, ref, useId, watch } from 'vue';

import { useUiText } from '../i18n';
import { languageLabel, languageOptions, matchLanguage } from '../languages';

/**
 * Language field that accepts a pick from the list or typed input. The value is
 * emitted only when it matches a valid language; invalid input reverts to the last valid one.
 */
const props = defineProps<{
  modelValue: TargetLanguage | null;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  /** Languages shown at the top of the list (e.g. favorites). */
  preferred?: readonly TargetLanguage[];
  /** Languages left out of the list (e.g. ones already added). */
  exclude?: readonly TargetLanguage[];
  /** Add field: a valid language is emitted and the field is cleared. */
  clearOnCommit?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [language: TargetLanguage]; submit: [] }>();

const text = useUiText();
const listId = useId();
const draft = ref('');
const rejected = ref(false);
// Last emitted value, so the same language is not emitted twice before the parent updates.
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
  // In the add field, typed text is left alone; the user confirms with Enter or Add.
  if (props.clearOnCommit) return;
  if (!commit()) {
    draft.value = label(committed.value);
    rejected.value = false;
  }
}

function onChange(): void {
  // The browser fires `change` when an option is picked from the list.
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

/** For the "Add" button of the add field: commits the typed text. */
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
