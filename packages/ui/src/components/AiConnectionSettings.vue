<script setup lang="ts">
import { CHATGPT_USAGE_URL, type AiCommand, type AiStatus } from '@email-writer/contracts';
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue';
import type { AiText } from '../ai-text';
import { inputValue } from '../input-value';
import AiAccountActions from './AiAccountActions.vue';

const props = defineProps<{
  status: AiStatus | null;
  text: AiText;
  error: string | null;
  busy: boolean;
  extensionId: string;
}>();
const emit = defineEmits<{ command: [command: AiCommand]; refresh: [] }>();
const key = ref('');
const ids = {
  title: useId(),
  model: useId(),
  account: useId(),
  accountHint: useId(),
  key: useId(),
  welcome: useId(),
};
const welcome = useTemplateRef<HTMLDialogElement>('welcome');
const selectedId = ref<string | null>(null);
const active = computed(() =>
  props.status?.accounts.find((account) => account.id === props.status?.activeAccountId),
);
const selected = computed(
  () =>
    props.status?.accounts.find((account) => account.id === selectedId.value) ??
    active.value ??
    props.status?.accounts[0],
);
const selectedIsActive = computed(() => selected.value?.id === props.status?.activeAccountId);
watch(
  () => props.status?.activeAccountId,
  (id) => {
    if (id) selectedId.value = id;
  },
  { immediate: true },
);
const disabled = computed(() => props.busy || props.status?.signingIn === true);
const connectionState = computed(() => {
  if (!selected.value) return null;
  if (!selected.value.verified) return props.text.registrationIncomplete;
  if (!selected.value.connected) return props.text.disconnected;
  if (!selected.value.planEnabled) return props.text.planDisabled;
  if (!selectedIsActive.value) return props.text.savedConnection;
  return props.status?.ready ? props.text.connected : props.text.generationUnavailable;
});
watch(
  () => props.status?.needsPlanAcknowledgement,
  async (visible) => {
    await nextTick();
    if (visible && welcome.value?.showModal) welcome.value.showModal();
    else welcome.value?.close?.();
  },
  { immediate: true },
);
function saveKey() {
  const apiKey = key.value.trim();
  if (!apiKey) return;
  key.value = '';
  emit('command', { action: 'save-api-key', apiKey });
}
</script>

<template>
  <section class="ew-ai-settings" :aria-labelledby="ids.title" :aria-busy="busy">
    <div class="ew-ai-settings__heading">
      <h2 :id="ids.title">{{ text.title }}</h2>
      <button
        type="button"
        class="ew-btn ew-btn--subtle ew-btn--small"
        :disabled="busy"
        @click="emit('refresh')"
      >
        {{ text.refresh }}
      </button>
    </div>
    <p class="ew-muted">{{ text.description }}</p>
    <p v-if="error" class="ew-alert ew-alert--error" role="alert">{{ error }}</p>
    <p v-if="busy" class="ew-muted" role="status">{{ text.checking }}</p>
    <template v-if="status">
      <div class="ew-ai-settings__methods" role="group" :aria-label="text.title">
        <button
          type="button"
          class="ew-btn"
          :class="{ 'ew-btn--primary': status.mode === 'chatgpt' }"
          :aria-pressed="status.mode === 'chatgpt'"
          :disabled="disabled"
          @click="emit('command', { action: 'set-mode', mode: 'chatgpt' })"
        >
          {{ text.chatgpt }}
        </button>
        <button
          type="button"
          class="ew-btn"
          :class="{ 'ew-btn--primary': status.mode === 'api-key' }"
          :aria-pressed="status.mode === 'api-key'"
          :disabled="disabled"
          @click="emit('command', { action: 'set-mode', mode: 'api-key' })"
        >
          {{ text.apiKey }}
        </button>
      </div>
      <template v-if="status.mode === 'chatgpt'">
        <p class="ew-muted">{{ text.planNote }}</p>
        <p v-if="active?.connected" class="ew-muted">{{ text.activeAccount }}: {{ active.label }}</p>
        <div v-if="status.accounts.length" class="ew-ai-settings__field">
          <label class="ew-label" :for="ids.account">{{ text.account }}</label>
          <select
            :id="ids.account"
            class="ew-select"
            :value="selected?.id ?? ''"
            :aria-describedby="ids.accountHint"
            :disabled="busy"
            @change="selectedId = inputValue($event)"
          >
            <option disabled value="">{{ text.account }}</option>
            <option v-for="account in status.accounts" :key="account.id" :value="account.id">
              {{ account.label
              }}{{ account.email && account.email !== account.label ? ` · ${account.email}` : '' }}
            </option>
          </select>
        </div>
        <p v-if="connectionState" class="ew-ai-settings__state" role="status">{{ connectionState }}</p>
        <p v-if="status.accounts.length" :id="ids.accountHint" class="ew-muted">
          {{ text.savedAccountHint }}
        </p>
        <div class="ew-ai-settings__actions">
          <button
            v-if="!selected?.connected || !selected.planEnabled"
            type="button"
            class="ew-btn ew-ai-sign-in"
            :disabled="disabled"
            @click="emit('command', { action: 'connect', accountId: selected?.id ?? null })"
          >
            {{ text.connect }}
          </button>
          <button
            v-else-if="!selectedIsActive"
            type="button"
            class="ew-btn ew-btn--primary"
            :disabled="disabled"
            @click="emit('command', { action: 'select-account', accountId: selected.id })"
          >
            {{ text.useAccount }}
          </button>
          <button
            v-else
            type="button"
            class="ew-btn"
            :disabled="disabled"
            @click="emit('command', { action: 'connect', accountId: selected.id })"
          >
            {{ text.reconnect }}
          </button>
          <button
            v-if="status.accounts.length"
            type="button"
            class="ew-btn"
            :disabled="busy"
            @click="emit('command', { action: 'connect', accountId: null })"
          >
            {{ text.addAccount }}
          </button>
          <button
            v-if="selected?.connected"
            type="button"
            class="ew-btn ew-btn--subtle"
            :disabled="disabled"
            @click="emit('command', { action: 'disconnect', accountId: selected.id })"
          >
            {{ text.disconnect }}
          </button>
        </div>
        <AiAccountActions
          v-if="selected"
          :account="selected"
          :text="text"
          :busy="busy"
          @command="emit('command', $event)"
        />
        <div v-if="status.signingIn" class="ew-ai-settings__actions" role="status">
          <span class="ew-muted">{{ text.signingIn }}</span>
          <button
            type="button"
            class="ew-btn ew-btn--subtle"
            @click="emit('command', { action: 'cancel-sign-in' })"
          >
            {{ text.cancel }}
          </button>
        </div>
        <a class="ew-link" :href="CHATGPT_USAGE_URL" target="_blank" rel="noopener noreferrer">{{
          text.manageUsage
        }}</a>
        <p class="ew-muted">{{ text.connectionHelp }}</p>
      </template>
      <form v-else class="ew-ai-settings__field" @submit.prevent="saveKey">
        <p class="ew-muted">{{ text.apiNote }}</p>
        <p v-if="status.apiKeyConfigured" class="ew-ai-settings__state">{{ text.keySaved }}</p>
        <label class="ew-label" :for="ids.key">{{ text.apiKeyLabel }}</label>
        <input
          :id="ids.key"
          v-model="key"
          class="ew-input"
          type="password"
          autocomplete="off"
          spellcheck="false"
          :disabled="disabled"
          maxlength="512"
        />
        <div class="ew-ai-settings__actions">
          <button type="submit" class="ew-btn ew-btn--primary" :disabled="disabled || key.trim().length < 10">
            {{ text.saveKey }}
          </button>
          <button
            v-if="status.apiKeyConfigured"
            type="button"
            class="ew-btn ew-btn--subtle"
            :disabled="disabled"
            @click="emit('command', { action: 'clear-api-key' })"
          >
            {{ text.removeKey }}
          </button>
        </div>
      </form>
      <div
        v-if="status.models.length && (status.mode === 'api-key' || selectedIsActive)"
        class="ew-ai-settings__field"
      >
        <label class="ew-label" :for="ids.model">{{ text.model }}</label>
        <select
          :id="ids.model"
          class="ew-select"
          :value="status.selectedModel ?? ''"
          :disabled="disabled"
          @change="emit('command', { action: 'set-model', model: inputValue($event) })"
        >
          <option disabled value="">{{ text.model }}</option>
          <option v-for="model in status.models" :key="model.id" :value="model.id">{{ model.label }}</option>
        </select>
      </div>
    </template>
    <details class="ew-ai-settings__setup" :open="status === null && !busy">
      <summary>{{ text.setup }}</summary>
      <p class="ew-muted">{{ text.setupBody }}</p>
      <p class="ew-muted">
        {{ text.extensionId }} <code>{{ extensionId }}</code>
      </p>
    </details>
    <p class="ew-muted ew-ai-settings__privacy">{{ text.privacy }}</p>
    <dialog
      ref="welcome"
      class="ew-ai-welcome"
      :aria-labelledby="ids.welcome"
      @cancel.prevent="emit('command', { action: 'acknowledge-plan' })"
    >
      <h2 :id="ids.welcome">{{ text.welcome }}</h2>
      <p>{{ text.welcomeBody }}</p>
      <div class="ew-ai-settings__actions">
        <a class="ew-link" :href="CHATGPT_USAGE_URL" target="_blank" rel="noopener noreferrer">{{
          text.manageUsage
        }}</a>
        <button
          type="button"
          autofocus
          class="ew-btn ew-btn--primary"
          :disabled="busy"
          @click="emit('command', { action: 'acknowledge-plan' })"
        >
          {{ text.gotIt }}
        </button>
      </div>
    </dialog>
  </section>
</template>
