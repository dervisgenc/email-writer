<script setup lang="ts">
import { CHATGPT_USAGE_URL } from '@email-writer/contracts';
import { useUiText } from '@email-writer/ui';
import { computed } from 'vue';

import { requestOpenOptions } from '../platform/extension-client';
import { useAiSummary } from './ai-summary';

const text = useUiText();
const enabled = import.meta.env.MODE !== 'test';
const connection = enabled ? useAiSummary() : null;
const summary = computed(() => connection?.summary.value ?? null);
const label = computed(() => {
  if (!connection?.checked.value) return text.value.ai.checking;
  if (!summary.value?.ready) return text.value.ai.notReady;
  const labels = {
    chatgpt: text.value.ai.usePlan,
    'api-key': text.value.ai.useApi,
    'claude-code': text.value.ai.useClaude,
  };
  return labels[summary.value.mode];
});
</script>

<template>
  <div v-if="enabled" class="ew-ai-indicator">
    <span class="ew-ai-indicator__label">{{ label }}</span>
    <a
      v-if="summary?.mode === 'chatgpt' && summary.ready"
      class="ew-link"
      :href="CHATGPT_USAGE_URL"
      target="_blank"
      rel="noopener noreferrer"
      >{{ text.ai.manageUsage }}</a
    >
    <button type="button" class="ew-link" @click="requestOpenOptions()">{{ text.ai.openSettings }}</button>
  </div>
</template>
