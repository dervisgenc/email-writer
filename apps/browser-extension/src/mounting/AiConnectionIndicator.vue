<script setup lang="ts">
import { API_PROVIDER_DETAILS, CHATGPT_USAGE_URL } from '@writehand/contracts';
import { useUiText } from '@writehand/ui';
import { computed } from 'vue';

import { requestOpenOptions } from '../platform/extension-client';
import { useAiSummary } from './ai-summary';

const text = useUiText();
const enabled = import.meta.env.MODE !== 'test';
const connection = enabled ? useAiSummary() : null;
const summary = computed(() => connection?.summary.value ?? null);
const label = computed(() => {
  if (!connection?.checked.value) return text.value.ai.checking;
  const current = summary.value;
  if (!current?.ready) return text.value.ai.notReady;
  if (current.mode === 'api-key') return text.value.ai.useApi(API_PROVIDER_DETAILS[current.provider].name);
  return current.mode === 'chatgpt' ? text.value.ai.usePlan : text.value.ai.useClaude;
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
