import { defineStore } from 'pinia';
import { ref } from 'vue';
import { enrollmentsApi, type Enrollment } from '@/api-client/enrollments.api';

export const useEnrollmentsStore = defineStore('enrollments', () => {
  const items = ref<Enrollment[]>([]);
  const total = ref(0);
  const loading = ref(false);
  async function fetch(q: Parameters<typeof enrollmentsApi.list>[0] = {}) {
    loading.value = true;
    try {
      const r = await enrollmentsApi.list(q);
      items.value = r.items;
      total.value = r.total;
    } finally { loading.value = false; }
  }
  return { items, total, loading, fetch };
});
