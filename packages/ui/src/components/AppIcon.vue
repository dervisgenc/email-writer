<script setup lang="ts">
import { computed } from 'vue';

import { ICON_PATHS, type IconName } from './icons';

const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 16 });

const paths = computed(() => ICON_PATHS[props.name]);
// Noktalı "daha fazla" simgesi yuvarlak uçlu kalın çizgiyle nokta olarak çizilir.
const strokeWidth = computed(() => (props.name === 'more' ? 2.6 : 1.4));
</script>

<template>
  <svg
    class="ew-icon"
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 20 20"
    :width="size"
    :height="size"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path v-for="(path, index) in paths" :key="index" :d="path" />
  </svg>
</template>
