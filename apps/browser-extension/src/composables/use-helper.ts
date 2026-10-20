import {
  compareVersions,
  MIN_HOST_VERSION,
  type ErrorCode,
  type HostUpdateCheck,
} from '@writehand/contracts';
import type { HelperView } from '@writehand/ui';
import { onUnmounted, ref, shallowRef } from 'vue';

import {
  hasNativeMessagingPermission,
  requestNativeMessagingPermission,
} from '../platform/extension-browser';
import { checkHostUpdate, fetchHostInfo, updateHost } from '../platform/extension-client';

const POLL_MS = 3_000;

/**
 * Helper app state: connection permission, whether it is installed, its version and updates.
 * The settings page card and the welcome wizard share this state. Without a connection it
 * retries every few seconds, so the helper shows up on its own once the user runs the
 * command in a terminal.
 */
export function useHelper() {
  const view = shallowRef<HelperView>({ kind: 'checking' });
  const update = shallowRef<HostUpdateCheck | null>(null);
  const updating = ref(false);
  const updatedTo = ref<string | null>(null);
  const error = ref<ErrorCode | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  async function refresh(): Promise<void> {
    clearTimeout(timer);
    if (!(await hasNativeMessagingPermission())) {
      view.value = { kind: 'permission' };
    } else {
      const result = await fetchHostInfo();
      if (result.ok)
        view.value =
          compareVersions(result.value.version, MIN_HOST_VERSION) < 0
            ? { kind: 'outdated', version: result.value.version }
            : { kind: 'connected', info: result.value };
      // A helper app that does not recognize this request predates version compatibility checks.
      else
        view.value =
          result.error.code === 'AI_VERSION_MISMATCH'
            ? { kind: 'outdated', version: null }
            : { kind: 'missing' };
    }
    if (!disposed && view.value.kind !== 'connected') timer = setTimeout(() => void refresh(), POLL_MS);
  }

  /** Called from a user click: the browser's permission prompt can only open at that moment. */
  async function grant(): Promise<void> {
    if (await requestNativeMessagingPermission()) await refresh();
  }

  /** The helper app asks GitHub at most once a day and caches the result. */
  async function checkForUpdate(): Promise<void> {
    if (view.value.kind !== 'connected' || view.value.info.development) return;
    const result = await checkHostUpdate();
    if (result.ok) update.value = result.value;
    else error.value = result.error.code;
  }

  async function install(): Promise<void> {
    if (updating.value) return;
    updating.value = true;
    error.value = null;
    const result = await updateHost();
    updating.value = false;
    if (!result.ok) {
      error.value = result.error.code;
      return;
    }
    updatedTo.value = result.value.version;
    update.value = null;
    // The updated helper app exits after replying; the next request starts the new one.
    await refresh();
  }

  onUnmounted(() => {
    disposed = true;
    clearTimeout(timer);
  });

  return { view, update, updating, updatedTo, error, refresh, grant, checkForUpdate, install };
}
