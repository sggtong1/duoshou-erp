import { defineStore } from 'pinia';
import { ref } from 'vue';
import { dashboardApi, type DashboardSummary, type DashboardSummaryQuery } from '@/api-client/dashboard.api';

export const useDashboardStore = defineStore('dashboard', () => {
  const data = ref<DashboardSummary | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let currentAbort: AbortController | null = null;

  async function fetch(query: DashboardSummaryQuery = {}) {
    if (currentAbort) currentAbort.abort();
    const abort = new AbortController();
    currentAbort = abort;

    loading.value = true;
    error.value = null;
    try {
      const r = await dashboardApi.summary(query, abort.signal);
      if (!abort.signal.aborted) data.value = r;
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      error.value = e?.message ?? 'fetch failed';
    } finally {
      if (currentAbort === abort) {
        loading.value = false;
        currentAbort = null;
      }
    }
  }

  return { data, loading, error, fetch };
});
