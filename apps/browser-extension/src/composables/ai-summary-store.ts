import type { AiSummary, AppError, Result } from '@email-writer/contracts';
import { onScopeDispose, readonly, shallowRef } from 'vue';

const POLL_INTERVAL_MS = 5_000;

/**
 * Sayfadaki bütün bağlantı göstergeleri aynı özeti paylaşır. Kart her
 * açıldığında yeniden sorulmaz; son bilinen durum hemen gösterilir. İlk yanıt
 * gelene kadar `checked` yanlıştır: bağlantı "yok" diye gösterilmez.
 */
export function createAiSummaryStore(fetchSummary: () => Promise<Result<AiSummary, AppError>>) {
  const summary = shallowRef<AiSummary | null>(null);
  const checked = shallowRef(false);
  let users = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;

  const poll = async (current: number): Promise<void> => {
    const result = await fetchSummary();
    if (current !== generation) return;
    summary.value = result.ok ? result.value : null;
    checked.value = true;
    timer = setTimeout(() => {
      void poll(current);
    }, POLL_INTERVAL_MS);
  };

  /** Göstergenin bağlı olduğu süre boyunca özeti güncel tutar. */
  return function useAiSummary() {
    users += 1;
    if (users === 1) {
      generation += 1;
      void poll(generation);
    }
    onScopeDispose(() => {
      users -= 1;
      if (users === 0) {
        // Bekleyen yanıt da yok sayılır; sonraki gösterge yeniden sorar.
        generation += 1;
        clearTimeout(timer);
      }
    });
    return { summary: readonly(summary), checked: readonly(checked) };
  };
}
