<script setup lang="ts">
import type { AiCommand, HelperStatus } from '@writehand/contracts';
import { computed } from 'vue';

import type { AiText } from '../ai-text';
import AppIcon from './AppIcon.vue';
import ModelSelect from './ModelSelect.vue';

/** Claude Code on this computer, run by the helper app; its sign-in belongs to Claude Code. */
const props = defineProps<{ helper: HelperStatus; text: AiText; busy: boolean }>();
const emit = defineEmits<{ command: [command: AiCommand] }>();
const claudeState = computed(() => {
  const claude = props.helper.claudeCode;
  if (!claude) return null;
  if (!claude.installed) return props.text.claudeNotInstalled;
  if (!claude.loggedIn) return props.text.claudeNotLoggedIn;
  return props.helper.ready ? props.text.connected : null;
});
const claudeAccount = computed(() => {
  const claude = props.helper.claudeCode;
  if (!claude?.loggedIn) return null;
  const plan = claude.plan ? claude.plan.charAt(0).toUpperCase() + claude.plan.slice(1) : null;
  return [claude.account, claude.organization, plan].filter(Boolean).join(' · ') || null;
});
</script>

<template>
  <div class="ew-ai-settings__field">
    <p class="ew-muted">{{ text.claudeNote }}</p>
    <p v-if="claudeState" class="ew-ai-settings__state" :data-ready="helper.ready" role="status">
      {{ claudeState }}
    </p>
    <p v-if="claudeAccount" class="ew-ai-settings__meta">
      {{ text.claudeAccount }}: <strong>{{ claudeAccount }}</strong>
    </p>
    <p
      v-if="helper.claudeCode?.loggedIn && !helper.claudeCode.subscription"
      class="ew-alert ew-alert--warning"
      role="note"
    >
      <AppIcon name="warning" :size="16" />
      <span>{{ text.claudeApiBilling }}</span>
    </p>
  </div>
  <ModelSelect
    v-if="helper.models.length"
    :models="helper.models"
    :selected="helper.selectedModel"
    :text="text"
    :disabled="busy"
    @select="emit('command', { action: 'set-model', model: $event })"
  />
</template>
