import { ok, type AiSummary } from '@email-writer/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';

import { createAiSummaryStore } from '../../../apps/browser-extension/src/composables/ai-summary-store';

const ready: AiSummary = { mode: 'chatgpt', ready: true, selectedModel: 'model' };

describe('AI bağlantı göstergesi özeti', () => {
  const fetchAiSummary = vi.fn();
  let useAiSummary: ReturnType<typeof createAiSummaryStore>;
  /** Bir göstergenin bağlandığı (kartın açıldığı) kapsam. */
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

  it('ilk yanıt gelene kadar "denetleniyor" durumundadır; bağlantı yok diye gösterilmez', async () => {
    let answer!: (value: unknown) => void;
    fetchAiSummary.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const indicator = mountIndicator();

    expect(indicator.checked.value).toBe(false);
    answer(ok(ready));
    await vi.waitFor(() => expect(indicator.checked.value).toBe(true));
    expect(indicator.summary.value).toEqual(ready);
    indicator.unmount();
  });

  it('kart yeniden açılınca son bilinen durum hemen görünür; göstergeler tek sorguyu paylaşır', async () => {
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

  it('son gösterge kapanınca sorgu durur; geç gelen yanıt yok sayılır', async () => {
    let answer!: (value: unknown) => void;
    fetchAiSummary.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const indicator = mountIndicator();
    indicator.unmount();

    answer(ok({ ...ready, ready: false }));
    await vi.advanceTimersByTimeAsync(20_000);
    expect(fetchAiSummary).toHaveBeenCalledTimes(1);
  });
});
