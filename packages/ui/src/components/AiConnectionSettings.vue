<script setup lang="ts">
import {
  AI_MODES,
  CHATGPT_USAGE_URL,
  type AiCommand,
  type AiMode,
  type AiStatus,
} from '@writehand/contracts';
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue';
import type { AiText } from '../ai-text';
import { inputValue } from '../input-value';
import AiAccountActions from './AiAccountActions.vue';
import AppIcon from './AppIcon.vue';
import type { IconName } from './icons';

const props = defineProps<{
  status: AiStatus | null;
  text: AiText;
  error: string | null;
  busy: boolean;
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
  method: useId(),
  codexHint: useId(),
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
const METHOD_ICONS: Record<AiMode, IconName> = {
  chatgpt: 'chat',
  'api-key': 'key',
  'claude-code': 'terminal',
};
const METHOD_BADGES: Partial<Record<AiMode, 'recommended' | 'experimental'>> = {
  chatgpt: 'recommended',
  'claude-code': 'experimental',
};
const methodTitle = (mode: AiMode) =>
  ({ chatgpt: props.text.chatgpt, 'api-key': props.text.apiKey, 'claude-code': props.text.claudeCode })[mode];
/** Short status at the top of the card: ready, needs setup, or needs a connection. */
const pill = computed<{ tone: 'success' | 'warning' | 'neutral'; label: string }>(() => {
  const status = props.status;
  if (status === null) {
    return props.busy
      ? { tone: 'neutral', label: props.text.checking }
      : { tone: 'warning', label: props.text.statusSetup };
  }
  if (status.ready) return { tone: 'success', label: props.text.statusReady };
  if (props.busy || status.signingIn) return { tone: 'neutral', label: props.text.checking };
  if (status.mode === 'claude-code' && status.claudeCode?.installed === false)
    return { tone: 'warning', label: props.text.statusSetup };
  return { tone: 'warning', label: props.text.statusAction };
});
function chooseMode(mode: AiMode) {
  if (props.status?.mode !== mode) emit('command', { action: 'set-mode', mode });
}
const claudeState = computed(() => {
  const claude = props.status?.claudeCode;
  if (!claude) return null;
  if (!claude.installed) return props.text.claudeNotInstalled;
  if (!claude.loggedIn) return props.text.claudeNotLoggedIn;
  return props.status?.ready ? props.text.connected : null;
});
const claudeAccount = computed(() => {
  const claude = props.status?.claudeCode;
  if (!claude?.loggedIn) return null;
  const plan = claude.plan ? claude.plan.charAt(0).toUpperCase() + claude.plan.slice(1) : null;
  return [claude.account, claude.organization, plan].filter(Boolean).join(' · ') || null;
});
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
  <section class="ew-settings-card ew-ai-settings" :aria-labelledby="ids.title" :aria-busy="busy">
    <header class="ew-settings-card__header">
      <span class="ew-settings-card__icon"><AppIcon name="sparkle" :size="18" /></span>
      <div class="ew-settings-card__heading">
        <h2 :id="ids.title" class="ew-settings-card__title">{{ text.title }}</h2>
        <p class="ew-settings-card__description">{{ text.description }}</p>
      </div>
      <div class="ew-settings-card__aside">
        <span class="ew-status-pill" :data-tone="pill.tone" role="status">{{ pill.label }}</span>
        <button
          type="button"
          class="ew-btn ew-btn--subtle ew-btn--small"
          :disabled="busy"
          @click="emit('refresh')"
        >
          <AppIcon name="refresh" :size="14" />
          {{ text.refresh }}
        </button>
      </div>
    </header>
    <p v-if="error" class="ew-alert ew-alert--error" role="alert">
      <AppIcon name="warning" :size="16" />
      <span>{{ error }}</span>
    </p>
    <template v-if="status">
      <div class="ew-method-grid" role="radiogroup" :aria-label="text.methodLabel">
        <label
          v-for="mode in AI_MODES"
          :key="mode"
          class="ew-method"
          :data-mode="mode"
          :data-checked="status.mode === mode"
          :data-disabled="disabled"
        >
          <input
            type="radio"
            class="ew-visually-hidden"
            :name="ids.method"
            :value="mode"
            :checked="status.mode === mode"
            :disabled="disabled"
            @change="chooseMode(mode)"
          />
          <span class="ew-method__glyph"><AppIcon :name="METHOD_ICONS[mode]" :size="16" /></span>
          <span class="ew-method__title">
            {{ methodTitle(mode) }}
            <span
              v-if="METHOD_BADGES[mode]"
              class="ew-badge"
              :class="{ 'ew-badge--accent': mode === 'chatgpt' }"
            >
              {{ text[METHOD_BADGES[mode]] }}
            </span>
          </span>
          <span class="ew-method__hint">{{ text.methodHints[mode] }}</span>
          <AppIcon v-if="status.mode === mode" class="ew-method__check" name="check" :size="16" />
        </label>
      </div>
      <div class="ew-ai-settings__panel">
        <template v-if="status.mode === 'chatgpt'">
          <p class="ew-muted">{{ text.planNote }}</p>
          <p v-if="active?.connected" class="ew-ai-settings__meta">
            {{ text.activeAccount }}: <strong>{{ active.label }}</strong>
          </p>
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
                }}{{ account.email && account.email !== account.label ? ` · ${account.email}` : ''
                }}{{ account.signIn === 'codex' ? ` · ${text.codexSignIn}` : '' }}
              </option>
            </select>
            <p :id="ids.accountHint" class="ew-muted">{{ text.savedAccountHint }}</p>
          </div>
          <p
            v-if="connectionState"
            class="ew-ai-settings__state"
            :data-ready="status.ready && selectedIsActive"
            role="status"
          >
            {{ connectionState }}
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
              <AppIcon name="plus" :size="14" />
              {{ text.addAccount }}
            </button>
            <button
              type="button"
              class="ew-btn"
              :disabled="busy"
              :aria-describedby="ids.codexHint"
              @click="emit('command', { action: 'connect', accountId: null, signIn: 'codex' })"
            >
              {{ text.codexConnect }}
            </button>
          </div>
          <p :id="ids.codexHint" class="ew-muted">{{ text.codexHint }}</p>
          <div v-if="selected" class="ew-ai-settings__manage">
            <button
              v-if="selected.connected"
              type="button"
              class="ew-btn ew-btn--subtle ew-btn--small"
              :disabled="disabled"
              @click="emit('command', { action: 'disconnect', accountId: selected.id })"
            >
              {{ text.disconnect }}
            </button>
            <AiAccountActions
              :account="selected"
              :text="text"
              :busy="busy"
              @command="emit('command', $event)"
            />
          </div>
          <div v-if="status.signingIn" class="ew-alert" role="status">
            <span class="ew-spinner" aria-hidden="true" />
            <span class="ew-alert__body">
              {{ text.signingIn }}
              <button type="button" class="ew-link" @click="emit('command', { action: 'cancel-sign-in' })">
                {{ text.cancel }}
              </button>
            </span>
          </div>
          <a
            class="ew-link ew-ai-settings__usage"
            :href="CHATGPT_USAGE_URL"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ text.manageUsage }}
            <AppIcon name="external" :size="14" />
          </a>
          <p class="ew-muted">
            {{ selected?.signIn === 'codex' ? text.codexConnectionHelp : text.connectionHelp }}
          </p>
        </template>
        <form v-else-if="status.mode === 'api-key'" class="ew-ai-settings__field" @submit.prevent="saveKey">
          <p class="ew-muted">{{ text.apiNote }}</p>
          <p v-if="status.apiKeyConfigured" class="ew-ai-settings__state" data-ready="true">
            {{ text.keySaved }}
          </p>
          <label class="ew-label" :for="ids.key">{{ text.apiKeyLabel }}</label>
          <div class="ew-ai-settings__key">
            <input
              :id="ids.key"
              v-model="key"
              class="ew-input"
              type="password"
              autocomplete="off"
              spellcheck="false"
              placeholder="sk-…"
              :disabled="disabled"
              maxlength="512"
            />
            <button
              type="submit"
              class="ew-btn ew-btn--primary"
              :disabled="disabled || key.trim().length < 10"
            >
              {{ text.saveKey }}
            </button>
          </div>
          <div v-if="status.apiKeyConfigured" class="ew-ai-settings__manage">
            <button
              type="button"
              class="ew-btn ew-btn--subtle ew-btn--small"
              :disabled="disabled"
              @click="emit('command', { action: 'clear-api-key' })"
            >
              {{ text.removeKey }}
            </button>
          </div>
        </form>
        <div v-else class="ew-ai-settings__field">
          <p class="ew-muted">{{ text.claudeNote }}</p>
          <p v-if="claudeState" class="ew-ai-settings__state" :data-ready="status.ready" role="status">
            {{ claudeState }}
          </p>
          <p v-if="claudeAccount" class="ew-ai-settings__meta">
            {{ text.claudeAccount }}: <strong>{{ claudeAccount }}</strong>
          </p>
          <p
            v-if="status.claudeCode?.loggedIn && !status.claudeCode.subscription"
            class="ew-alert ew-alert--warning"
            role="note"
          >
            <AppIcon name="warning" :size="16" />
            <span>{{ text.claudeApiBilling }}</span>
          </p>
        </div>
        <div
          v-if="status.models.length && (status.mode !== 'chatgpt' || selectedIsActive)"
          class="ew-ai-settings__field ew-ai-settings__model"
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
            <option v-for="model in status.models" :key="model.id" :value="model.id">
              {{ model.label }}
            </option>
          </select>
        </div>
      </div>
    </template>
    <p class="ew-ai-settings__privacy">
      <AppIcon name="shield" :size="16" />
      <span>{{ status?.mode === 'claude-code' ? text.claudePrivacy : text.privacy }}</span>
    </p>
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
