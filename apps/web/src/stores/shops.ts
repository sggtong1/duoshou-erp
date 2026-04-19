import { defineStore } from 'pinia';
import { ref } from 'vue';
import { shopsApi, type Shop } from '@/api-client/shops.api';

export const useShopsStore = defineStore('shops', () => {
  const items = ref<Shop[]>([]);
  const loading = ref(false);
  async function fetch() {
    loading.value = true;
    try { items.value = await shopsApi.list(); }
    finally { loading.value = false; }
  }
  return { items, loading, fetch };
});
