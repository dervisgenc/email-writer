import type { AiSummary, AppError, Result } from '@writehand/contracts';
import { onScopeDispose, readonly, shallowRef } from 'vue';

const POLL_INTERVAL_MS = 5_000;

/**
 * All connection indicators on the page share the same summary. It is not
 * re-fetched every time a card opens; the last known state is shown immediately.
 * `checked` stays false until the first response arrives, so the connection is
 * never shown as "missing" before then.
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

  /** Keeps the summary up to date for as long as the indicator is mounted. */
  return function useAiSummary() {
    users += 1;
    if (users === 1) {
      generation += 1;
      void poll(generation);
    }
    onScopeDispose(() => {
      users -= 1;
      if (users === 0) {
        // A pending response is ignored too; the next indicator asks again.
        generation += 1;
        clearTimeout(timer);
      }
    });
    return { summary: readonly(summary), checked: readonly(checked) };
  };
}
