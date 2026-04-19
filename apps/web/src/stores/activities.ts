import { defineStore } from 'pinia';
import { ref } from 'vue';
import { activitiesApi, type Activity } from '@/api-client/activities.api';

export const useActivitiesStore = defineStore('activities', () => {
  const items = ref<Activity[]>([]);
  const total = ref(0);
  const loading = ref(false);
  async function fetch(q: Parameters<typeof activitiesApi.list>[0] = {}) {
    loading.value = true;
    try {
      const r = await activitiesApi.list(q);
      items.value = r.items;
      total.value = r.total;
    } finally { loading.value = false; }
  }
  return { items, total, loading, fetch };
});
