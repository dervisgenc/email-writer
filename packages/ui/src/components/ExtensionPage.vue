<script setup lang="ts">
import type { Theme } from '@writehand/contracts';

import AppIcon from './AppIcon.vue';

/** Shared shell for the extension's own pages (settings, welcome): a header and centered content. */
defineProps<{ theme: Theme; title: string; subtitle: string }>();
</script>

<template>
  <div class="ew-root ew-page" :data-theme="theme">
    <main class="ew-page__main">
      <header class="ew-page__header">
        <span class="ew-page__mark"><AppIcon name="sparkle" :size="24" /></span>
        <div>
          <h1 class="ew-page__title">{{ title }}</h1>
          <p class="ew-page__subtitle">{{ subtitle }}</p>
        </div>
      </header>
      <slot />
    </main>
  </div>
</template>
