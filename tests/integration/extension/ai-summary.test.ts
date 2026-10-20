import { ok, type AiSummary } from '@writehand/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';

import { createAiSummaryStore } from '../../../apps/browser-extension/src/composables/ai-summary-store';

const ready: AiSummary = { mode: 'chatgpt', ready: true, selectedModel: 'model' };

describe('AI connection indicator summary', () => {
  const fetchAiSummary = vi.fn();
  let useAiSummary: ReturnType<typeof createAiSummaryStore>;
  /** The scope an indicator is mounted in (where its card is open). */
  const mountIndicator = () => {
    const scope = effectScope();
    const state = scope.run(() => useAiSummary())!;
    return { ...state, unmount: () => scope.stop() };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    fetchAiSummary.mockReset();
    useAiSummary = createAiSummaryStore(fetchAiSummary);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays in the "checking" state until the first answer arrives instead of showing as disconnected', async () => {
    let answer!: (value: unknown) => void;
    fetchAiSummary.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const indicator = mountIndicator();

    expect(indicator.checked.value).toBe(false);
    answer(ok(ready));
    await vi.waitFor(() => expect(indicator.checked.value).toBe(true));
    expect(indicator.summary.value).toEqual(ready);
    indicator.unmount();
  });

  it('shows the last known state immediately when a card is reopened, and indicators share a single poll', async () => {
    fetchAiSummary.mockResolvedValue(ok(ready));
    const panel = mountIndicator();
    await vi.waitFor(() => expect(panel.checked.value).toBe(true));

    const card = mountIndicator();
    expect(card.checked.value).toBe(true);
    expect(card.summary.value?.ready).toBe(true);
    expect(fetchAiSummary).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchAiSummary).toHaveBeenCalledTimes(2);
    panel.unmount();
    card.unmount();
  });

  it('stops polling when the last indicator closes and ignores a late answer', async () => {
    let answer!: (value: unknown) => void;
    fetchAiSummary.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const indicator = mountIndicator();
    indicator.unmount();

    answer(ok({ ...ready, ready: false }));
    await vi.advanceTimersByTimeAsync(20_000);
    expect(fetchAiSummary).toHaveBeenCalledTimes(1);
  });
});
