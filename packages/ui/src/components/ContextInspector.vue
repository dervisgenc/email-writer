<script setup lang="ts">
import { computed, ref, useId } from 'vue';

import { describeNotice, useUiText } from '../i18n';
import type { ContextView } from '../view-model';
import AppIcon from './AppIcon.vue';
import ContextMessageCard from './ContextMessageCard.vue';

const props = defineProps<{
  context: ContextView;
  disabled: boolean;
}>();

const emit = defineEmits<{
  'context-selection-change': [messageKey: string, included: boolean];
  'context-text-change': [messageKey: string, text: string | null];
  'block-include': [messageKey: string, blockIndex: number];
  'reply-target-change': [messageKey: string];
  'refresh-context': [];
}>();

const text = useUiText();
const replyGroup = useId();
const otherListId = useId();
const showOthers = ref(false);

const current = computed(() => props.context.messages.filter((m) => m.group === 'current'));
const others = computed(() => props.context.messages.filter((m) => m.group === 'other'));
const includedCount = computed(() => props.context.messages.filter((m) => m.included).length);
// Mesaj sayısı başlıkta özetlendiği için açıklama listesinde tekrar edilmez.
const notices = computed(() =>
  props.context.notices
    .filter((notice) => notice.kind !== 'message-count')
    .map((notice) => describeNotice(text.value, notice)),
);
</script>

<template>
  <section class="ew-section ew-context">
    <div class="ew-section__header">
      <h3 class="ew-section__title">{{ text.context.title }}</h3>
      <span v-if="context.messages.length > 0" class="ew-muted">
        {{ text.context.summary(includedCount, context.messages.length) }}
      </span>
      <span class="ew-card__spacer" />
      <button
        type="button"
        class="ew-btn ew-btn--subtle ew-btn--icon ew-btn--small"
        :aria-label="context.status === 'not-loaded' ? text.context.read : text.context.refresh"
        :title="context.status === 'not-loaded' ? text.context.read : text.context.refresh"
        :disabled="disabled || context.status === 'reading'"
        @click="emit('refresh-context')"
      >
        <span v-if="context.status === 'reading'" class="ew-spinner" aria-hidden="true" />
        <AppIcon v-else name="refresh" :size="14" />
      </button>
    </div>

    <p v-if="context.status === 'not-loaded'" class="ew-muted">{{ text.context.notLoaded }}</p>
    <p v-else-if="context.status === 'reading' && context.messages.length === 0" class="ew-muted">
      {{ text.context.reading }}
    </p>
    <p v-if="context.status === 'stale'" class="ew-alert ew-alert--warning">{{ text.context.stale }}</p>
    <p v-if="context.errorCode !== null" class="ew-alert ew-alert--error">
      {{ text.errors[context.errorCode] }}
    </p>
    <p v-if="context.needsReplyTarget" class="ew-alert ew-alert--warning">
      {{ text.context.chooseReplyTarget }}
    </p>

    <template v-if="current.length > 0">
      <h4 class="ew-context__group">{{ text.context.currentGroup }}</h4>
      <ul class="ew-context__list">
        <ContextMessageCard
          v-for="message in current"
          :key="message.messageKey"
          :message="message"
          :disabled="disabled"
          :choose-reply-target="context.needsReplyTarget"
          :reply-group="replyGroup"
          @include-change="emit('context-selection-change', message.messageKey, $event)"
          @text-change="emit('context-text-change', message.messageKey, $event)"
          @block-include="emit('block-include', message.messageKey, $event)"
          @reply-target-change="emit('reply-target-change', message.messageKey)"
        />
      </ul>
    </template>

    <template v-if="others.length > 0">
      <button
        type="button"
        class="ew-context__toggle"
        :aria-expanded="showOthers"
        :aria-controls="otherListId"
        @click="showOthers = !showOthers"
      >
        <AppIcon :name="showOthers ? 'chevronDown' : 'chevronRight'" :size="14" />
        {{ text.context.otherGroup(others.length) }}
      </button>
      <div v-show="showOthers" :id="otherListId">
        <p class="ew-muted">{{ text.context.otherHint }}</p>
        <ul class="ew-context__list">
          <ContextMessageCard
            v-for="message in others"
            :key="message.messageKey"
            :message="message"
            :disabled="disabled"
            :choose-reply-target="false"
            :reply-group="replyGroup"
            @include-change="emit('context-selection-change', message.messageKey, $event)"
            @text-change="emit('context-text-change', message.messageKey, $event)"
            @block-include="emit('block-include', message.messageKey, $event)"
          />
        </ul>
      </div>
    </template>

    <!-- Eksik kapsam genel bir "hazır" mesajının arkasına saklanmaz. -->
    <ul v-if="notices.length > 0" class="ew-context__notices">
      <li v-for="notice in notices" :key="notice">
        <AppIcon name="info" :size="14" />
        <span>{{ notice }}</span>
      </li>
    </ul>
  </section>
</template>
