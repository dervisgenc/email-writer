<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef } from 'vue';

import { useUiText } from '../i18n';
import { inputChecked } from '../input-value';
import type { ContextMessageView } from '../view-model';
import AppIcon from './AppIcon.vue';

const props = defineProps<{
  message: ContextMessageView;
  disabled: boolean;
  /** Shows a control for picking the reply target when the active message could not be identified. */
  chooseReplyTarget: boolean;
  replyGroup: string;
}>();

const emit = defineEmits<{
  'include-change': [included: boolean];
  'text-change': [text: string | null];
  'block-include': [blockIndex: number];
  'reply-target-change': [];
}>();

const text = useUiText();
const bodyId = useId();
const editId = useId();
const expanded = ref(false);
const editing = ref(false);
const draft = ref('');
const editor = useTemplateRef<HTMLTextAreaElement>('editor');

const sender = computed(() => props.message.senderLabel ?? text.value.context.unknownSender);

async function startEditing(): Promise<void> {
  draft.value = props.message.text;
  editing.value = true;
  await nextTick();
  editor.value?.focus();
}

function save(): void {
  editing.value = false;
  emit('text-change', draft.value);
}

/** In the edit field, Escape only ends editing; the panel stays open. */
function cancelOnEscape(event: KeyboardEvent): void {
  event.stopPropagation();
  editing.value = false;
}
</script>

<template>
  <li class="ew-msg" :data-included="message.included" :data-group="message.group">
    <div class="ew-msg__head">
      <input
        class="ew-checkbox"
        type="checkbox"
        :checked="message.included"
        :disabled="disabled || message.locked"
        :aria-label="text.context.includeMessage(sender)"
        @change="emit('include-change', inputChecked($event))"
      />
      <div class="ew-msg__meta">
        <span class="ew-msg__sender">{{ sender }}</span>
        <span v-if="message.sentAtText" class="ew-msg__date">{{ message.sentAtText }}</span>
      </div>
      <span v-if="message.isReplyTarget" class="ew-badge ew-badge--accent">{{
        text.context.replyTargetBadge
      }}</span>
      <span v-if="message.edited" class="ew-badge">{{ text.context.editedBadge }}</span>
      <span class="ew-msg__actions">
        <button
          type="button"
          class="ew-btn ew-btn--subtle ew-btn--icon ew-btn--small"
          :aria-label="text.context.edit"
          :title="text.context.edit"
          :disabled="disabled || editing"
          @click="startEditing"
        >
          <AppIcon name="edit" :size="14" />
        </button>
        <button
          type="button"
          class="ew-btn ew-btn--subtle ew-btn--icon ew-btn--small"
          :aria-label="expanded ? text.context.hideBody : text.context.showBody"
          :title="expanded ? text.context.hideBody : text.context.showBody"
          :aria-expanded="expanded"
          :aria-controls="bodyId"
          @click="expanded = !expanded"
        >
          <AppIcon :name="expanded ? 'chevronDown' : 'chevronRight'" :size="14" />
        </button>
      </span>
    </div>

    <p v-if="message.group === 'other' && message.subject" class="ew-msg__subject" dir="auto">
      {{ message.subject }}
    </p>

    <div v-if="editing" class="ew-msg__edit" @keydown.escape="cancelOnEscape">
      <label class="ew-visually-hidden" :for="editId">{{ text.context.editLabel }}</label>
      <textarea :id="editId" ref="editor" v-model="draft" class="ew-textarea" dir="auto" rows="6" />
      <div class="ew-msg__edit-actions">
        <button
          v-if="message.edited"
          type="button"
          class="ew-btn ew-btn--subtle ew-btn--small"
          @click="
            editing = false;
            emit('text-change', null);
          "
        >
          <AppIcon name="undo" :size="14" />
          {{ text.context.resetEdit }}
        </button>
        <span class="ew-card__spacer" />
        <button type="button" class="ew-btn ew-btn--subtle ew-btn--small" @click="editing = false">
          {{ text.context.cancelEdit }}
        </button>
        <button type="button" class="ew-btn ew-btn--primary ew-btn--small" @click="save">
          {{ text.context.save }}
        </button>
      </div>
    </div>
    <!-- Email HTML is never rendered; the text is shown as plain text. -->
    <p v-else-if="!expanded" class="ew-msg__preview" dir="auto">{{ message.preview }}</p>
    <pre v-else :id="bodyId" class="ew-msg__body" dir="auto">{{ message.text }}</pre>

    <p v-if="message.locked" class="ew-muted">{{ text.context.activeLocked }}</p>
    <label v-if="chooseReplyTarget" class="ew-msg__reply-target">
      <input
        type="radio"
        class="ew-checkbox"
        :name="replyGroup"
        :checked="message.isReplyTarget"
        :disabled="disabled"
        @change="emit('reply-target-change')"
      />
      {{ text.context.replyTarget }}
    </label>

    <ul v-if="message.omittedBlocks.length > 0 && !message.edited" class="ew-msg__omitted">
      <li v-for="block in message.omittedBlocks" :key="block.blockIndex">
        <span class="ew-badge">{{ text.context.omittedBlock[block.kind] }}</span>
        <span class="ew-msg__omitted-text" dir="auto">{{ block.text }}</span>
        <button
          type="button"
          class="ew-link"
          :disabled="disabled"
          @click="emit('block-include', block.blockIndex)"
        >
          {{ text.context.includeBlock }}
        </button>
      </li>
    </ul>
  </li>
</template>
