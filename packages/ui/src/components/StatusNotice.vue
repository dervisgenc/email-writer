<script setup lang="ts">
import { computed } from 'vue';

import { useUiText } from '../i18n';
import type { StatusView } from '../view-model';

const props = defineProps<{
  status: StatusView;
}>();

const emit = defineEmits<{
  retry: [];
  dismiss: [];
}>();

const text = useUiText();

function describe(status: StatusView): string {
  const labels = text.value.status;
  if (status.kind === 'busy') {
    return labels[status.activity];
  }
  if (status.kind === 'success') {
    return labels[status.message];
  }
  return status.kind === 'none' ? '' : text.value.errors[status.code];
}

const message = computed(() => describe(props.status));
</script>

<template>
  <!-- Bekleme ve başarı mesajları kısa biçimde, nazikçe duyurulur. -->
  <div class="ew-status" :data-kind="status.kind" aria-live="polite" role="status">
    <template v-if="status.kind !== 'none'">
      <span>{{ message }}</span>
      <button
        v-if="status.kind === 'error' && status.canRetry"
        type="button"
        class="ew-link"
        @click="emit('retry')"
      >
        {{ text.status.retry }}
      </button>
      <button v-if="status.kind === 'error'" type="button" class="ew-link" @click="emit('dismiss')">
        {{ text.status.dismiss }}
      </button>
    </template>
  </div>
</template>
