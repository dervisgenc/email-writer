<script setup lang="ts">
import { computed, ref, useId } from 'vue';

import { describeNotice, useUiText } from '../i18n';
import { inputChecked } from '../input-value';
import type { ContextView } from '../view-model';

const props = defineProps<{
  context: ContextView;
  disabled: boolean;
}>();

const emit = defineEmits<{
  'context-selection-change': [messageKey: string, included: boolean];
  'block-include': [messageKey: string, blockIndex: number];
  'reply-target-change': [messageKey: string];
  'refresh-context': [];
}>();

const text = useUiText();
const listId = useId();
const replyGroup = useId();
const isOpen = ref(false);
const expandedBodies = ref(new Set<string>());

const notices = computed(() => props.context.notices.map((notice) => describeNotice(text.value, notice)));

function toggleBody(messageKey: string): void {
  const next = new Set(expandedBodies.value);
  if (next.has(messageKey)) {
    next.delete(messageKey);
  } else {
    next.add(messageKey);
  }
  expandedBodies.value = next;
}

/** Açık alt bölüm varsa önce onu kapatır; panel kapanmaz. */
function closeOnEscape(event: KeyboardEvent): void {
  if (isOpen.value) {
    event.stopPropagation();
    isOpen.value = false;
  }
}
</script>

<template>
  <section class="ew-context" @keydown.escape="closeOnEscape">
    <div class="ew-context__header">
      <h3 class="ew-section-title">{{ text.context.title }}</h3>
      <span class="ew-context__actions">
        <button
          v-if="context.status !== 'not-loaded'"
          type="button"
          class="ew-link"
          :aria-expanded="isOpen"
          :aria-controls="listId"
          :disabled="context.messages.length === 0"
          @click="isOpen = !isOpen"
        >
          {{ isOpen ? text.context.hide : text.context.inspect }}
        </button>
        <button
          type="button"
          class="ew-link"
          :disabled="disabled || context.status === 'reading'"
          @click="emit('refresh-context')"
        >
          {{ context.status === 'not-loaded' ? text.context.read : text.context.refresh }}
        </button>
      </span>
    </div>

    <p v-if="context.status === 'not-loaded'" class="ew-muted">{{ text.context.notLoaded }}</p>
    <p v-else-if="context.status === 'reading'" class="ew-muted">{{ text.context.reading }}</p>
    <p v-if="context.status === 'stale'" class="ew-warning">{{ text.context.stale }}</p>
    <p v-if="context.errorCode !== null" class="ew-field-error">{{ text.errors[context.errorCode] }}</p>

    <p v-if="context.needsReplyTarget" class="ew-warning">{{ text.context.chooseReplyTarget }}</p>

    <!-- Eksik kapsam genel bir "hazır" mesajının arkasına saklanmaz. -->
    <ul v-if="notices.length > 0" class="ew-context__notices">
      <li v-for="notice in notices" :key="notice">{{ notice }}</li>
    </ul>

    <ul v-show="isOpen || context.needsReplyTarget" :id="listId" class="ew-context__messages">
      <li v-for="message in context.messages" :key="message.messageKey" class="ew-context__message">
        <label class="ew-context__choice">
          <input
            type="checkbox"
            :checked="message.included"
            :disabled="disabled || message.locked"
            @change="emit('context-selection-change', message.messageKey, inputChecked($event))"
          />
          <span class="ew-context__sender">{{ message.senderLabel ?? text.context.unknownSender }}</span>
          <span v-if="message.sentAtText" class="ew-muted">{{ message.sentAtText }}</span>
        </label>
        <label v-if="context.needsReplyTarget" class="ew-context__choice">
          <input
            type="radio"
            :name="replyGroup"
            :checked="message.isReplyTarget"
            :disabled="disabled"
            @change="emit('reply-target-change', message.messageKey)"
          />
          {{ text.context.replyTarget }}
        </label>
        <p v-if="message.locked" class="ew-muted">{{ text.context.activeLocked }}</p>
        <p class="ew-context__preview" dir="auto">{{ message.preview }}</p>
        <button type="button" class="ew-link" @click="toggleBody(message.messageKey)">
          {{ expandedBodies.has(message.messageKey) ? text.context.hideBody : text.context.showBody }}
        </button>
        <!-- E-posta HTML'i render edilmez; metin düz metin olarak gösterilir. -->
        <pre v-if="expandedBodies.has(message.messageKey)" class="ew-context__body" dir="auto">{{
          message.text
        }}</pre>
        <ul v-if="message.omittedBlocks.length > 0" class="ew-context__omitted">
          <li v-for="block in message.omittedBlocks" :key="block.blockIndex">
            <span class="ew-badge">{{ text.context.omittedBlock[block.kind] }}</span>
            <span class="ew-context__preview" dir="auto">{{ block.text }}</span>
            <button
              type="button"
              class="ew-link"
              :disabled="disabled"
              @click="emit('block-include', message.messageKey, block.blockIndex)"
            >
              {{ text.context.includeBlock }}
            </button>
          </li>
        </ul>
      </li>
    </ul>
  </section>
</template>
