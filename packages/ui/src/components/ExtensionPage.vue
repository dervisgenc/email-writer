<script setup lang="ts">
import type { Theme } from '@writehand/contracts';

/**
 * Shared shell for the extension's own pages (settings, welcome): a header and centered content.
 * `logo` is the URL of the extension's icon file, shown next to the title as the brand mark.
 */
defineProps<{ theme: Theme; title: string; subtitle: string; logo: string }>();
</script>

<template>
  <div class="ew-root ew-page" :data-theme="theme">
    <main class="ew-page__main">
      <header class="ew-page__header">
        <img class="ew-page__logo" :src="logo" alt="" width="48" height="48" />
        <div>
          <h1 class="ew-page__title">{{ title }}</h1>
          <p class="ew-page__subtitle">{{ subtitle }}</p>
        </div>
      </header>
      <slot />
    </main>
  </div>
</template>
