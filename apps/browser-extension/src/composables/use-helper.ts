import {
  compareVersions,
  MIN_HOST_VERSION,
  type ErrorCode,
  type HostUpdateCheck,
} from '@email-writer/contracts';
import type { HelperView } from '@email-writer/ui';
import { onUnmounted, ref, shallowRef } from 'vue';

import {
  hasNativeMessagingPermission,
  requestNativeMessagingPermission,
} from '../platform/extension-browser';
import { checkHostUpdate, fetchHostInfo, updateHost } from '../platform/extension-client';

const POLL_MS = 3_000;

/**
 * Yardımcı uygulamanın durumu: bağlantı izni, kurulu olup olmadığı, sürümü ve güncellemesi.
 * Ayarlar sayfasındaki kart ve karşılama sihirbazı aynı durumu kullanır. Bağlantı yokken
 * birkaç saniyede bir yeniden denenir; kullanıcı komutu terminalde çalıştırınca kendiliğinden görünür.
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
      // Bu isteği tanımayan yardımcı uygulama, sürüm uyumundan önceki bir sürümdür.
      else
        view.value =
          result.error.code === 'AI_VERSION_MISMATCH'
            ? { kind: 'outdated', version: null }
            : { kind: 'missing' };
    }
    if (!disposed && view.value.kind !== 'connected') timer = setTimeout(() => void refresh(), POLL_MS);
  }

  /** Kullanıcının tıklamasıyla çağrılır: tarayıcının izin penceresi yalnızca o anda açılabilir. */
  async function grant(): Promise<void> {
    if (await requestNativeMessagingPermission()) await refresh();
  }

  /** Yardımcı uygulama günde en fazla bir kez GitHub'a sorar; sonuç onda saklanır. */
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
    // Güncellenen yardımcı uygulama yanıtladıktan sonra kapanır; sonraki istek yenisini başlatır.
    await refresh();
  }

  onUnmounted(() => {
    disposed = true;
    clearTimeout(timer);
  });

  return { view, update, updating, updatedTo, error, refresh, grant, checkForUpdate, install };
}
