import { http } from './http';

export interface PriceReview {
  id: string;
  shopId: string;
  platformOrderId: string;
  platformSkuId: string | null;
  productSkuIds: string[];
  skuTitle: string | null;
  currentPriceCents: number | null;
  suggestedPriceCents: number | null;
  currency: string | null;
  reason: string | null;
  status: 'pending' | 'confirmed' | 'rejected' | 'expired';
  rawStatus: number | null;
  canBargain: boolean | null;
  siteIds: number[];
  siteNameList: string[];
  receivedAt: string;
  deadlineAt: string | null;
  shop: {
    id: string;
    platform: string;
    displayName: string | null;
    platformShopId: string;
    shopType: string;
    region: string;
  };
}

export interface RejectReviewItem {
  reviewId: string;
  counterPriceCents?: number;
  priceItems?: Array<{ productSkuId: string | number; priceCents: number }>;
  reasons?: Array<{ type: number; reason: string }>;
  externalLinks?: string[];
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
  batchRejectItems: (items: RejectReviewItem[]) =>
    http<{ total: number; results: Array<{ id: string; ok: boolean; error?: string }> }>(
      '/price-reviews/batch-reject',
      { method: 'POST', body: JSON.stringify({ items }) },
    ),
  syncNow: () =>
    http<{
      accepted: boolean;
      startedAt: string;
      total: number;
      skipped: boolean;
      shops: Array<{
        shopId: string;
        displayName: string | null;
        platformShopId: string;
        shopType: string;
        region: string;
        ok: boolean;
        touched: number;
        error?: { message: string; errorCode: number | null; errorMsg: string | null };
      }>;
    }>('/price-reviews/sync/now', { method: 'POST' }),
};
