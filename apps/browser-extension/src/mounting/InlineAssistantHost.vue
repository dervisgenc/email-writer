<script setup lang="ts">
import { InlineAssistant } from '@email-writer/ui';

import { usePanelSession, type PanelSessionDependencies } from '../composables/use-panel-session';

const props = defineProps<{
  session: PanelSessionDependencies;
}>();

// Kart, paneldeki oturumun aynısını gösterir; "Panelde aç" çalışmayı kaybetmeden sürdürür.
const { view, handlers } = usePanelSession(props.session);
</script>

<template>
  <InlineAssistant
    :view="view"
    @close="handlers.close"
    @expand="handlers.expandToPanel"
    @submit-instruction="handlers.submitInstruction"
    @preview-change="handlers.previewChange"
    @apply="handlers.apply"
    @copy="handlers.copy"
    @undo="handlers.undo"
    @retry="handlers.retry"
    @dismiss="handlers.dismiss"
  />
</template>
