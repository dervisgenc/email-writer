<script setup lang="ts">
import type { AiCommand, AiStatus, ErrorCode } from '@email-writer/contracts';
import { AiConnectionGuide, AiConnectionSettings, type UiText } from '@email-writer/ui';
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';

import { fetchAiStatus, runAiCommand } from '../platform/extension-client';

/** AI bağlantısı kartı ve bağlantı rehberi: ayarlar sayfası ve karşılama sihirbazı kullanır. */
const props = withDefaults(defineProps<{ text: UiText; guide?: boolean }>(), { guide: true });
const emit = defineEmits<{ ready: [ready: boolean] }>();
const status = shallowRef<AiStatus | null>(null);
const error = ref<ErrorCode | null>(null);
const busy = ref(false);
const errorText = computed(() => {
  const code = error.value ?? status.value?.error;
  return code ? props.text.errors[code] : null;
});
watch(
  () => status.value?.ready === true,
  (ready) => emit('ready', ready),
);
let disposed = false;
let timer: ReturnType<typeof setTimeout> | undefined;

async function refresh(refreshModels = false) {
  if (busy.value || disposed) return;
  busy.value = true;
  const result = refreshModels ? await runAiCommand({ action: 'refresh-models' }) : await fetchAiStatus();
  busy.value = false;
  if (disposed) return;
  if (result.ok) {
    status.value = result.value;
    error.value = null;
  } else {
    error.value = result.error.code;
    if (result.error.code === 'AI_HOST_UNAVAILABLE') status.value = null;
  }
  schedulePoll();
}
function schedulePoll() {
  clearTimeout(timer);
  if (!disposed && status.value?.signingIn)
    timer = setTimeout(() => {
      void refresh();
    }, 1_000);
}
async function command(value: AiCommand) {
  if (busy.value) return;
  busy.value = true;
  const result = await runAiCommand(value);
  busy.value = false;
  if (disposed) return;
  if (result.ok) {
    status.value = result.value;
    error.value = null;
  } else error.value = result.error.code;
  schedulePoll();
}
onMounted(async () => {
  await refresh();
  const current = status.value;
  // Claude Code's models are fixed aliases; there is no catalog to load.
  if (current?.mode === 'claude-code') return;
  const canLoadModels =
    current?.mode === 'api-key'
      ? current.apiKeyConfigured
      : current?.accounts.some(
          (account) => account.id === current.activeAccountId && account.connected && account.planEnabled,
        );
  if (canLoadModels && !current?.signingIn && !current?.models.length) await refresh(true);
});
onUnmounted(() => {
  disposed = true;
  clearTimeout(timer);
});
</script>

<template>
  <AiConnectionSettings
    :status="status"
    :text="text.ai"
    :error="errorText"
    :busy="busy"
    @command="command"
    @refresh="refresh(status !== null && !status.signingIn)"
  />
  <AiConnectionGuide
    v-if="guide"
    :key="status?.mode ?? 'none'"
    :text="text.ai"
    :mode="status?.mode ?? null"
  />
</template>
