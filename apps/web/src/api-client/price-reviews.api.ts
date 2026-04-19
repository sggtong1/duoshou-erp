import { http } from './http';

export interface PriceReview {
  id: string;
  shopId: string;
  platformOrderId: string;
  skuTitle: string | null;
  currentPriceCents: number | null;
  suggestedPriceCents: number | null;
  currency: string | null;
  reason: string | null;
  status: 'pending' | 'confirmed' | 'rejected' | 'expired';
  receivedAt: string;
  deadlineAt: string | null;
  shop: { id: string; displayName: string | null; platformShopId: string; shopType: string };
}

export const priceReviewsApi = {
  list: (q: {
    shopId?: string; status?: string; search?: string; page?: number; pageSize?: number;
  } = {}) =>
    http<{ total: number; page: number; pageSize: number; items: PriceReview[] }>('/price-reviews', { query: q }),
  get: (id: string) => http<PriceReview>('/price-reviews/' + id),
  batchConfirm: (reviewIds: string[]) =>
    http<{ total: number; results: Array<{ id: string; ok: boolean; error?: string }> }>(
      '/price-reviews/batch-confirm', { method: 'POST', body: JSON.stringify({ reviewIds }) },
    ),
  batchReject: (reviewIds: string[], counterPriceCents: Record<string, number>) =>
    http<{ total: number; results: Array<{ id: string; ok: boolean; error?: string }> }>(
      '/price-reviews/batch-reject',
      { method: 'POST', body: JSON.stringify({ reviewIds, counterPriceCents }) },
    ),
};
