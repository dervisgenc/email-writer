<script setup lang="ts">
import {
  API_PROVIDER_DETAILS,
  API_PROVIDERS,
  apiKeySchema,
  apiProviderOfKey,
  type AiCommand,
  type ApiKeyStatus,
  type ApiProvider,
} from '@writehand/contracts';
import { computed, ref, useId, watch } from 'vue';

import type { AiText } from '../ai-text';
import AppIcon from './AppIcon.vue';
import ModelSelect from './ModelSelect.vue';

/**
 * The user's own API key, used by the extension itself. The key is sent to the background
 * once and the field is cleared at once; a saved key is never shown again.
 */
const props = defineProps<{ apiKey: ApiKeyStatus; text: AiText; busy: boolean }>();
const emit = defineEmits<{ command: [command: AiCommand]; 'grant-access': [provider: ApiProvider] }>();
const ids = { provider: useId(), key: useId() };
const key = ref('');
const details = computed(() => API_PROVIDER_DETAILS[props.apiKey.provider]);
const saved = computed(() => props.apiKey.savedKeys.includes(props.apiKey.provider));
const ready = computed(() => saved.value && props.apiKey.access && props.apiKey.selectedModel !== null);
const valid = computed(() => apiKeySchema.safeParse(key.value.trim()).success);
/** A key in another provider's format is not sent to this one. */
const otherProvider = computed(() => {
  const owner = apiProviderOfKey(key.value.trim());
  return owner !== null && owner !== props.apiKey.provider ? API_PROVIDER_DETAILS[owner].name : null;
});
// A key typed for one provider is never sent to another one.
watch(
  () => props.apiKey.provider,
  () => (key.value = ''),
);

function chooseProvider(provider: ApiProvider) {
  if (provider !== props.apiKey.provider) emit('command', { action: 'select-api-provider', provider });
}
function saveKey() {
  const apiKey = key.value.trim();
  if (!valid.value || otherProvider.value !== null) return;
  key.value = '';
  emit('command', { action: 'save-api-key', provider: props.apiKey.provider, apiKey });
}
</script>

<template>
  <div class="ew-ai-settings__field">
    <span :id="ids.provider" class="ew-label">{{ text.provider }}</span>
    <div class="ew-segmented" role="radiogroup" :aria-labelledby="ids.provider">
      <label
        v-for="provider in API_PROVIDERS"
        :key="provider"
        class="ew-segmented__option"
        :data-checked="apiKey.provider === provider"
      >
        <input
          type="radio"
          class="ew-visually-hidden"
          :name="ids.provider"
          :value="provider"
          :checked="apiKey.provider === provider"
          :disabled="busy"
          @change="chooseProvider(provider)"
        />
        {{ API_PROVIDER_DETAILS[provider].name }}
      </label>
    </div>
    <p class="ew-muted">{{ text.providerHints[apiKey.provider] }}</p>
  </div>
  <p class="ew-muted">{{ text.apiNote(details.name) }}</p>
  <p v-if="saved" class="ew-ai-settings__state" :data-ready="ready" role="status">
    {{ text.keySaved(details.name) }}
  </p>
  <div v-if="saved && !apiKey.access" class="ew-alert ew-alert--warning" role="note">
    <AppIcon name="warning" :size="16" />
    <span class="ew-alert__body">
      {{ text.accessNeeded(details.name) }}
      <button
        type="button"
        class="ew-btn ew-btn--primary ew-btn--small"
        :disabled="busy"
        @click="emit('grant-access', apiKey.provider)"
      >
        {{ text.grantAccess }}
      </button>
    </span>
  </div>
  <form class="ew-ai-settings__field" @submit.prevent="saveKey">
    <label class="ew-label" :for="ids.key">{{ text.apiKeyLabel(details.name) }}</label>
    <div class="ew-ai-settings__key">
      <input
        :id="ids.key"
        v-model="key"
        class="ew-input"
        type="password"
        autocomplete="off"
        spellcheck="false"
        :placeholder="`${details.keyPrefix}…`"
        :disabled="busy"
        maxlength="512"
      />
      <button
        type="submit"
        class="ew-btn ew-btn--primary"
        :disabled="busy || !valid || otherProvider !== null"
      >
        {{ text.saveKey }}
      </button>
    </div>
    <p v-if="otherProvider" class="ew-alert ew-alert--warning" role="alert">
      <AppIcon name="warning" :size="16" />
      <span>{{ text.keyFromOtherProvider(otherProvider) }}</span>
    </p>
    <p v-else-if="saved" class="ew-muted">{{ text.replaceKeyHint }}</p>
  </form>
  <div class="ew-ai-settings__manage">
    <a
      class="ew-link ew-ai-settings__usage"
      :href="details.keysUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ text.createKey(details.name) }}
      <AppIcon name="external" :size="14" />
    </a>
    <button
      v-if="saved"
      type="button"
      class="ew-btn ew-btn--subtle ew-btn--small"
      :disabled="busy"
      @click="emit('command', { action: 'remove-api-key', provider: apiKey.provider })"
    >
      {{ text.removeKey }}
    </button>
  </div>
  <ModelSelect
    v-if="apiKey.models.length"
    :models="apiKey.models"
    :selected="apiKey.selectedModel"
    :text="text"
    :disabled="busy"
    @select="emit('command', { action: 'set-model', model: $event })"
  />
</template>
