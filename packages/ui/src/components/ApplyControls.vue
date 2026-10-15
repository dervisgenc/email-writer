<script setup lang="ts">
import { computed, useId } from 'vue';

import { useUiText } from '../i18n';
import type { ApplyView } from '../view-model';
import AppIcon from './AppIcon.vue';

const props = defineProps<{
  apply: ApplyView;
}>();

const emit = defineEmits<{
  apply: [];
  copy: [];
  undo: [];
  'bind-target': [mode: 'replace-existing-reply' | 'use-open-composer'];
}>();

const text = useUiText();
const blockerId = useId();

const scope = computed(() =>
  props.apply.mode === null ? text.value.apply.noTarget : text.value.apply.scopes[props.apply.mode],
);
</script>

<template>
  <div class="ew-apply">
    <p class="ew-apply__scope">
      <span class="ew-apply__scope-label">{{ text.apply.scopeLabel }}:</span> {{ scope }}
    </p>
    <div v-if="apply.canReplaceExistingReply || apply.canUseOpenComposer" class="ew-apply__bind">
      <button
        v-if="apply.canUseOpenComposer"
        type="button"
        class="ew-link"
        @click="emit('bind-target', 'use-open-composer')"
      >
        {{ text.apply.useOpenComposer }}
      </button>
      <button
        v-if="apply.canReplaceExistingReply"
        type="button"
        class="ew-link"
        @click="emit('bind-target', 'replace-existing-reply')"
      >
        {{ text.apply.replaceExistingReply }}
      </button>
    </div>
    <div class="ew-apply__buttons">
      <button
        type="button"
        class="ew-btn ew-btn--primary"
        :disabled="!apply.canApply || apply.isApplying"
        :aria-describedby="apply.blocker !== null ? blockerId : undefined"
        @click="emit('apply')"
      >
        <AppIcon name="check" />
        {{ text.apply.apply }}
      </button>
      <button type="button" class="ew-btn" :disabled="!apply.canCopy" @click="emit('copy')">
        <AppIcon name="copy" />
        {{ text.apply.copy }}
      </button>
      <button
        v-if="apply.canUndo"
        type="button"
        class="ew-btn ew-btn--subtle"
        :disabled="apply.isApplying"
        @click="emit('undo')"
      >
        <AppIcon name="undo" />
        {{ text.apply.undo }}
      </button>
    </div>
    <p v-if="apply.mode !== null" class="ew-muted">{{ text.apply.formattingNote }}</p>
    <!-- Düğmenin kapalı olma nedeni yalnızca renkle anlatılmaz. -->
    <p v-if="apply.blocker !== null && apply.canCopy" :id="blockerId" class="ew-muted">
      {{ text.errors[apply.blocker] }}
    </p>
  </div>
</template>
