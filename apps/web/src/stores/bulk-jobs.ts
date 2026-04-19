import { defineStore } from 'pinia';
import { ref } from 'vue';
import { bulkJobsApi, type BulkJob } from '@/api-client/bulk-jobs.api';

export const useBulkJobsStore = defineStore('bulk-jobs', () => {
  const current = ref<BulkJob | null>(null);
  async function fetch(id: string) {
    current.value = await bulkJobsApi.get(id);
    return current.value;
  }
  return { current, fetch };
});
