<script setup lang="ts">
import AppIcon from './AppIcon.vue';

/**
 * The wizard's steps: the current step is highlighted and completed ones are checked. The
 * user can move freely between the steps reached so far.
 */
const props = defineProps<{
  label: string;
  steps: readonly string[];
  current: number;
  /** The furthest step reached so far (zero-based). */
  furthest: number;
  /** Indexes of the completed steps (zero-based). */
  done: readonly number[];
}>();
const emit = defineEmits<{ select: [index: number] }>();

const state = (index: number) =>
  index === props.current ? 'current' : props.done.includes(index) ? 'done' : 'upcoming';
</script>

<template>
  <ol class="ew-steps" :aria-label="label">
    <li v-for="(step, index) in steps" :key="step" class="ew-steps__item" :data-state="state(index)">
      <button
        type="button"
        class="ew-steps__button"
        :aria-current="index === current ? 'step' : undefined"
        :disabled="index > furthest"
        :title="step"
        @click="emit('select', index)"
      >
        <span class="ew-steps__marker">
          <AppIcon v-if="state(index) === 'done'" name="check" :size="14" />
          <template v-else>{{ index + 1 }}</template>
        </span>
        <span class="ew-steps__label">{{ step }}</span>
      </button>
    </li>
  </ol>
</template>
