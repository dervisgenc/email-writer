<script setup lang="ts">
import {
  HELPER_DELETE_DATA_OPTION,
  helperUninstallCommand,
  type HostOperatingSystem,
} from '@email-writer/contracts';
import { HelperCard, type UiText } from '@email-writer/ui';
import { computed, onMounted, ref, watch } from 'vue';

import { useHelper } from '../composables/use-helper';
import { copyText } from '../platform/clipboard';
import { openWelcomePage, operatingSystem } from '../platform/extension-browser';

/** Ayarlardaki yardımcı uygulama kartı: durum, güncelleme, sihirbaz ve kaldırma. */
const props = defineProps<{ text: UiText; checkUpdates: boolean }>();
const emit = defineEmits<{ 'toggle-updates': [enabled: boolean] }>();

const helper = useHelper();
const system = ref<HostOperatingSystem>('linux');
const copied = ref(false);
const os = computed(() =>
  helper.view.value.kind === 'connected' ? helper.view.value.info.os : system.value,
);
const errorText = computed(() => (helper.error.value ? props.text.errors[helper.error.value] : null));

onMounted(async () => {
  system.value = await operatingSystem();
  await helper.refresh();
});
// Denetim açıksa yardımcı uygulama bağlanınca bir kez sorulur; o da günde en fazla bir kez GitHub'a gider.
watch(
  () => [helper.view.value.kind, props.checkUpdates] as const,
  ([kind, enabled]) => {
    if (kind === 'connected' && enabled) void helper.checkForUpdate();
    if (!enabled) helper.update.value = null;
  },
);

async function copy(command: string) {
  copied.value = (await copyText({ text: command, html: null })).ok;
}
</script>

<template>
  <HelperCard
    :view="helper.view.value"
    :text="text.helper"
    :update="helper.update.value"
    :updating="helper.updating.value"
    :updated-to="helper.updatedTo.value"
    :error="errorText"
    :check-updates="checkUpdates"
    :uninstall-command="helperUninstallCommand(os)"
    :uninstall-flag="HELPER_DELETE_DATA_OPTION[os]"
    :copied="copied"
    @grant="helper.grant"
    @update="helper.install"
    @open-wizard="openWelcomePage"
    @toggle-updates="emit('toggle-updates', $event)"
    @copy="copy"
  />
</template>
