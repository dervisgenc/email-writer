import { createAiSummaryStore } from '../composables/ai-summary-store';
import { fetchAiSummary } from '../platform/extension-client';

/** One connection summary per page, shared by the panel and card indicators. */
export const useAiSummary = createAiSummaryStore(fetchAiSummary);
