<script setup lang="ts">
import { useUiText } from '../i18n';

defineProps<{
  /** Taslak yanındaki başlatıcıda "Düzelt" ve "Çevir" hızlı işlemleri gösterilir. */
  showQuickActions: boolean;
}>();

const emit = defineEmits<{
  open: [];
  'quick-action': [operation: 'revise' | 'translate'];
}>();

const text = useUiText();

/**
 * Fare ile basıldığında odağın editörden ayrılmasını engeller; böylece
 * taslaktaki seçim, işlem başlamadan önce kaybolmaz.
 */
function keepEditorSelection(event: PointerEvent): void {
  event.preventDefault();
}
</script>

<template>
  <div class="ew-launcher" role="group" :aria-label="text.launcher.label">
    <button
      type="button"
      class="ew-launcher__open"
      :aria-label="text.launcher.label"
      :title="text.launcher.tooltip"
      @pointerdown="keepEditorSelection"
      @click="emit('open')"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16">
        <path
          d="M3 14.5V17h2.5l7.4-7.4-2.5-2.5L3 14.5zm11.8-6.8a.7.7 0 0 0 0-1l-1.5-1.5a.7.7 0 0 0-1 0l-1.2 1.2 2.5 2.5 1.2-1.2z"
          fill="currentColor"
        />
      </svg>
    </button>
    <template v-if="showQuickActions">
      <button
        type="button"
        class="ew-launcher__quick"
        @pointerdown="keepEditorSelection"
        @click="emit('quick-action', 'revise')"
      >
        {{ text.launcher.quickRevise }}
      </button>
      <button
        type="button"
        class="ew-launcher__quick"
        @pointerdown="keepEditorSelection"
        @click="emit('quick-action', 'translate')"
      >
        {{ text.launcher.quickTranslate }}
      </button>
    </template>
  </div>
</template>
