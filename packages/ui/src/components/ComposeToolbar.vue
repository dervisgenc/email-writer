<script setup lang="ts">
import { LANGUAGE_CODES, type LanguageCode, type Operation } from '@email-writer/contracts';
import { computed, nextTick, ref, useId, useTemplateRef } from 'vue';

import { useUiText } from '../i18n';
import type { QuickActionRequest } from '../view-model';
import AppIcon from './AppIcon.vue';

const props = defineProps<{
  /** Yanıt taslağında "Yanıt yaz" (konuşma bağlamıyla), yeni iletide "Yaz" gösterilir. */
  isReply: boolean;
  /** Çalışan işlem; düğmesinde ilerleme gösterilir, diğerleri beklerken kapanır. */
  busyOperation: Operation | null;
  defaultLanguage: LanguageCode;
}>();

const emit = defineEmits<{
  'quick-action': [request: QuickActionRequest];
  'open-panel': [];
}>();

const text = useUiText();
const menuId = useId();
const menuOpen = ref(false);
const menu = useTemplateRef<HTMLElement>('menu');

/**
 * Fare ile basıldığında odağın editörden ayrılmasını engeller; böylece
 * taslaktaki seçim, işlem başlamadan önce kaybolmaz.
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

/** Menüde ok tuşlarıyla gezinme; Escape menüyü kapatır. */
function onMenuKeydown(event: KeyboardEvent): void {
  const items = [...(menu.value?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
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
const writeOperation = computed(() => (props.isReply ? 'reply' : 'compose'));
</script>

<template>
  <div class="ew-compose-bar" role="toolbar" :aria-label="text.compose.toolbarLabel">
    <!-- Talimatla yazma: yanıt taslağında konuşmaya yanıt, yeni iletide bağlamsız metin. -->
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
        :title="text.compose.translateTooltip(text.options.languages[defaultLanguage])"
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
          v-for="code in LANGUAGE_CODES"
          :key="code"
          type="button"
          class="ew-menu__item"
          role="menuitemradio"
          :aria-checked="code === defaultLanguage"
          @pointerdown="keepEditorSelection"
          @click="run({ operation: 'translate', language: code })"
        >
          <span>{{ text.options.languages[code] }}</span>
          <AppIcon v-if="code === defaultLanguage" name="check" />
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
