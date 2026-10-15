import { createAiSummaryStore } from '../composables/ai-summary-store';
import { fetchAiSummary } from '../platform/extension-client';

/** Sayfa başına tek bağlantı özeti; panel ve kart göstergeleri bunu paylaşır. */
export const useAiSummary = createAiSummaryStore(fetchAiSummary);
