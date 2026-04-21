import { defineStore } from 'pinia';
import { ref } from 'vue';
import { dashboardApi, type DashboardSummary } from '@/api-client/dashboard.api';

export const useDashboardStore = defineStore('dashboard', () => {
  const data = ref<DashboardSummary | null>(null);
  const loading = ref(false);
  const selectedShopId = ref<string | null>(null);

  async function fetch(shopId?: string | null) {
    loading.value = true;
    try {
      data.value = await dashboardApi.summary(shopId ?? undefined);
    } finally { loading.value = false; }
  }
  return { data, loading, selectedShopId, fetch };
});
