import { defineStore } from 'pinia';
import { ref } from 'vue';
import { priceReviewsApi, type PriceReview } from '@/api-client/price-reviews.api';

export const usePriceReviewsStore = defineStore('price-reviews', () => {
  const items = ref<PriceReview[]>([]);
  const total = ref(0);
  const loading = ref(false);
  async function fetch(q: Parameters<typeof priceReviewsApi.list>[0] = {}) {
    loading.value = true;
    try {
      const r = await priceReviewsApi.list(q);
      items.value = r.items;
      total.value = r.total;
    } finally { loading.value = false; }
  }
  return { items, total, loading, fetch };
});
