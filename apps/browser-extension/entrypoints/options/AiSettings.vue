<script setup lang="ts">
import type { AiCommand, AiStatus, ErrorCode } from '@email-writer/contracts';
import { AiConnectionSettings, type UiText } from '@email-writer/ui';
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue';

import { extensionId } from '../../src/platform/extension-browser';
import { fetchAiStatus, runAiCommand } from '../../src/platform/extension-client';

const props = defineProps<{ text: UiText }>();
const status = shallowRef<AiStatus | null>(null);
const error = ref<ErrorCode | null>(null);
const busy = ref(false);
const id = extensionId();
const errorText = computed(() => {
  const code = error.value ?? status.value?.error;
  return code ? props.text.errors[code] : null;
});
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
    :extension-id="id"
    @command="command"
    @refresh="refresh(status !== null && !status.signingIn)"
  />
</template>
