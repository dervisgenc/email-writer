<script setup lang="ts">
import {
  isHelperMode,
  type AiCommand,
  type AiStatus,
  type ApiProvider,
  type ErrorCode,
} from '@writehand/contracts';
import { AiConnectionGuide, AiConnectionSettings, AppIcon, type UiText } from '@writehand/ui';
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';

import { openWelcomePage, requestProviderAccess } from '../platform/extension-browser';
import { fetchAiStatus, runAiCommand } from '../platform/extension-client';

/**
 * AI connection card and connection guide, used by the settings page and the welcome wizard.
 * The `helper` slot is shown in place of a helper app method while the helper app is missing;
 * by default it points to the setup wizard.
 */
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
/** Refresh also reloads the model list, except while the helper app is busy signing in or missing. */
const refreshesModels = computed(() => {
  const current = status.value;
  return (
    current !== null && (current.helper !== null ? !current.helper.signingIn : !isHelperMode(current.mode))
  );
});
let disposed = false;
let timer: ReturnType<typeof setTimeout> | undefined;
/** The model list each method was last loaded for, so a failed load is not repeated by itself. */
let modelsRequestedFor: string | null = null;

function show(result: Awaited<ReturnType<typeof runAiCommand>>) {
  if (result.ok) {
    status.value = result.value;
    error.value = null;
  } else error.value = result.error.code;
}

async function refresh(refreshModels = false) {
  if (busy.value || disposed) return;
  busy.value = true;
  const result = refreshModels ? await runAiCommand({ action: 'refresh-models' }) : await fetchAiStatus();
  busy.value = false;
  if (disposed) return;
  show(result);
  schedulePoll();
}

/** Polls while a ChatGPT sign-in is pending and while a helper app method waits for the helper app. */
function schedulePoll() {
  clearTimeout(timer);
  const current = status.value;
  if (disposed || current === null) return;
  if (current.helper?.signingIn) timer = setTimeout(() => void refresh(), 1_000);
  else if (isHelperMode(current.mode) && current.helper === null)
    timer = setTimeout(() => void refresh(), 3_000);
}

/**
 * Model lists are loaded on demand, not on every status read: once when the page opens and
 * after the method or provider changes, if the connection can list them but has not yet.
 */
async function loadMissingModels() {
  const current = status.value;
  if (current === null) return;
  const { apiKey, helper } = current;
  const missing =
    current.mode === 'api-key'
      ? apiKey.savedKeys.includes(apiKey.provider) && apiKey.access && apiKey.models.length === 0
      : current.mode === 'chatgpt' &&
        helper !== null &&
        !helper.signingIn &&
        helper.models.length === 0 &&
        helper.accounts.some(
          (account) => account.id === helper.activeAccountId && account.connected && account.planEnabled,
        );
  const target = current.mode === 'api-key' ? `api-key:${apiKey.provider}` : current.mode;
  if (!missing || modelsRequestedFor === target) return;
  modelsRequestedFor = target;
  await refresh(true);
}

async function command(value: AiCommand) {
  if (busy.value) return;
  // The browser shows its permission prompt only inside the user's click, before any await.
  const access = value.action === 'save-api-key' ? requestProviderAccess(value.provider) : null;
  busy.value = true;
  const allowed = access === null || (await access);
  const result = allowed ? await runAiCommand(value) : null;
  busy.value = false;
  if (disposed) return;
  if (result === null) error.value = 'AI_PROVIDER_ACCESS_REQUIRED';
  else show(result);
  schedulePoll();
  await loadMissingModels();
}

/** Asks again for access to a provider whose permission was removed in the browser's settings. */
async function grantAccess(provider: ApiProvider) {
  if (busy.value) return;
  const granted = requestProviderAccess(provider);
  if (!(await granted)) {
    error.value = 'AI_PROVIDER_ACCESS_REQUIRED';
    return;
  }
  modelsRequestedFor = null;
  await refresh();
  await loadMissingModels();
}

onMounted(async () => {
  await refresh();
  await loadMissingModels();
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
    @grant-access="grantAccess"
    @refresh="refresh(refreshesModels)"
  >
    <template #helper>
      <slot name="helper">
        <div class="ew-alert" role="note">
          <AppIcon name="info" :size="16" />
          <span class="ew-alert__body">
            {{ text.ai.helperRequired }}
            <button type="button" class="ew-btn ew-btn--small" @click="openWelcomePage">
              {{ text.helper.openWizard }}
            </button>
          </span>
        </div>
      </slot>
    </template>
  </AiConnectionSettings>
  <AiConnectionGuide
    v-if="guide"
    :key="status?.mode ?? 'none'"
    :text="text.ai"
    :mode="status?.mode ?? null"
  />
</template>
