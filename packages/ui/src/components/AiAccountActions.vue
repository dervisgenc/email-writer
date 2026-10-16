<script setup lang="ts">
import { aiAccountLabelSchema, type AiCommand, type AiStatus } from '@email-writer/contracts';
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue';
import type { AiText } from '../ai-text';

const props = defineProps<{
  account: AiStatus['accounts'][number];
  text: AiText;
  busy: boolean;
}>();
const emit = defineEmits<{ command: [command: AiCommand] }>();
const editing = ref(false);
const name = ref('');
const nameInput = useTemplateRef<HTMLInputElement>('nameInput');
const dialog = useTemplateRef<HTMLDialogElement>('removeDialog');
const removal = ref<{ id: string; label: string } | null>(null);
const ids = { name: useId(), hint: useId(), title: useId(), description: useId() };
const validName = computed(() => aiAccountLabelSchema.safeParse(name.value));
watch([() => props.account.id, () => props.account.label], () => {
  editing.value = false;
  closeRemoval();
});
async function startRename() {
  name.value = props.account.label;
  editing.value = true;
  await nextTick();
  nameInput.value?.focus();
  nameInput.value?.select();
}
function saveName() {
  if (props.busy || !validName.value.success) return;
  emit('command', { action: 'rename-account', accountId: props.account.id, label: validName.value.data });
}
function closeRemoval() {
  removal.value = null;
  dialog.value?.close?.();
}
async function startRemoval() {
  removal.value = { id: props.account.id, label: props.account.label };
  await nextTick();
  dialog.value?.showModal?.();
}
function remove() {
  if (props.busy || !removal.value) return;
  const accountId = removal.value.id;
  closeRemoval();
  emit('command', { action: 'remove-account', accountId });
}
</script>

<template>
  <div class="ew-ai-settings__actions">
    <button
      type="button"
      class="ew-btn ew-btn--subtle ew-btn--small"
      :disabled="busy || editing"
      @click="startRename"
    >
      {{ text.renameAccount }}
    </button>
    <button
      type="button"
      class="ew-btn ew-btn--subtle ew-btn--small ew-btn--danger-text"
      :disabled="busy"
      @click="startRemoval"
    >
      {{ text.removeAccount }}
    </button>
  </div>
  <form v-if="editing" class="ew-ai-settings__field ew-ai-settings__rename" @submit.prevent="saveName">
    <label class="ew-label" :for="ids.name">{{ text.accountName }}</label>
    <input
      :id="ids.name"
      ref="nameInput"
      v-model="name"
      class="ew-input"
      :aria-describedby="ids.hint"
      type="text"
      maxlength="80"
      autocomplete="off"
      :disabled="busy"
      @keydown.esc.prevent="editing = false"
    />
    <p :id="ids.hint" class="ew-muted">{{ text.accountNameHint }}</p>
    <div class="ew-ai-settings__actions">
      <button
        type="submit"
        class="ew-btn ew-btn--primary"
        :disabled="busy || !validName.success || name.trim() === account.label"
      >
        {{ text.saveAccountName }}
      </button>
      <button type="button" class="ew-btn" :disabled="busy" @click="editing = false">
        {{ text.cancel }}
      </button>
    </div>
  </form>
  <dialog
    ref="removeDialog"
    class="ew-ai-account-dialog"
    :aria-labelledby="ids.title"
    :aria-describedby="ids.description"
    @cancel.prevent="closeRemoval"
  >
    <h2 :id="ids.title">{{ text.removeAccountTitle }}</h2>
    <p class="ew-ai-account-dialog__name">{{ removal?.label }}</p>
    <p :id="ids.description">{{ text.removeAccountBody }}</p>
    <div class="ew-ai-settings__actions">
      <button type="button" class="ew-btn" autofocus :disabled="busy" @click="closeRemoval">
        {{ text.cancel }}
      </button>
      <button type="button" class="ew-btn ew-btn--primary" :disabled="busy" @click="remove">
        {{ text.confirmRemoveAccount }}
      </button>
    </div>
  </dialog>
</template>
