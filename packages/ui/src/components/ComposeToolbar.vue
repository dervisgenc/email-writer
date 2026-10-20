<script setup lang="ts">
import type { Operation, TargetLanguage } from '@writehand/contracts';
import { computed, nextTick, ref, useId, useTemplateRef } from 'vue';

import { useUiText } from '../i18n';
import { languageLabel } from '../languages';
import type { QuickActionRequest } from '../view-model';
import AppIcon from './AppIcon.vue';

const props = defineProps<{
  /** Shows "Write reply" (with conversation context) in a reply draft and "Write" in a new message. */
  isReply: boolean;
  /** The running operation; its button shows progress and the others are disabled meanwhile. */
  busyOperation: Operation | null;
  defaultLanguage: TargetLanguage;
  /** Languages shown in the menu; the default language always comes first. */
  favoriteLanguages: readonly TargetLanguage[];
}>();

const emit = defineEmits<{
  'quick-action': [request: QuickActionRequest];
  'open-panel': [];
  'manage-languages': [];
}>();

const text = useUiText();
const menuId = useId();
const menuOpen = ref(false);
const menu = useTemplateRef<HTMLElement>('menu');

/**
 * Keeps focus in the editor on mouse press so the selection in the draft is not
 * lost before the operation starts.
 */
function keepEditorSelection(event: PointerEvent): void {
  event.preventDefault();
}

function run(request: QuickActionRequest): void {
  menuOpen.value = false;
  emit('quick-action', request);
}

async function toggleMenu(): Promise<void> {
  menuOpen.value = !menuOpen.value;
  if (menuOpen.value) {
    await nextTick();
    menu.value?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }
}

/** Arrow keys move through the menu; Escape closes it. */
function onMenuKeydown(event: KeyboardEvent): void {
  const items = [
    ...(menu.value?.querySelectorAll<HTMLElement>('[role="menuitemradio"], [role="menuitem"]') ?? []),
  ];
  const index = items.indexOf(event.target as HTMLElement);
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    items[(index + step + items.length) % items.length]?.focus();
  } else if (event.key === 'Escape') {
    event.stopPropagation();
    menuOpen.value = false;
  }
}

const isBusy = (operation: Operation) => props.busyOperation === operation;
const label = (language: TargetLanguage) => languageLabel(language, text.value.locale);
const menuLanguages = computed(() => [
  props.defaultLanguage,
  ...props.favoriteLanguages.filter((language) => language !== props.defaultLanguage),
]);

function manageLanguages(): void {
  menuOpen.value = false;
  emit('manage-languages');
}
const writeOperation = computed(() => (props.isReply ? 'reply' : 'compose'));
</script>

<template>
  <div class="ew-compose-bar" role="toolbar" :aria-label="text.compose.toolbarLabel">
    <!-- Write from an instruction: a reply in a reply draft, context-free text in a new message. -->
    <button
      type="button"
      class="ew-bar-btn ew-bar-btn--brand"
      :title="isReply ? text.compose.replyTooltip : text.compose.writeTooltip"
      :disabled="busyOperation !== null"
      @pointerdown="keepEditorSelection"
      @click="run({ operation: writeOperation })"
    >
      <span v-if="isBusy(writeOperation)" class="ew-spinner" aria-hidden="true" />
      <AppIcon v-else name="sparkle" />
      <span>{{ isReply ? text.compose.reply : text.compose.write }}</span>
    </button>

    <button
      type="button"
      class="ew-bar-btn"
      :title="text.compose.reviseTooltip"
      :disabled="busyOperation !== null"
      @pointerdown="keepEditorSelection"
      @click="run({ operation: 'revise' })"
    >
      <span v-if="isBusy('revise')" class="ew-spinner" aria-hidden="true" />
      <AppIcon v-else name="proofread" />
      <span>{{ text.compose.revise }}</span>
    </button>

    <div class="ew-bar-split">
      <button
        type="button"
        class="ew-bar-btn"
        :title="text.compose.translateTooltip(label(defaultLanguage))"
        :disabled="busyOperation !== null"
        @pointerdown="keepEditorSelection"
        @click="run({ operation: 'translate', language: defaultLanguage })"
      >
        <span v-if="isBusy('translate')" class="ew-spinner" aria-hidden="true" />
        <AppIcon v-else name="translate" />
        <span>{{ text.compose.translate }}</span>
      </button>
      <button
        type="button"
        class="ew-bar-btn ew-bar-btn--chevron"
        aria-haspopup="menu"
        :aria-expanded="menuOpen"
        :aria-controls="menuId"
        :aria-label="text.compose.chooseLanguage"
        :title="text.compose.chooseLanguage"
        :disabled="busyOperation !== null"
        @pointerdown="keepEditorSelection"
        @click="toggleMenu"
      >
        <AppIcon name="chevronDown" :size="12" />
      </button>
      <div
        v-if="menuOpen"
        :id="menuId"
        ref="menu"
        class="ew-menu"
        role="menu"
        :aria-label="text.compose.chooseLanguage"
        @keydown="onMenuKeydown"
      >
        <button
          v-for="language in menuLanguages"
          :key="language"
          type="button"
          class="ew-menu__item"
          role="menuitemradio"
          :aria-checked="language === defaultLanguage"
          @pointerdown="keepEditorSelection"
          @click="run({ operation: 'translate', language })"
        >
          <span>{{ label(language) }}</span>
          <AppIcon v-if="language === defaultLanguage" name="check" />
        </button>
        <div class="ew-menu__separator" role="separator" />
        <!-- The selection is captured first; the language is typed or picked in the card. -->
        <button
          type="button"
          class="ew-menu__item"
          role="menuitem"
          @pointerdown="keepEditorSelection"
          @click="run({ operation: 'translate', language: null })"
        >
          <span>{{ text.options.otherLanguage }}</span>
        </button>
        <button
          type="button"
          class="ew-menu__item ew-menu__item--subtle"
          role="menuitem"
          @pointerdown="keepEditorSelection"
          @click="manageLanguages"
        >
          <span>{{ text.options.manageLanguages }}</span>
        </button>
      </div>
    </div>

    <span class="ew-bar-divider" aria-hidden="true" />
    <button
      type="button"
      class="ew-bar-btn ew-bar-btn--icon"
      :aria-label="text.compose.openPanel"
      :title="text.compose.openPanel"
      @pointerdown="keepEditorSelection"
      @click="emit('open-panel')"
    >
      <AppIcon name="openPanel" />
    </button>
  </div>
</template>
